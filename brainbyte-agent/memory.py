#!/usr/bin/env python3
"""
BrainByte Agent Backend - Memory Layer
=======================================
SQLite-backed memory for the self-learning agent.

- SQLite: structured memory (episodes, users, exemplars, knowledge)
- Numpy: in-process vector similarity for content scoring
- No external vector DB needed for MVP scale (< 10K items)
"""

import datetime
import hashlib
import json
import math
import os
import re
import sqlite3
from typing import Optional

import numpy as np

MEMORY_DB_PATH = os.path.join(os.path.dirname(__file__), "brainbyte_memory.db")


# ── Embedding Provider ──────────────────────────────────────────────────────
# Uses character n-gram hashing for lightweight semantic similarity.
# Replace with a transformer model (e.g., sentence-transformers/all-MiniLM-L6-v2)
# when content scale warrants it (>1K items).


def _simple_embed(text: str, dim: int = 128) -> np.ndarray:
    """Deterministic n-gram hash embedding. Similar texts produce similar vectors.

    Uses overlapping character n-grams (2-, 3-, and 4-grams) hashed into a fixed-
    size vector. Texts that share n-grams will have overlapping hash buckets,
    producing meaningful cosine similarity without external dependencies.
    """
    text = re.sub(r"\s+", " ", text.lower().strip())
    vec = np.zeros(dim, dtype=np.float32)
    for n in (2, 3, 4):
        for i in range(len(text) - n + 1):
            ngram = text[i : i + n]
            h = int(hashlib.md5(ngram.encode()).hexdigest()[:8], 16)
            vec[h % dim] += 1.0
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec /= norm
    return vec


class MemoryDB:
    """Hybrid memory: SQLite (structured) + TurboVec (semantic).

    Three memory types:
    - episodic: user timeline of interactions
    - semantic: extracted knowledge about users and content
    - procedural: recommendation patterns that worked

    Semantic search uses TurboVec for O(log n) similarity lookups.
    Structured queries use SQLite FTS5 + indexed columns.
    """

    def __init__(self, db_path: str = MEMORY_DB_PATH):
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self._init_schema()

    def _init_schema(self):
        cur = self.conn.cursor()

        # Users
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT,
                interests TEXT DEFAULT '[]',
                learning_goals TEXT DEFAULT '[]',
                xp INTEGER DEFAULT 0,
                streak INTEGER DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now')),
                metadata TEXT DEFAULT '{}'
            )
        """)

        # Content (knowledge bytes)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS content (
                id TEXT PRIMARY KEY,
                title TEXT,
                body TEXT,
                category TEXT,
                tags TEXT DEFAULT '[]',
                difficulty REAL DEFAULT 0.5,
                source TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                engagement_count INTEGER DEFAULT 0,
                avg_rating REAL DEFAULT 0.0
            )
        """)

        # Interactions (episodic memory — each user-content interaction)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS interactions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                content_id TEXT NOT NULL,
                action TEXT,         -- 'view', 'save', 'complete', 'skip', 'share'
                dwell_time REAL,     -- seconds spent
                rating REAL,         -- 0.0 to 1.0 user rating
                reward REAL DEFAULT 0.0,
                agent_cot TEXT,      -- what the agent was thinking when it picked this
                timestamp TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (content_id) REFERENCES content(id)
            )
        """)

        # Recommendation exemplars (procedural memory — learned policies)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS exemplars (
                id TEXT PRIMARY KEY,
                user_pattern TEXT,     -- matching pattern (e.g., 'likes_math_hates_history')
                content_pattern TEXT,  -- what to recommend
                success_rate REAL DEFAULT 0.5,
                avg_reward REAL DEFAULT 0.0,
                usage_count INTEGER DEFAULT 0,
                last_used TEXT DEFAULT (datetime('now')),
                tags TEXT DEFAULT '[]'
            )
        """)

        # Knowledge (facts extracted from interactions)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS knowledge (
                id TEXT PRIMARY KEY,
                fact TEXT NOT NULL,
                category TEXT DEFAULT 'general',
                confidence REAL DEFAULT 0.5,
                user_id TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)

        # FTS5 for full-text search on content and interactions
        try:
            cur.execute("""
                CREATE VIRTUAL TABLE IF NOT EXISTS content_fts
                USING fts5(title, body, tags, content='content', content_rowid='rowid')
            """)
            cur.execute("""
                CREATE VIRTUAL TABLE IF NOT EXISTS interactions_fts
                USING fts5(user_id, action, agent_cot,
                          content='interactions', content_rowid='rowid')
            """)
        except Exception:
            pass  # FTS5 might not be available, fall back to LIKE

        # Indexes
        cur.execute(
            "CREATE INDEX IF NOT EXISTS idx_interactions_user ON interactions(user_id, timestamp DESC)"
        )
        cur.execute(
            "CREATE INDEX IF NOT EXISTS idx_interactions_content ON interactions(content_id)"
        )
        cur.execute(
            "CREATE INDEX IF NOT EXISTS idx_interactions_reward ON interactions(reward DESC)"
        )
        cur.execute(
            "CREATE INDEX IF NOT EXISTS idx_content_category ON content(category)"
        )
        cur.execute(
            "CREATE INDEX IF NOT EXISTS idx_knowledge_user ON knowledge(user_id)"
        )

        self.conn.commit()

    # ── User Operations ──

    def upsert_user(
        self, user_id: str, name: str = "", interests: list = None, goals: list = None
    ) -> dict:
        existing = self.conn.execute(
            "SELECT * FROM users WHERE id = ?", (user_id,)
        ).fetchone()

        if existing:
            self.conn.execute(
                """UPDATE users SET name = COALESCE(NULLIF(?,''), name),
                   interests = ?, learning_goals = ? WHERE id = ?""",
                (name, json.dumps(interests or []), json.dumps(goals or []), user_id),
            )
        else:
            self.conn.execute(
                "INSERT INTO users (id, name, interests, learning_goals) VALUES (?,?,?,?)",
                (user_id, name, json.dumps(interests or []), json.dumps(goals or [])),
            )
        self.conn.commit()
        return self.get_user(user_id)

    def get_user(self, user_id: str) -> Optional[dict]:
        row = self.conn.execute(
            "SELECT * FROM users WHERE id = ?", (user_id,)
        ).fetchone()
        return dict(row) if row else None

    # ── Content Operations ──

    def add_content(
        self,
        content_id: str,
        title: str,
        body: str,
        category: str = "general",
        tags: list = None,
        difficulty: float = 0.5,
        source: str = "",
    ) -> dict:
        self.conn.execute(
            """INSERT OR REPLACE INTO content
               (id, title, body, category, tags, difficulty, source)
               VALUES (?,?,?,?,?,?,?)""",
            (
                content_id,
                title,
                body,
                category,
                json.dumps(tags or []),
                difficulty,
                source,
            ),
        )
        self.conn.commit()
        return self.get_content(content_id)

    def get_content(self, content_id: str) -> Optional[dict]:
        row = self.conn.execute(
            "SELECT * FROM content WHERE id = ?", (content_id,)
        ).fetchone()
        return dict(row) if row else None

    def search_content_fts(self, query: str, limit: int = 10):
        """Full-text search on content."""
        try:
            rows = self.conn.execute(
                """SELECT c.* FROM content_fts f
                   JOIN content c ON f.rowid = c.rowid
                   WHERE content_fts MATCH ?
                   ORDER BY c.engagement_count DESC LIMIT ?""",
                (query, limit),
            ).fetchall()
            if rows:
                return [dict(r) for r in rows]
        except Exception:
            pass

        pattern = f"%{query}%"
        rows = self.conn.execute(
            """SELECT * FROM content
               WHERE title LIKE ? OR body LIKE ? OR category LIKE ?
               ORDER BY engagement_count DESC LIMIT ?""",
            (pattern, pattern, pattern, limit),
        ).fetchall()
        return [dict(r) for r in rows]

    def search_content_semantic(self, query: str, limit: int = 10) -> list:
        """Semantic search using brute-force n-gram embedding similarity.

        Computes the query embedding, then cosine-similarity against every
        content item's embedding. Suitable for up to ~10K items; beyond that,
        switch to an ANN index (FAISS, pgvector, etc.).
        """
        query_vec = _simple_embed(query, dim=128)

        rows = self.conn.execute("SELECT * FROM content").fetchall()
        if not rows:
            return []

        scored = []
        for row in rows:
            content = dict(row)
            content_text = (
                f"{content.get('title', '')} {content.get('body', '')} "
                f"{content.get('category', '')} {content.get('tags', '')}"
            )
            content_vec = _simple_embed(content_text, dim=128)
            sim = float(np.dot(query_vec, content_vec))
            content["_similarity"] = round(sim, 4)
            scored.append(content)

        scored.sort(key=lambda x: x["_similarity"], reverse=True)
        top = scored[:limit]

        # Fall back to FTS if similarity scores are all negligible
        if not top or all(c["_similarity"] < 0.05 for c in top):
            return self.search_content_fts(query, limit)

        return top

    # ── Interactions (Episodic Memory) ──

    def record_interaction(
        self,
        user_id: str,
        content_id: str,
        action: str,
        dwell_time: float = 0.0,
        rating: float = 0.0,
        reward: float = 0.0,
        agent_cot: str = "",
    ) -> str:
        """Record a user-content interaction with reward signal."""
        ix_id = hashlib.sha256(
            f"{user_id}{content_id}{datetime.datetime.now().isoformat()}".encode()
        ).hexdigest()[:16]

        self.conn.execute(
            """INSERT INTO interactions
               (id, user_id, content_id, action, dwell_time, rating, reward, agent_cot)
               VALUES (?,?,?,?,?,?,?,?)""",
            (ix_id, user_id, content_id, action, dwell_time, rating, reward, agent_cot),
        )
        self.conn.commit()

        # Update content engagement stats
        self.conn.execute(
            """UPDATE content SET
               engagement_count = engagement_count + 1,
               avg_rating = (avg_rating * engagement_count + ?) / (engagement_count + 1)
               WHERE id = ?""",
            (rating, content_id),
        )
        self.conn.commit()

        return ix_id

    def get_user_history(self, user_id: str, limit: int = 50) -> list:
        """Get a user's interaction history, ordered by recency."""
        rows = self.conn.execute(
            """SELECT i.*, c.title, c.category, c.tags, c.difficulty
               FROM interactions i
               JOIN content c ON i.content_id = c.id
               WHERE i.user_id = ?
               ORDER BY i.timestamp DESC LIMIT ?""",
            (user_id, limit),
        ).fetchall()
        return [dict(r) for r in rows]

    def get_user_preference_vector(self, user_id: str) -> np.ndarray:
        """Build a preference vector from user's interaction history."""
        history = self.get_user_history(user_id, limit=100)
        if not history:
            return np.zeros(128, dtype=np.float32)

        vec = np.zeros(128, dtype=np.float32)
        total_weight = 0.0

        for ix in history:
            content_text = (
                f"{ix['title']} {ix.get('category', '')} {ix.get('tags', '')}"
            )
            content_vec = _simple_embed(content_text, dim=128)

            # Weight by reward and recency
            weight = max(0, ix["reward"]) * 0.5
            if "timestamp" in ix:
                try:
                    age_hours = (
                        datetime.datetime.now()
                        - datetime.datetime.strptime(
                            ix["timestamp"], "%Y-%m-%d %H:%M:%S"
                        )
                    ).total_seconds() / 3600
                    weight *= math.exp(-age_hours / 72)  # 3-day half-life
                except:
                    pass

            vec += content_vec * weight
            total_weight += weight

        if total_weight > 0:
            vec /= total_weight
            norm = np.linalg.norm(vec)
            if norm > 0:
                vec /= norm

        return vec

    # ── Exemplars (Procedural Memory / Policy) ──

    def update_exemplar(self, user_pattern: str, content_pattern: str, reward: float):
        """RL update: adjust exemplar scores based on reward."""
        eid = hashlib.md5(f"{user_pattern}:{content_pattern}".encode()).hexdigest()[:12]
        ex = self.conn.execute(
            "SELECT * FROM exemplars WHERE id = ?", (eid,)
        ).fetchone()

        if not ex:
            self.conn.execute(
                """INSERT INTO exemplars (id, user_pattern, content_pattern,
                   success_rate, avg_reward, usage_count)
                   VALUES (?,?,?,?,?,1)""",
                (eid, user_pattern, content_pattern, 0.5, reward),
            )
        else:
            usage = ex["usage_count"] + 1
            alpha = 1.0 / min(usage, 20)
            new_avg = (1 - alpha) * ex["avg_reward"] + alpha * reward
            new_sr = 1.0 / (1.0 + math.exp(-new_avg))  # sigmoid

            self.conn.execute(
                """UPDATE exemplars SET usage_count=?, avg_reward=?,
                   success_rate=?, last_used=datetime('now') WHERE id=?""",
                (usage, new_avg, new_sr, eid),
            )

        self.conn.commit()

    def get_best_exemplars(self, user_id: str = None, limit: int = 10) -> list:
        rows = []
        if user_id:
            rows = self.conn.execute(
                """SELECT * FROM exemplars
                   WHERE user_pattern LIKE ?
                   ORDER BY success_rate DESC, usage_count DESC LIMIT ?""",
                (f"%{user_id[:8]}%", limit),
            ).fetchall()
        if not rows:
            rows = self.conn.execute(
                "SELECT * FROM exemplars ORDER BY success_rate DESC LIMIT ?", (limit,)
            ).fetchall()
        return [dict(r) for r in rows]

    # ── Knowledge ──

    def store_knowledge(
        self,
        fact: str,
        category: str = "general",
        confidence: float = 0.5,
        user_id: str = None,
    ):
        kid = hashlib.md5(fact.encode()).hexdigest()[:12]
        self.conn.execute(
            "INSERT OR REPLACE INTO knowledge (id, fact, category, confidence, user_id) VALUES (?,?,?,?,?)",
            (kid, fact, category, confidence, user_id),
        )
        self.conn.commit()
        return kid

    def query_knowledge(
        self, query: str, category: str = None, limit: int = 10
    ) -> list:
        if category:
            rows = self.conn.execute(
                "SELECT * FROM knowledge WHERE fact LIKE ? AND category = ? ORDER BY confidence DESC LIMIT ?",
                (f"%{query}%", category, limit),
            ).fetchall()
        else:
            rows = self.conn.execute(
                "SELECT * FROM knowledge WHERE fact LIKE ? ORDER BY confidence DESC LIMIT ?",
                (f"%{query}%", limit),
            ).fetchall()
        return [dict(r) for r in rows]

    # ── Stats ──

    def get_stats(self) -> dict:
        return {
            "users": self.conn.execute("SELECT COUNT(*) FROM users").fetchone()[0],
            "content": self.conn.execute("SELECT COUNT(*) FROM content").fetchone()[0],
            "interactions": self.conn.execute(
                "SELECT COUNT(*) FROM interactions"
            ).fetchone()[0],
            "exemplars": self.conn.execute("SELECT COUNT(*) FROM exemplars").fetchone()[
                0
            ],
            "knowledge": self.conn.execute("SELECT COUNT(*) FROM knowledge").fetchone()[
                0
            ],
            "top_categories": [
                dict(r)
                for r in self.conn.execute(
                    "SELECT category, COUNT(*) as count FROM content GROUP BY category ORDER BY count DESC LIMIT 5"
                ).fetchall()
            ],
        }

    def close(self):
        self.conn.close()
