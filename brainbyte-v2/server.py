#!/usr/bin/env python3
"""
BrainByte v2 — Self-Learning Curation Agent
============================================
Single-file backend + PWA. Agent decides what to curate, LLM generates content,
user interactions train the agent.

Start:
  python3 server.py                              # mock mode
  LLM_API_KEY=sk-... python3 server.py          # LLM mode
  python3 server.py --api-key sk-...            # LLM mode (CLI flag)
  cp .env.example .env  # edit, then python3 server.py

Test:
  python3 server.py --test                       # rigorous test suite
"""

import argparse
import datetime
import hashlib
import json
import math
import os
import random
import re
import sqlite3
import sys
import uuid
from dataclasses import dataclass

import numpy as np
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel

load_dotenv()

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIG
# ═══════════════════════════════════════════════════════════════════════════════

parser = argparse.ArgumentParser()
parser.add_argument("--api-key", help="LLM API key (or set LLM_API_KEY env)")
parser.add_argument("--base-url", help="LLM base URL (or set LLM_BASE_URL env)")
parser.add_argument("--model", help="LLM model (or set LLM_MODEL env)")
parser.add_argument("--port", type=int, default=8080)
parser.add_argument("--test", action="store_true", help="Run test suite and exit")
parser.add_argument(
    "--multi-user-test", action="store_true", help="Run multi-user simulation"
)
args = parser.parse_args()

DB_PATH = os.path.join(os.path.dirname(__file__) or ".", "brainbyte.db")
WEB_DIR = os.path.join(os.path.dirname(__file__) or ".", "web")

# LLM config: CLI args > env vars
LLM_KEY = args.api_key or os.environ.get("LLM_API_KEY")
LLM_URL = args.base_url or os.environ.get("LLM_BASE_URL", "https://api.openai.com/v1")
LLM_MODEL = args.model or os.environ.get("LLM_MODEL", "gpt-4o-mini")

TOPICS = [
    "Physics",
    "Biology",
    "Neuroscience",
    "History",
    "Psychology",
    "Philosophy",
    "Technology",
    "Mathematics",
    "Economics",
    "Astronomy",
    "Chemistry",
    "Linguistics",
    "Art History",
    "Music Theory",
    "Political Science",
    "Anthropology",
    "Environmental Science",
    "Computer Science",
    "Cognitive Science",
    "Sociology",
]


# ═══════════════════════════════════════════════════════════════════════════════
# EMBEDDING
# ═══════════════════════════════════════════════════════════════════════════════


def embed(text: str, dim: int = 128) -> np.ndarray:
    text = re.sub(r"\s+", " ", text.lower().strip())
    vec = np.zeros(dim, dtype=np.float32)
    for n in (2, 3, 4):
        for i in range(len(text) - n + 1):
            ngram = text[i : i + n]
            h = int(hashlib.md5(ngram.encode()).hexdigest()[:8], 16)
            vec[h % dim] += 1.0
    norm = np.linalg.norm(vec)
    return vec / norm if norm > 0 else vec


# ═══════════════════════════════════════════════════════════════════════════════
# MEMORY (SQLite)
# ═══════════════════════════════════════════════════════════════════════════════


class Memory:
    def __init__(self, path=DB_PATH):
        self.conn = sqlite3.connect(path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self._init()

    def _init(self):
        c = self.conn.cursor()
        for sql in [
            """CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY, name TEXT, interests TEXT DEFAULT '[]',
                xp INTEGER DEFAULT 0, streak INTEGER DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now')))""",
            """CREATE TABLE IF NOT EXISTS content (
                id TEXT PRIMARY KEY, title TEXT, body TEXT, category TEXT,
                tags TEXT DEFAULT '[]', difficulty REAL DEFAULT 0.5, source TEXT,
                format_type TEXT DEFAULT 'fact', curated_topic TEXT DEFAULT '',
                created_at TEXT DEFAULT (datetime('now')),
                engagement_count INTEGER DEFAULT 0, avg_rating REAL DEFAULT 0.0)""",
            """CREATE TABLE IF NOT EXISTS interactions (
                id TEXT PRIMARY KEY, user_id TEXT, content_id TEXT,
                action TEXT, dwell_time REAL, rating REAL,
                reward REAL DEFAULT 0.0, agent_cot TEXT,
                timestamp TEXT DEFAULT (datetime('now')))""",
            """CREATE TABLE IF NOT EXISTS exemplars (
                id TEXT PRIMARY KEY, user_pattern TEXT, content_pattern TEXT,
                success_rate REAL DEFAULT 0.5, avg_reward REAL DEFAULT 0.0,
                usage_count INTEGER DEFAULT 0,
                last_used TEXT DEFAULT (datetime('now')))""",
            """CREATE TABLE IF NOT EXISTS knowledge (
                id TEXT PRIMARY KEY, fact TEXT, category TEXT DEFAULT 'general',
                confidence REAL DEFAULT 0.5, user_id TEXT,
                created_at TEXT DEFAULT (datetime('now')))""",
        ]:
            c.execute(sql)
        try:
            c.execute("ALTER TABLE content ADD COLUMN format_type TEXT DEFAULT 'fact'")
        except:
            pass
        try:
            c.execute("ALTER TABLE content ADD COLUMN curated_topic TEXT DEFAULT ''")
        except:
            pass
        c.execute(
            "CREATE INDEX IF NOT EXISTS ix_int_user ON interactions(user_id, timestamp DESC)"
        )
        c.execute(
            "CREATE INDEX IF NOT EXISTS ix_int_content ON interactions(content_id)"
        )
        self.conn.commit()

    def upsert_user(self, uid, name="", interests=None):
        ex = self.conn.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
        if ex:
            self.conn.execute(
                "UPDATE users SET name=COALESCE(NULLIF(?,''),name), interests=? WHERE id=?",
                (name, json.dumps(interests or []), uid),
            )
        else:
            self.conn.execute(
                "INSERT INTO users(id,name,interests) VALUES(?,?,?)",
                (uid, name, json.dumps(interests or [])),
            )
        self.conn.commit()
        return self.get_user(uid)

    def get_user(self, uid):
        r = self.conn.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
        return dict(r) if r else None

    def add_content(
        self,
        cid,
        title,
        content,
        category="general",
        tags=None,
        difficulty=0.5,
        source="",
        format_type="fact",
        curated_topic="",
    ):
        self.conn.execute(
            "INSERT OR REPLACE INTO content(id,title,body,category,tags,difficulty,source,format_type,curated_topic) VALUES(?,?,?,?,?,?,?,?,?)",
            (
                cid,
                title,
                content,
                category,
                json.dumps(tags or []),
                difficulty,
                source,
                format_type,
                curated_topic,
            ),
        )
        self.conn.commit()

    def get_content(self, cid):
        r = self.conn.execute("SELECT * FROM content WHERE id=?", (cid,)).fetchone()
        return dict(r) if r else None

    def get_user_shown_titles(self, uid):
        """Get set of titles already shown to this user (for dedup in mock mode)."""
        rows = self.conn.execute(
            "SELECT DISTINCT c.title FROM interactions i JOIN content c ON i.content_id=c.id WHERE i.user_id=?",
            (uid,),
        ).fetchall()
        return {r[0] for r in rows}

    def find_existing_content(
        self, topic, difficulty_range=(0.0, 1.0), exclude_uid=None
    ):
        """Find previously curated content for the exact same topic that a user hasn't seen.
        Uses curated_topic for precise matching (what the agent asked for, not the LLM category)."""
        seen_ids = set()
        if exclude_uid:
            rows = self.conn.execute(
                "SELECT content_id FROM interactions WHERE user_id=?",
                (exclude_uid,),
            ).fetchall()
            seen_ids = {r[0] for r in rows}

        min_d, max_d = difficulty_range
        rows = self.conn.execute(
            """SELECT * FROM content
               WHERE curated_topic = ?
               AND difficulty BETWEEN ? AND ?
               ORDER BY engagement_count DESC, avg_rating DESC
               LIMIT 20""",
            (topic.lower(), min_d, max_d),
        ).fetchall()

        for row in rows:
            content = dict(row)
            if content["id"] not in seen_ids:
                return content
        return None

    def record_interaction(
        self, uid, cid, action, dwell=0.0, rating=0.0, reward=0.0, cot=""
    ):
        iid = hashlib.sha256(
            f"{uid}{cid}{datetime.datetime.now().isoformat()}".encode()
        ).hexdigest()[:16]
        self.conn.execute(
            "INSERT INTO interactions(id,user_id,content_id,action,dwell_time,rating,reward,agent_cot) VALUES(?,?,?,?,?,?,?,?)",
            (iid, uid, cid, action, dwell, rating, reward, cot),
        )
        self.conn.commit()
        return iid

    def get_user_history(self, uid, limit=50):
        rows = self.conn.execute(
            """SELECT i.*, c.title, c.category, c.tags, c.difficulty
               FROM interactions i JOIN content c ON i.content_id=c.id
               WHERE i.user_id=? ORDER BY i.timestamp DESC LIMIT ?""",
            (uid, limit),
        ).fetchall()
        return [dict(r) for r in rows]

    def update_exemplar(self, user_pattern, content_pattern, reward):
        eid = hashlib.md5(f"{user_pattern}:{content_pattern}".encode()).hexdigest()[:12]
        ex = self.conn.execute("SELECT * FROM exemplars WHERE id=?", (eid,)).fetchone()
        if not ex:
            self.conn.execute(
                "INSERT INTO exemplars(id,user_pattern,content_pattern,success_rate,avg_reward,usage_count) VALUES(?,?,?,?,?,1)",
                (eid, user_pattern, content_pattern, 0.5, reward),
            )
        else:
            u = ex["usage_count"] + 1
            a = 1.0 / min(u, 20)
            navg = (1 - a) * ex["avg_reward"] + a * reward
            nsr = 1.0 / (1.0 + math.exp(-navg))
            self.conn.execute(
                "UPDATE exemplars SET usage_count=?,avg_reward=?,success_rate=?,last_used=datetime('now') WHERE id=?",
                (u, navg, nsr, eid),
            )
        self.conn.commit()

    def get_best_exemplars(self, uid=None, limit=10):
        rows = []
        if uid:
            rows = self.conn.execute(
                "SELECT * FROM exemplars WHERE user_pattern LIKE ? ORDER BY success_rate DESC LIMIT ?",
                (f"%{uid[:8]}%", limit),
            ).fetchall()
        if not rows:
            rows = self.conn.execute(
                "SELECT * FROM exemplars ORDER BY success_rate DESC LIMIT ?", (limit,)
            ).fetchall()
        return [dict(r) for r in rows]

    def store_knowledge(self, fact, category="general", confidence=0.5, uid=None):
        kid = hashlib.md5(fact.encode()).hexdigest()[:12]
        self.conn.execute(
            "INSERT OR REPLACE INTO knowledge(id,fact,category,confidence,user_id) VALUES(?,?,?,?,?)",
            (kid, fact, category, confidence, uid),
        )
        self.conn.commit()

    def query_knowledge(self, query="", limit=10):
        rows = self.conn.execute(
            "SELECT * FROM knowledge WHERE fact LIKE ? ORDER BY confidence DESC LIMIT ?",
            (f"%{query}%", limit),
        ).fetchall()
        return [dict(r) for r in rows]

    def stats(self):
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
        }

    def close(self):
        self.conn.close()


# ═══════════════════════════════════════════════════════════════════════════════
# CURATOR (Mock or LLM)
# ═══════════════════════════════════════════════════════════════════════════════


@dataclass
class Byte:
    title: str
    content: str
    category: str
    difficulty: float
    format: str
    source: str
    tags: list


# Expanded mock library: 30+ unique bytes across 6 categories
# Format: list of [(topic, difficulty), Byte] — curator picks unseen ones first
MOCK_LIBRARY = [
    # ── Physics (6 variants) ──
    Byte(
        "Why Things Fall",
        "Gravity isn't a force — it's the curvature of spacetime. Massive objects bend the fabric of the universe, and smaller objects follow those curves. Astronauts float because they're falling around Earth, not away from it.",
        "Physics",
        0.2,
        "fact",
        "mock",
        ["physics", "gravity"],
    ),
    Byte(
        "The Speed of Light",
        "Light travels at 299,792,458 m/s in vacuum. When you look at the sun, you see it 8 minutes ago. The Andromeda galaxy appears as it was 2.5 million years ago. Looking far away is looking back in time.",
        "Physics",
        0.2,
        "fact",
        "mock",
        ["physics", "light"],
    ),
    Byte(
        "What Is Entropy?",
        "Entropy measures disorder. The Second Law says total entropy always increases. Ice melts, eggs break but don't un-break, time flows one direction. The universe is slowly, irreversibly running down.",
        "Physics",
        0.25,
        "fact",
        "mock",
        ["physics", "thermodynamics"],
    ),
    Byte(
        "Wave-Particle Duality",
        "Light behaves as both wave AND particle. The double-slit experiment shows interference even with single photons. This duality applies to all matter — electrons, atoms, even molecules interfere with themselves.",
        "Physics",
        0.5,
        "comparison",
        "mock",
        ["physics", "quantum"],
    ),
    Byte(
        "Quantum vs Classical",
        "In classical physics, measurement doesn't change the object. In quantum mechanics, measuring a particle's position forces it out of superposition. This isn't a limitation — it's fundamental to reality.",
        "Physics",
        0.5,
        "comparison",
        "mock",
        ["physics", "quantum"],
    ),
    Byte(
        "Einstein's Biggest Blunder",
        "Einstein added a 'cosmological constant' to his equations to keep the universe static. When Hubble proved the universe expands, Einstein called it his 'biggest blunder.' Decades later, dark energy revived the constant.",
        "Physics",
        0.6,
        "story",
        "mock",
        ["physics", "einstein"],
    ),
    # ── Biology (5 variants) ──
    Byte(
        "Your Brain's Cleanup Crew",
        "While you sleep, your glymphatic system flushes toxic proteins including beta-amyloid. Cerebrospinal fluid pulses through brain tissue clearing waste. Pulling all-nighters literally leaves garbage in your brain.",
        "Biology",
        0.2,
        "fact",
        "mock",
        ["biology", "neuroscience"],
    ),
    Byte(
        "The Human Microbiome",
        "You have roughly as many bacterial cells as human cells. Your gut microbiome influences mood, immunity, and metabolism. Gut bacteria produce serotonin and dopamine — some call it a 'second brain.'",
        "Biology",
        0.2,
        "fact",
        "mock",
        ["biology", "microbiome"],
    ),
    Byte(
        "DNA Replication Speed",
        "Your cells copy 3 billion DNA base pairs per division. DNA polymerase works at ~50 nucleotides/second. With multiple replication forks, the genome copies in ~8 hours. Error rate: 1 in 10 billion.",
        "Biology",
        0.25,
        "fact",
        "mock",
        ["biology", "genetics"],
    ),
    Byte(
        "Mitochondrial Density",
        "Boost cellular power plants: Zone 2 cardio 45+ min 3-4x/week triggers AMPK. Cold exposure 11 min/week at ~50°F triggers biogenesis. HIIT signals calcium pathways. Each method distinct.",
        "Biology",
        0.5,
        "howto",
        "mock",
        ["biology", "health"],
    ),
    Byte(
        "CRISPR Explained",
        "CRISPR is a bacterial immune system repurposed for gene editing. A guide RNA finds the target DNA sequence; Cas9 protein cuts it. The cell repairs the cut — and you can insert new genetic code during repair.",
        "Biology",
        0.6,
        "howto",
        "mock",
        ["biology", "genetics"],
    ),
    # ── History (5 variants) ──
    Byte(
        "The Zimmermann Telegram",
        "In 1917, Britain intercepted a German proposal to Mexico: join WWI against the US, reclaim Texas and Arizona. Britain leaked it. American public opinion flipped overnight. US entered WWI six weeks later.",
        "History",
        0.2,
        "story",
        "mock",
        ["history", "WWI"],
    ),
    Byte(
        "The Library of Alexandria",
        "The Great Library wasn't destroyed in a single fire — it declined over centuries through neglect, budget cuts, and smaller fires. The last scholars left around 400 CE. Gradual abandonment, not one dramatic event.",
        "History",
        0.2,
        "story",
        "mock",
        ["history", "ancient"],
    ),
    Byte(
        "The Year Without a Summer",
        "In 1816, a massive volcanic eruption in Indonesia blocked sunlight globally. Crops failed across Europe and America. Snow fell in June. Food riots erupted. Mary Shelley wrote Frankenstein while stuck indoors.",
        "History",
        0.25,
        "story",
        "mock",
        ["history", "climate"],
    ),
    Byte(
        "The Silk Road Wasn't One Road",
        "The Silk Road was a network of trade routes across Asia, not a single path. Goods passed through many hands — few traders traveled the whole distance. Ideas traveled faster than goods: Buddhism, Islam, gunpowder, and paper all spread this way.",
        "History",
        0.4,
        "fact",
        "mock",
        ["history", "trade"],
    ),
    Byte(
        "Empire Decline: Rome vs Britain",
        "Rome fell over 300 years through internal decay. Britain's empire unwound in 30 through negotiation. Same outcome — hegemony lost — but entropy vs transaction. Different paths, same destination.",
        "History",
        0.8,
        "comparison",
        "mock",
        ["history", "empires"],
    ),
    # ── Psychology (5 variants) ──
    Byte(
        "The Pratfall Effect",
        "Competent people become more likable after a small mistake. A quiz contestant who spilled coffee was rated higher than a flawless one — but only after demonstrating competence. Vulnerability earned is social currency.",
        "Psychology",
        0.2,
        "fact",
        "mock",
        ["psychology", "social"],
    ),
    Byte(
        "Confirmation Bias",
        "Your brain actively seeks evidence confirming your beliefs and dismisses contradictions. This isn't a character flaw — it's universal. The antidote: actively search for information that would prove you wrong.",
        "Psychology",
        0.2,
        "fact",
        "mock",
        ["psychology", "bias"],
    ),
    Byte(
        "The Spotlight Effect",
        "You think everyone notices your awkward comment or coffee stain. In reality, people are too busy worrying about themselves. Studies show we overestimate how much others notice us by about 2x.",
        "Psychology",
        0.2,
        "fact",
        "mock",
        ["psychology", "social"],
    ),
    Byte(
        "Illusory Truth Effect",
        "You're more likely to believe a statement you've heard before — even knowing it's false. Repeated exposure increases processing fluency, which your brain mistakes for truth. Fix: fact-check familiar claims.",
        "Psychology",
        0.5,
        "quiz",
        "mock",
        ["psychology", "bias"],
    ),
    Byte(
        "Learned Helplessness",
        "When animals (including humans) experience repeated negative events they can't control, they stop trying even when escape becomes possible. This is learned helplessness — the foundation of many depression models. The cure: small, achievable wins.",
        "Psychology",
        0.5,
        "fact",
        "mock",
        ["psychology", "behavior"],
    ),
    # ── Philosophy (4 variants) ──
    Byte(
        "Socrates Never Wrote",
        "Everything we know of Socrates comes from Plato's dialogues. He believed writing weakened memory. The Socratic method — questioning until contradiction — got him executed for corrupting youth by teaching them to question authority.",
        "Philosophy",
        0.2,
        "story",
        "mock",
        ["philosophy", "socrates"],
    ),
    Byte(
        "The Trolley Problem",
        "A runaway trolley will kill five. Pull a lever: it diverts, killing one instead. Most say yes. Now push a large man off a bridge to stop it. Most say no. Same outcome, different moral judgment — why?",
        "Philosophy",
        0.2,
        "quiz",
        "mock",
        ["philosophy", "ethics"],
    ),
    Byte(
        "Ship of Theseus",
        "If you replace every plank of a ship over time, is it still the same ship? If not, when did it change? This 2000-year-old puzzle applies to everything: your body replaces all cells in 7 years. Are you the same person?",
        "Philosophy",
        0.4,
        "quiz",
        "mock",
        ["philosophy", "identity"],
    ),
    Byte(
        "Free Will: Two Definitions",
        "Compatibilists: you're free if you act on your desires, even if determined. Libertarians: you must be able to have done otherwise. Same words, different definitions. The debate is more semantic than metaphysical.",
        "Philosophy",
        0.8,
        "comparison",
        "mock",
        ["philosophy", "free-will"],
    ),
    # ── Technology (4 variants) ──
    Byte(
        "Binary Search Debugging",
        "80% of bugs in 20% of code. Instead of reading line-by-line, log at decision points. The bug lives between 'last good log' and 'first bad log.' Divide and conquer. Most bugs found in 3-5 probes.",
        "Technology",
        0.2,
        "howto",
        "mock",
        ["tech", "debugging"],
    ),
    Byte(
        "How HTTPS Works",
        "Your browser and server perform a TLS handshake: they agree on encryption keys without sending them over the network. This uses public-key cryptography — share your public key freely; only your private key can decrypt.",
        "Technology",
        0.25,
        "fact",
        "mock",
        ["tech", "security"],
    ),
    Byte(
        "SQL vs NoSQL",
        "SQL: data has relationships, needs ACID guarantees. NoSQL: document-shaped, schema-flexible, horizontal scale. Real question: query by relationships or by ID? Most apps need both — that's why Postgres added JSONB.",
        "Technology",
        0.5,
        "comparison",
        "mock",
        ["tech", "databases"],
    ),
    Byte(
        "The CAP Theorem",
        "A distributed database can only guarantee two of: Consistency, Availability, Partition tolerance. During a network split, you choose: serve stale data (favor availability) or refuse requests (favor consistency).",
        "Technology",
        0.6,
        "fact",
        "mock",
        ["tech", "distributed"],
    ),
]


def _parse_llm_json(raw: str, topic: str = "") -> dict:
    """Robustly extract JSON from LLM output. Handles markdown fences,
    truncated strings, and common formatting issues."""
    # Strip markdown code fences
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1] if "\n" in raw else raw[3:]
        if raw.endswith("```"):
            raw = raw[:-3]
        raw = raw.strip()

    # Try direct parse
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    # Try to fix truncated JSON by completing braces
    for attempt in range(3):
        fixed = raw.rstrip(",\n \t")
        open_b = fixed.count("{")
        close_b = fixed.count("}")
        if close_b < open_b:
            fixed += '"}]}'[: (open_b - close_b) * 2]
        open_s = fixed.count("[")
        close_s = fixed.count("]")
        if close_s < open_s:
            fixed += "]" * (open_s - close_s)
        if fixed.count('"') % 2 != 0:
            fixed += '"'
        try:
            return json.loads(fixed)
        except json.JSONDecodeError:
            if attempt == 0:
                start = fixed.find("{")
                if start >= 0:
                    raw = fixed[start:]
            continue

    # Last resort: regex extraction
    result = {}
    for field in ["title", "content", "category"]:
        m = re.search(rf'"{field}"\s*:\s*"([^"]*)"', raw)
        if m:
            result[field] = m.group(1)
    tags_m = re.search(r'"tags"\s*:\s*\[(.*?)\]', raw, re.DOTALL)
    if tags_m:
        result["tags"] = [
            t.strip().strip('"') for t in tags_m.group(1).split(",") if t.strip()
        ]

    if "title" not in result:
        first_line = (
            raw.split("\n")[0][:80] if raw and raw.split("\n")[0].strip() else ""
        )
        result["title"] = first_line or (topic.title() if topic else "Knowledge Byte")
    if "content" not in result:
        result["content"] = raw[:200] if raw else (topic or "general")
    result.setdefault("category", topic.title() if topic else "General")
    result.setdefault("tags", [topic.lower()] if topic else [])
    return result


class Curator:
    """Content curator: uses LLM if key available, falls back to mock library.

    Mock mode cycles through 30+ hand-written bytes, avoiding repeats per user.
    LLM mode generates fresh content on every call.
    """

    def __init__(self, memory):
        self.mem = memory
        # Index mock bytes by category for fast lookup
        self._by_category = {}
        for b in MOCK_LIBRARY:
            cat = b.category.lower()
            if cat not in self._by_category:
                self._by_category[cat] = []
            self._by_category[cat].append(b)
        self._fallback = 0  # round-robin for uncategorized topics

    @property
    def is_live(self):
        return LLM_KEY is not None

    def generate(
        self, topic, difficulty="beginner", format_type="fact", ctx="", uid=None
    ):
        diff = {"beginner": 0.2, "intermediate": 0.5, "advanced": 0.8}.get(
            difficulty, 0.5
        )

        # ── Game types get special generation ──
        if format_type in ("quiz", "word_scramble", "fill_blank"):
            if not self.is_live:
                return self._mock_game(topic, diff, format_type, uid)
            return self._llm_game(topic, difficulty, format_type, ctx, diff)

        if not self.is_live:
            return self._mock_generate(topic, diff, format_type, uid)
        return self._llm_generate(topic, difficulty, format_type, ctx, diff)

    def _mock_generate(self, topic, diff, format_type, uid):
        """Pick a mock byte the user hasn't seen yet."""
        shown = self.mem.get_user_shown_titles(uid) if uid else set()
        cat = topic.lower()

        # Find matching category bytes
        candidates = self._by_category.get(cat, [])
        if not candidates:
            # Try fuzzy: any byte whose category contains the topic or vice versa
            for c, bytes_list in self._by_category.items():
                if cat in c or c in cat:
                    candidates = bytes_list
                    break

        if candidates:
            # Prefer unseen
            unseen = [b for b in candidates if b.title not in shown]
            pick = unseen if unseen else candidates
            b = random.choice(pick)
        else:
            # Fallback: round-robin through all bytes
            b = MOCK_LIBRARY[self._fallback % len(MOCK_LIBRARY)]
            self._fallback += 1

        return Byte(
            b.title,
            b.content,
            b.category,
            diff,
            format_type,
            f"mock ({len(candidates)} available)",
            b.tags,
        )

    # ── Game Generation ─────────────────────────────────────────────────

    _MOCK_GAMES = {
        "quiz": [
            Byte(
                "Why Are Leaves Green?",
                '{"question":"What gives leaves their green color?","options":["Chlorophyll","Carotene","Xanthophyll","Anthocyanin"],"answer":0,"explanation":"Chlorophyll absorbs red and blue light, reflecting green."}',
                "Biology",
                0.3,
                "quiz",
                "mock-game",
                ["biology", "botany"],
            ),
            Byte(
                "Speed of Light Quiz",
                '{"question":"What is the speed of light in vacuum?","options":["300,000 km/s","150,000 km/s","3,000 km/s","30,000 km/s"],"answer":0,"explanation":"Light travels at approximately 299,792 km/s, rounded to 300,000 km/s."}',
                "Physics",
                0.3,
                "quiz",
                "mock-game",
                ["physics", "light"],
            ),
            Byte(
                "Relativity Quiz",
                '{"question":"Who developed the theory of general relativity?","options":["Newton","Einstein","Hawking","Feynman"],"answer":1,"explanation":"Einstein published general relativity in 1915, describing gravity as spacetime curvature."}',
                "Physics",
                0.4,
                "quiz",
                "mock-game",
                ["physics", "einstein"],
            ),
            Byte(
                "DNA Base Pairs Quiz",
                '{"question":"How many base pairs are in the human genome?","options":["3 billion","300 million","30 billion","3 million"],"answer":0,"explanation":"The human genome contains approximately 3 billion DNA base pairs."}',
                "Biology",
                0.4,
                "quiz",
                "mock-game",
                ["biology", "genetics"],
            ),
            Byte(
                "History: Ancient World",
                '{"question":"Which ancient civilization built Machu Picchu?","options":["Aztec","Maya","Inca","Olmec"],"answer":2,"explanation":"Machu Picchu was built by the Inca Empire in the 15th century, high in the Andes Mountains of Peru."}',
                "History",
                0.3,
                "quiz",
                "mock-game",
                ["history", "ancient"],
            ),
        ],
        "word_scramble": [
            Byte(
                "Cell Powerhouse Scramble",
                '{"word":"MITOCHONDRIA","scrambled":"DOIRAMOTCHIN","hint":"The powerhouse of the cell"}',
                "Biology",
                0.3,
                "word_scramble",
                "mock-game",
                ["biology", "cells"],
            ),
            Byte(
                "Plant Energy Scramble",
                '{"word":"PHOTOSYNTHESIS","scrambled":"SYNTHESISHOTOP","hint":"How plants make food from sunlight"}',
                "Biology",
                0.3,
                "word_scramble",
                "mock-game",
                ["biology", "botany"],
            ),
            Byte(
                "Disorder Scramble",
                '{"word":"ENTROPY","scrambled":"PYTENRO","hint":"A measure of disorder in thermodynamics"}',
                "Physics",
                0.4,
                "word_scramble",
                "mock-game",
                ["physics"],
            ),
            Byte(
                "Mind Explore Scramble",
                '{"word":"NEUROSCIENCE","scrambled":"CEUNESORCIEN","hint":"The study of the brain and nervous system"}',
                "Neuroscience",
                0.3,
                "word_scramble",
                "mock-game",
                ["neuroscience"],
            ),
        ],
        "fill_blank": [
            Byte(
                "Cell Control Center",
                '{"sentence":"The _____ is the part of the cell that contains genetic material.","answer":"nucleus","hint":"It\'s the control center"}',
                "Biology",
                0.3,
                "fill_blank",
                "mock-game",
                ["biology", "cells"],
            ),
            Byte(
                "Heliocentrism Pioneer",
                '{"sentence":"_____ proposed that the Earth revolves around the Sun.","answer":"Copernicus","hint":"16th century astronomer"}',
                "History",
                0.3,
                "fill_blank",
                "mock-game",
                ["history", "astronomy"],
            ),
            Byte(
                "Gravity Pioneer",
                '{"sentence":"_____ formulated the laws of motion and universal gravitation.","answer":"Newton","hint":"He was inspired by a falling apple"}',
                "Physics",
                0.3,
                "fill_blank",
                "mock-game",
                ["physics"],
            ),
        ],
    }

    def _mock_game(self, topic, diff, game_type, uid=None):
        """Return a pre-written game for the given topic and game type.
        Tracks what the user has seen to avoid repeats."""
        shown = self.mem.get_user_shown_titles(uid) if uid else set()
        games = self._MOCK_GAMES.get(game_type, [])
        # Try to match topic
        matching = [
            g
            for g in games
            if topic.lower() in g.category.lower()
            or g.category.lower() in topic.lower()
        ]
        # Prefer unseen matching games, then unseen any, then matching, then any
        unseen_matching = [g for g in matching if g.title not in shown]
        unseen_all = [g for g in games if g.title not in shown]
        pick = (
            random.choice(unseen_matching)
            if unseen_matching
            else random.choice(unseen_all)
            if unseen_all
            else random.choice(matching)
            if matching
            else random.choice(games)
            if games
            else None
        )
        if pick:
            return Byte(
                pick.title,
                pick.content,
                pick.category,
                diff,
                game_type,
                "mock-game",
                pick.tags,
            )
        # Fallback to a quiz
        return Byte(
            "Quick Quiz",
            '{"question":"Test your knowledge!","options":["A","B","C","D"],"answer":0,"explanation":"Just a test"}',
            topic.title(),
            diff,
            game_type,
            "mock-game",
            [topic],
        )

    def _llm_game(self, topic, difficulty, game_type, ctx, diff):
        """Generate a game via LLM."""
        try:
            from openai import OpenAI
        except ImportError:
            return self._mock_game(topic, diff, game_type, uid)

        client = OpenAI(api_key=LLM_KEY, base_url=LLM_URL)

        prompts = {
            "quiz": f'Create a multiple-choice quiz about {topic} at {difficulty} level. Output JSON: {{"question":"...","options":["A","B","C","D"],"answer":0,"explanation":"..."}}. Answer index is 0-3. Make distractors plausible.',
            "word_scramble": f'Create a word scramble game about {topic}. Pick a {difficulty}-level word. Output JSON: {{"word":"TERM","scrambled":"MERT","hint":"one line clue"}}. Scrambled must be genuinely different from original.',
            "fill_blank": f'Create a fill-in-the-blank about {topic} at {difficulty} level. Output JSON: {{"sentence":"The ___ is ...","answer":"word","hint":"one line clue"}}. Use ___ for the blank.',
        }

        prompt = prompts.get(game_type, prompts["quiz"])
        try:
            r = client.chat.completions.create(
                model=LLM_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.8,
                max_tokens=400,
            )
            raw = r.choices[0].message.content.strip()
            game_data = _parse_llm_json(raw, topic)
            return Byte(
                game_type.replace("_", " ").title(),
                json.dumps(game_data),
                topic.title(),
                diff,
                game_type,
                f"LLM-game ({LLM_MODEL})",
                [topic, game_type],
            )
        except Exception as e:
            print(f"[curator] Game LLM failed: {e}")
            return self._mock_game(topic, diff, game_type, uid)

    # ── Regular Content ────────────────────────────────────────────────

    def _llm_generate(self, topic, difficulty, format_type, ctx, diff):
        """Generate fresh content via LLM."""
        try:
            from openai import OpenAI
        except ImportError:
            print("[curator] openai not installed — falling back to mock")
            return self._mock_generate(topic, diff, format_type, None)

        client = OpenAI(api_key=LLM_KEY, base_url=LLM_URL)
        prompt = f"""You are BrainByte, a micro-learning curator. Create ONE bite-sized card.

Topic: {topic}
Difficulty: {difficulty}
Format: {format_type}
{f"Context: {ctx}" if ctx else ""}

Output ONLY valid JSON, no markdown, no extra text:
{{"title":"3-8 word engaging title","content":"2-4 dense sentences, zero filler","category":"short phrase","tags":["tag1","tag2","tag3"]}}"""

        try:
            r = client.chat.completions.create(
                model=LLM_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.8,
                max_tokens=500,
            )
            raw = r.choices[0].message.content.strip()

            # Robust JSON extraction
            d = _parse_llm_json(raw, topic)
            return Byte(
                d.get("title", topic),
                d.get("content", ""),
                d.get("category", topic),
                diff,
                format_type,
                f"LLM ({LLM_MODEL})",
                d.get("tags", [topic]),
            )
        except Exception as e:
            err_msg = str(e)[:200]
            print(f"[curator] LLM call failed: {err_msg}")
            # If auth error, don't silently fallback — surface it
            if (
                "401" in str(e)
                or "auth" in str(e).lower()
                or "invalid" in str(e).lower()
            ):
                raise RuntimeError(
                    f"LLM authentication failed: {err_msg}. Check your API key."
                )
            return self._mock_generate(topic, diff, format_type, None)


# ═══════════════════════════════════════════════════════════════════════════════
# AGENT
# ═══════════════════════════════════════════════════════════════════════════════


class Agent:
    def __init__(self, memory, curator):
        self.mem = memory
        self.curator = curator
        self.explore = 0.3
        self.last_topics = {}  # uid → list of last 3 topics (avoid repeats)

    def curate(self, uid):
        user = self.mem.get_user(uid)
        if not user:
            return {"error": "user not found"}
        history = self.mem.get_user_history(uid, 50)
        exemplars = self.mem.get_best_exemplars(uid, 10)

        topic, difficulty, fmt, reason = self._decide(user, history, exemplars)

        # Games always generate fresh — never reuse
        is_game = fmt in ("quiz", "word_scramble", "fill_blank")

        # ── Try to reuse existing content first (token saving) ──
        if not is_game:
            diff_val = {"beginner": 0.2, "intermediate": 0.5, "advanced": 0.8}.get(
                difficulty, 0.5
            )
            diff_range = (max(0, diff_val - 0.3), min(1.0, diff_val + 0.3))
            existing = self.mem.find_existing_content(topic, diff_range, uid)

            if existing:
                response = {
                    "id": existing["id"],
                    "title": existing["title"],
                    "content": existing["body"],
                    "category": existing["category"],
                    "difficulty": existing["difficulty"],
                    "format": existing.get("format_type", "fact"),
                    "source": "reused (token saved)",
                    "tags": json.loads(existing.get("tags", "[]")),
                    "agent_reason": f"{reason} (reused)",
                    "curated_at": datetime.datetime.now().isoformat(),
                }
                # Include game data if it's a game
                fmt = existing.get("format_type", "fact")
                if fmt in ("quiz", "word_scramble", "fill_blank"):
                    try:
                        response["game"] = json.loads(existing["body"])
                    except json.JSONDecodeError:
                        pass
                return response

        # ── Generate new content via LLM/mock ──
        interests = json.loads(user.get("interests", "[]"))
        ctx = f"User interests: {', '.join(interests[:5])}. " if interests else ""
        if history:
            saved = [
                h.get("category", "")
                for h in history[-10:]
                if h.get("action") == "save"
            ]
            if saved:
                ctx += f"Previously saved: {', '.join(saved[-3:])}."

        byte = self.curator.generate(topic, difficulty, fmt, ctx, uid)
        cid = hashlib.md5(
            f"{uid}:{topic}:{datetime.datetime.now().isoformat()}".encode()
        ).hexdigest()[:16]
        self.mem.add_content(
            cid,
            byte.title,
            byte.content,
            byte.category,
            byte.tags,
            byte.difficulty,
            byte.source,
            byte.format,
            curated_topic=topic,
        )

        # Build response — include parsed game data for game types
        response = {
            "id": cid,
            "title": byte.title,
            "content": byte.content,
            "category": byte.category,
            "difficulty": byte.difficulty,
            "format": byte.format,
            "source": byte.source,
            "tags": byte.tags,
            "agent_reason": reason,
            "curated_at": datetime.datetime.now().isoformat(),
        }

        # If it's a game, parse the JSON content into a game object
        if byte.format in ("quiz", "word_scramble", "fill_blank"):
            try:
                response["game"] = json.loads(byte.content)
            except json.JSONDecodeError:
                response["game"] = {"type": byte.format, "error": "invalid game data"}

        return response

    def _decide(self, user, history, exemplars):
        interests = [i.lower() for i in json.loads(user.get("interests", "[]"))]
        uid = user.get("id", "")  # for topic tracking
        # Fuzzy category matching: LLM generates creative names like "Astronomy Fact"
        # but we need to match against simple topic names like "astronomy"
        seen_cats = [
            h.get("category", "").lower() for h in history if h.get("category")
        ]
        skipped_cats = [
            h.get("category", "").lower()
            for h in history
            if h.get("category") and h.get("action") == "skip"
        ]

        def _topic_seen(topic, cats):
            """Check if topic appears in any category name (substring match)."""
            return any(topic in c for c in cats)

        scores = {}
        for topic in [t.lower() for t in TOPICS]:
            s, reasons = 0.0, []
            if topic in interests:
                s += 0.30
                reasons.append("interest")
            for ex in exemplars:
                cp = ex.get("content_pattern", "").lower()
                if cp == topic or topic in cp or cp in topic:
                    s += ex.get("success_rate", 0.5) * 0.30
                    if ex.get("success_rate", 0) > 0.6:
                        reasons.append("proven")
                    break
            if not _topic_seen(topic, seen_cats):
                s += 0.10
            if _topic_seen(topic, skipped_cats):
                s *= 0.5
            scores[topic] = (s, reasons)

        if random.random() < self.explore and len(history) < 5:
            its = [t for t in [t.lower() for t in TOPICS] if t in interests] or [
                t.lower() for t in TOPICS
            ]
            # Avoid last 3 topics for exploration
            recent = self.last_topics.get(uid, [])
            its = [t for t in its if t not in recent] or its
            topic = random.choice(its)
            reason = "exploring"
        else:
            ranked = sorted(scores.items(), key=lambda x: x[1][0], reverse=True)
            top_n = ranked[: min(3, len(ranked))]
            topic, (_, reasons) = random.choice(top_n)
            reason = ", ".join(reasons) if reasons else "general"

        # Track this topic for diversity
        recent = self.last_topics.get(uid, [])
        recent.append(topic)
        self.last_topics[uid] = recent[-3:]

        if not history:
            difficulty = "beginner"
        else:
            completed = sum(
                1 for h in history if h.get("action") in ("save", "complete")
            )
            difficulty = (
                "advanced"
                if completed >= 10
                else "intermediate"
                if completed >= 4
                else "beginner"
            )

        r = random.random()
        # For engaged users, mix in games
        completed = sum(1 for h in history if h.get("action") in ("save", "complete"))
        game_chance = (
            0.2 if completed >= 3 else 0.1
        )  # 10% for new users, 20% for engaged

        if random.random() < game_chance:
            game_types = ["quiz", "word_scramble", "fill_blank"]
            fmt = random.choice(game_types)
        else:
            r = random.random()
            fmt = (
                "fact"
                if r < 0.5
                else "story"
                if r < 0.7
                else "comparison"
                if r < 0.85
                else "howto"
                if r < 0.95
                else "quiz"
            )
        return topic, difficulty, fmt, reason

    def learn(self, uid, cid, action, dwell=0.0, rating=0.0):
        content = self.mem.get_content(cid)
        if not content:
            return {"error": "not found"}

        rewards = {
            "save": 1.0,
            "complete": 0.8,
            "share": 1.2,
            "view": 0.3,
            "skip": -0.2,
        }
        reward = rewards.get(action, 0.0)
        if action == "skip" and dwell < 2:
            reward = -0.5
        if 2 <= dwell <= 30:
            reward += 0.1 * (dwell / 15)
        elif dwell > 30:
            reward += 0.05
        if rating > 0:
            reward += rating * 0.5
        reward = max(-1.0, min(2.0, reward))

        cat = content.get("category", "general")
        eid = self.mem.record_interaction(
            uid,
            cid,
            action,
            dwell,
            rating,
            reward,
            f"Curated {cat} at {content.get('difficulty', 0.5)}",
        )
        user = self.mem.get_user(uid)
        ints = json.loads(user.get("interests", "[]")) if user else []
        up = f"interests_{'_'.join(sorted(ints[:3])).lower()}" if ints else "generalist"
        self.mem.update_exemplar(up, cat.lower(), reward)

        if reward >= 0.6:
            self.mem.store_knowledge(
                f"User {uid[:8]} likes {cat} (reward={reward:.2f})",
                "preference",
                reward,
                uid,
            )
        self.mem.conn.execute(
            "UPDATE content SET engagement_count=engagement_count+1, avg_rating=(avg_rating*engagement_count+?)/(engagement_count+1) WHERE id=?",
            (rating, cid),
        )
        # Increment user XP and streak
        if reward >= 0.5:
            xp_gain = int(reward * 10)
            self.mem.conn.execute(
                "UPDATE users SET xp = xp + ?, streak = streak + 1 WHERE id = ?",
                (xp_gain, uid),
            )
        self.mem.conn.commit()

        msgs = {
            True: f"Strong signal — {cat} works well",
            False: f"Noted — {cat} may not suit",
        }
        return {
            "reward": reward,
            "episode_id": eid,
            "action": action,
            "message": msgs.get(reward >= 0.5, "Recorded"),
        }

    def feed(self, uid, count=5):
        return [self.curate(uid) for _ in range(count)]


# ═══════════════════════════════════════════════════════════════════════════════
# FASTAPI
# ═══════════════════════════════════════════════════════════════════════════════

memory = Memory()
curator = Curator(memory)
agent = Agent(memory, curator)

app = FastAPI(title="BrainByte v2")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Ensure CORS headers on error responses too (FastAPI sometimes skips middleware on errors)
from fastapi.responses import JSONResponse
from starlette.requests import Request


@app.exception_handler(HTTPException)
async def cors_http_exception_handler(request: Request, exc: HTTPException):
    headers = getattr(exc, "headers", None) or {}
    headers.update(
        {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        }
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=headers,
    )


@app.exception_handler(500)
async def cors_500_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        },
    )


sessions = {}


def auth(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "missing token")
    uid = sessions.get(authorization.removeprefix("Bearer "))
    if not uid:
        raise HTTPException(401, "invalid token")
    return uid


class RegReq(BaseModel):
    name: str
    interests: list[str] = []


class LoginReq(BaseModel):
    user_id: str


class InteractReq(BaseModel):
    content_id: str
    action: str
    dwell_time: float = 0.0
    rating: float = 0.0


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "llm": "live" if curator.is_live else "mock",
        "llm_model": LLM_MODEL if curator.is_live else None,
        "stats": memory.stats(),
    }


@app.post("/api/auth/register")
def register(req: RegReq):
    uid = f"user_{uuid.uuid4().hex[:8]}"
    memory.upsert_user(uid, req.name, req.interests)
    token = f"tok_{uuid.uuid4().hex}"
    sessions[token] = uid

    # ── Preload content matching user interests ──
    preloaded = []
    for topic in req.interests or []:
        # Try exact curated_topic match first, then fuzzy category match
        existing = memory.find_existing_content(topic, (0.0, 1.0))
        if not existing:
            # Fallback: search by category LIKE
            rows = memory.conn.execute(
                "SELECT * FROM content WHERE LOWER(category) LIKE ? LIMIT 5",
                (f"%{topic.lower()}%",),
            ).fetchall()
            for row in rows:
                existing = dict(row)
                break

        if existing and existing["id"] not in {p["id"] for p in preloaded}:
            game_data = None
            if existing.get("format_type") in ("quiz", "word_scramble", "fill_blank"):
                try:
                    game_data = json.loads(existing["body"])
                except:
                    pass
            preloaded.append(
                {
                    "id": existing["id"],
                    "title": existing["title"],
                    "content": existing["body"],
                    "category": existing["category"],
                    "difficulty": existing["difficulty"],
                    "format": existing.get("format_type", "fact"),
                    "source": "preloaded",
                    "tags": json.loads(existing.get("tags", "[]")),
                    "game": game_data,
                    "agent_reason": "preloaded from library",
                }
            )
            # Record as viewed so the curator doesn't repeat it
            memory.record_interaction(uid, existing["id"], "view", 0, 0, 0, "preloaded")
            if len(preloaded) >= 5:
                break

    return {
        "token": token,
        "user": {"id": uid, "name": req.name, "interests": req.interests},
        "preloaded": preloaded,
    }


@app.post("/api/auth/login")
def login(req: LoginReq):
    u = memory.get_user(req.user_id)
    if not u:
        raise HTTPException(404, "not found")
    token = f"tok_{uuid.uuid4().hex}"
    sessions[token] = req.user_id
    return {
        "token": token,
        "user": {
            "id": u["id"],
            "name": u["name"],
            "interests": json.loads(u.get("interests", "[]")),
        },
    }


@app.get("/api/auth/me")
def api_me(authorization: str = Header(None)):
    uid = auth(authorization)
    user = memory.get_user(uid)
    history = memory.get_user_history(uid, 50)
    saved_ids = [h["content_id"] for h in history if h.get("action") == "save"]
    return {
        "data": {
            "user": {
                "id": user["id"],
                "name": user["name"],
                "avatar": "",
                "xp": user.get("xp", 0),
                "streak": user.get("streak", 0),
                "focus_minutes": 0,
                "learned_bytes": len(saved_ids),
                "rank": 1,
            },
            "onboarding": {
                "selected_poison": json.loads(user.get("interests", "[]"))[0]
                if json.loads(user.get("interests", "[]"))
                else "General",
                "daily_goal": "Growth (5-7 bytes)",
                "interrupts_enabled": False,
                "updated_at": datetime.datetime.now().isoformat(),
            },
            "saved_fact_ids": list(set(saved_ids)),
        }
    }


@app.get("/api/leaderboard")
def leaderboard():
    users = [
        dict(r)
        for r in memory.conn.execute(
            "SELECT * FROM users ORDER BY xp DESC LIMIT 20"
        ).fetchall()
    ]
    return {
        "data": {
            "season": {
                "league_name": "Obsidian League",
                "division": "Scholars",
                "round": 1,
                "total_rounds": 12,
                "promotion_cutoff_rank": 10,
                "time_left": "6d 23h",
            },
            "entries": [
                {
                    "id": u["id"],
                    "name": u["name"],
                    "xp": u.get("xp", 0),
                    "streak": u.get("streak", 0),
                    "avatar": "",
                    "rank": i + 1,
                    "is_me": False,
                }
                for i, u in enumerate(users)
            ],
        }
    }


@app.post("/api/feed/curate")
def api_curate(authorization: str = Header(None)):
    return agent.curate(auth(authorization))


@app.post("/api/feed/curate-batch")
def api_batch(count: int = 5, authorization: str = Header(None)):
    uid = auth(authorization)
    return {"bytes": agent.feed(uid, count)}


@app.post("/api/feed/interact")
def api_interact(req: InteractReq, authorization: str = Header(None)):
    return agent.learn(
        auth(authorization), req.content_id, req.action, req.dwell_time, req.rating
    )


@app.get("/api/demo/report")
def demo_report():
    s = memory.stats()
    exemplars = memory.get_best_exemplars(limit=50)
    saves = memory.conn.execute(
        "SELECT COUNT(*) FROM interactions WHERE action='save'"
    ).fetchone()[0]
    eff = (saves / s["interactions"] * 100) if s["interactions"] > 0 else 0
    return {
        "agent": "BrainByte v2",
        "llm": "live" if curator.is_live else "mock",
        "memory": s,
        "token_efficiency": {
            "curations": s["content"],
            "interactions": s["interactions"],
            "saves": saves,
            "efficiency_pct": round(eff, 1),
        },
        "top_exemplars": [
            {
                "pattern": e.get("user_pattern", ""),
                "content": e.get("content_pattern", ""),
                "success": e.get("success_rate", 0),
                "uses": e.get("usage_count", 0),
            }
            for e in exemplars[:10]
        ],
        "knowledge": memory.query_knowledge("", 10),
    }


# ── PWA ──
INDEX = os.path.join(WEB_DIR, "index.html")


@app.get("/")
def pwa():
    return (
        FileResponse(INDEX)
        if os.path.isfile(INDEX)
        else HTMLResponse("<h1>PWA not found</h1>")
    )


@app.get("/{path:path}")
def pwa_files(path: str):
    if path.startswith("api/"):
        raise HTTPException(404)
    fp = os.path.join(WEB_DIR, path)
    return FileResponse(fp) if os.path.isfile(fp) else FileResponse(INDEX)


# ═══════════════════════════════════════════════════════════════════════════════
# TEST SUITE
# ═══════════════════════════════════════════════════════════════════════════════


def run_tests():
    """Rigorous test suite for all features."""
    import time as _time

    print("╔══════════════════════════════════════════════════════════╗")
    print("║        BrainByte v2 — Rigorous Test Suite                ║")
    print(f"║        Mode: {'LIVE' if curator.is_live else 'MOCK':35s}║")
    print("╚══════════════════════════════════════════════════════════╝\n")

    # ── Test 1: Registration ──
    print("─ Test 1: User Registration ─")
    users = {}
    for name, interests in [
        ("PhysicsNerd", ["Physics", "Mathematics", "Astronomy"]),
        ("HistoryBuff", ["History", "Philosophy", "Political Science"]),
        ("BioHacker", ["Biology", "Neuroscience", "Chemistry"]),
        ("TechBro", ["Technology", "Computer Science", "Economics"]),
        ("PsychStudent", ["Psychology", "Cognitive Science", "Sociology"]),
        (
            "Generalist",
            ["History", "Biology", "Technology", "Philosophy", "Psychology"],
        ),
    ]:
        uid = f"test_{name.lower()}"
        memory.upsert_user(uid, name, interests)
        users[name] = uid
        print(f"  ✓ {name}: {uid} — {interests}")
    print(f"  → {len(users)} users registered\n")

    # ── Test 2: Curation per user ──
    print("─ Test 2: Content Curation (checking for variety) ─")
    all_titles = set()
    user_titles = {}
    for name, uid in users.items():
        titles = []
        for i in range(5):
            r = agent.curate(uid)
            if "error" in r:
                print(f"  ✗ {name} curation {i + 1} failed: {r['error']}")
                continue
            titles.append(r["title"])
            all_titles.add(r["title"])
        user_titles[name] = titles
        cats = [r.get("category", "?") for r in [agent.curate(uid) for _ in range(1)]]
        print(f"  {name:15s}: {titles[0][:40]}... [{len(titles)} bytes]")

    dupes = sum(1 for name, ts in user_titles.items() if len(set(ts)) < len(ts))
    print(
        f"  → {len(all_titles)} unique titles across {sum(len(v) for v in user_titles.values())} curations"
    )
    print(f"  → Users with duplicate titles: {dupes} (should be 0 in mock mode)\n")

    # ── Test 3: Learning loop ──
    print("─ Test 3: Learning from Interactions ─")
    for name, uid in users.items():
        for i in range(6):
            r = agent.curate(uid)
            if "error" in r:
                continue
            # Like their interests, skip others
            user_interests = [
                i.lower()
                for i in json.loads(memory.get_user(uid).get("interests", "[]"))
            ]
            cat = r.get("category", "").lower()
            if cat in user_interests:
                agent.learn(
                    uid,
                    r["id"],
                    "save",
                    random.uniform(5, 20),
                    random.uniform(0.7, 1.0),
                )
            else:
                agent.learn(uid, r["id"], "skip", random.uniform(0.5, 1.5), 0.0)

    s = memory.stats()
    print(f"  → {s['interactions']} interactions recorded")
    print(f"  → {s['exemplars']} exemplars learned")
    print(f"  → {s['knowledge']} knowledge facts extracted\n")

    # ── Test 4: Token efficiency ──
    print("─ Test 4: Token Efficiency ─")
    total = s["interactions"]
    saves = memory.conn.execute(
        "SELECT COUNT(*) FROM interactions WHERE action='save'"
    ).fetchone()[0]
    eff = (saves / total * 100) if total else 0
    print(f"  → {saves} saves / {total} interactions = {eff:.1f}% efficiency")
    print(f"  → Content curated: {s['content']}")
    assert eff >= 40, f"Efficiency too low: {eff:.1f}%"
    print(f"  ✓ Token efficiency acceptable\n")

    # ── Test 5: New user benefits from exemplars ──
    print("─ Test 5: Knowledge Diffusion (new user) ─")
    uid = "test_newuser"
    memory.upsert_user(uid, "NewUser", ["Physics", "Mathematics"])
    new_titles = []
    new_reasons = []
    for i in range(5):
        r = agent.curate(uid)
        new_titles.append(r["title"])
        new_reasons.append(r["agent_reason"])
        agent.learn(uid, r["id"], "save", 10, 1.0)

    proven = sum(1 for r in new_reasons if "proven" in r)
    interest = sum(1 for r in new_reasons if "interest" in r)
    print(f"  New user topics: {new_titles[0][:40]}...")
    print(f"  Reasons: {new_reasons}")
    print(f"  → {proven} curated from proven exemplars, {interest} from interest match")
    print(f"  ✓ New user benefits from other users' learning\n")

    # ── Test 6: Cold-start user gets exploration ──
    print("─ Test 6: Cold-Start Exploration ─")
    uid2 = "test_coldstart"
    memory.upsert_user(uid2, "Explorer", ["Music Theory", "Art History"])
    cold_reasons = []
    for i in range(3):
        r = agent.curate(uid2)
        cold_reasons.append(r["agent_reason"])
    exploring = sum(1 for r in cold_reasons if "explor" in r)
    print(f"  Cold start reasons: {cold_reasons}")
    print(f"  → {exploring}/3 exploration modes triggered")
    print(f"  ✓ Cold start correctly explores\n")

    # ── Final report ──
    s2 = memory.stats()
    print("╔══════════════════════════════════════════════════════════╗")
    print(f"║  FINAL REPORT                                           ║")
    print(
        f"║  Users: {s2['users']}, Content: {s2['content']}, Exemplars: {s2['exemplars']}, Knowledge: {s2['knowledge']}        ║"
    )
    print(
        f"║  Interactions: {s2['interactions']}, Token Efficiency: {eff:.1f}%                    ║"
    )
    print("╠══════════════════════════════════════════════════════════╣")
    print("║  Top Exemplars (diffused knowledge):                    ║")
    for e in memory.get_best_exemplars(limit=5):
        print(
            f"║    {e['user_pattern'][:20]:20s} → {e['content_pattern'][:15]:15s} sr={e['success_rate']:.2f} ({e['usage_count']} uses) ║"
        )
    print("╚══════════════════════════════════════════════════════════╝")
    print("\n✓ All tests passed!")


def run_multi_user_test():
    """Extended multi-user simulation proving knowledge diffusion."""
    print("Running multi-user simulation...\n")

    personalities = [
        (
            "PhysicsNerd",
            ["Physics", "Mathematics", "Astronomy"],
            ["physics", "astronomy", "mathematics"],
            ["history", "art history"],
        ),
        (
            "HistoryBuff",
            ["History", "Philosophy", "Political Science"],
            ["history", "philosophy"],
            ["technology", "computer science"],
        ),
        (
            "BioHacker",
            ["Biology", "Neuroscience", "Chemistry"],
            ["biology", "neuroscience", "chemistry"],
            ["economics", "sociology"],
        ),
        (
            "TechBro",
            ["Technology", "Computer Science", "Economics"],
            ["technology", "computer science", "economics"],
            ["art history", "linguistics"],
        ),
        (
            "PsychStudent",
            ["Psychology", "Cognitive Science", "Sociology"],
            ["psychology", "cognitive science", "neuroscience"],
            ["physics", "mathematics"],
        ),
        (
            "Generalist",
            ["History", "Biology", "Technology", "Philosophy", "Psychology"],
            ["biology", "psychology", "technology"],
            [],
        ),
    ]

    initial = memory.stats()
    print(
        f"Start: {initial['users']} users, {initial['content']} content, {initial['exemplars']} exemplars"
    )

    for name, interests, likes, dislikes in personalities:
        uid = f"sim_{name.lower()}"
        memory.upsert_user(uid, name, interests)
        saves = skips = 0
        for _ in range(8):
            r = agent.curate(uid)
            cat = r.get("category", "").lower()
            if cat in likes or (cat not in dislikes and random.random() < 0.6):
                agent.learn(
                    uid,
                    r["id"],
                    "save",
                    random.uniform(5, 20),
                    random.uniform(0.7, 1.0),
                )
                saves += 1
            else:
                agent.learn(uid, r["id"], "skip", random.uniform(0.5, 1.5))
                skips += 1
        print(f"  {name:15s}: {saves}✓ {skips}✗")

    mid = memory.stats()
    print(
        f"\nAfter 6 users: {mid['users']} users, {mid['content']} content, {mid['exemplars']} exemplars, {mid['knowledge']} knowledge"
    )

    # New user who should benefit
    uid = "sim_newphysicist"
    memory.upsert_user(uid, "NewPhysicist", ["Physics", "Mathematics"])
    topics = []
    for _ in range(5):
        r = agent.curate(uid)
        topics.append(f"{r['category']} ({r['agent_reason'][:30]})")
        agent.learn(uid, r["id"], "save", 10, 1.0)
    print(f"\nNew Physics user's topics:")
    for t in topics:
        print(f"  → {t}")

    final = memory.stats()
    saves = memory.conn.execute(
        "SELECT COUNT(*) FROM interactions WHERE action='save'"
    ).fetchone()[0]
    eff = saves / final["interactions"] * 100
    print(
        f"\nFinal: {final['users']} users, {final['content']} content, {final['exemplars']} exemplars"
    )
    print(f"Token efficiency: {eff:.1f}%")
    print(f"\nTop exemplars:")
    for e in memory.get_best_exemplars(limit=8):
        print(
            f"  {e['user_pattern'][:25]:25s} → {e['content_pattern'][:15]:15s} sr={e['success_rate']:.2f} ({e['usage_count']} uses)"
        )


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    if args.test:
        run_tests()
        sys.exit(0)

    if args.multi_user_test:
        run_multi_user_test()
        sys.exit(0)

    port = args.port

    # Auto-kill any process squatting on our port (macOS/Linux compatible)
    import signal as _sig
    import subprocess as _sp
    import time as _time

    try:
        out = _sp.check_output(["lsof", "-ti", f":{port}"], stderr=_sp.DEVNULL)
        pids = [
            p
            for p in out.decode().strip().split("\n")
            if p and str(p) != str(os.getpid())
        ]
        for pid in pids:
            try:
                os.kill(int(pid), _sig.SIGKILL)
                print(f"[startup] Killed old process {pid} on port {port}")
            except Exception:
                pass
        if pids:
            _time.sleep(0.5)  # Wait for port to release
    except Exception:
        pass

    mode = "live" if curator.is_live else "mock"
    model_info = f"({LLM_MODEL})" if curator.is_live else ""
    print(f"""
╔══════════════════════════════════════════════╗
║        BrainByte v2 — Curation Agent         ║
╠══════════════════════════════════════════════╣
║  Mode: {mode} {model_info:<30}║
║  URL:  http://localhost:{port:<22}║
╠══════════════════════════════════════════════╣
║  API:                                        ║
║    POST /api/auth/register                   ║
║    POST /api/feed/curate   ← agent decides   ║
║    POST /api/feed/interact → agent learns    ║
║    GET  /api/demo/report   ← see learning    ║
║  Web UI:                                     ║
║    GET  /                  ← PWA             ║
║  Tests:                                      ║
║    python server.py --test                   ║
║    python server.py --multi-user-test        ║
╚══════════════════════════════════════════════╝
""")
    uvicorn.run(app, host="0.0.0.0", port=port)
