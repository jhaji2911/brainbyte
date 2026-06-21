#!/usr/bin/env python3
"""
BrainByte Agent Core
====================
RL-CoT reasoning engine for self-learning content recommendation.

Use case: Adaptive Micro-Learning Engine
- Takes user state + content pool → generates CoT reasoning → picks content
- Gets reward from user engagement → updates policy
- Uses TurboVec for semantic memory recall

Inspired by DeepSeek-R1 (arXiv:2501.12948) and GRPO (arXiv:2402.03300).
"""

import datetime
import json
import math
import random

import numpy as np
from memory import MemoryDB, _simple_embed


class BrainByteAgent:
    """Self-learning recommendation agent with RL-CoT reasoning.

    The agent:
    1. Retrieves user state (history, preferences, knowledge gaps)
    2. Generates Chain-of-Thought reasoning about what to recommend
    3. Picks the best content based on reasoning
    4. Gets reward signal from user interaction
    5. Updates its policy (exemplars) via RL update

    CoT Reasoning dimensions considered:
    - User's content history (what they've seen and engaged with)
    - Semantic similarity to past positive interactions
    - Category diversity (avoid getting stuck in one topic)
    - Difficulty progression (scaffold learning)
    - Spaced repetition (show forgotten content again)
    - Knowledge gaps (from quiz performance)
    - Streak maintenance (easy wins for returning users)
    """

    def __init__(self, memory: MemoryDB):
        self.memory = memory
        self.max_cot_steps = 6

        # Reasoning dimensions and their weights (learnable over time)
        self.weights = {
            "semantic_similarity": 0.35,
            "category_diversity": 0.15,
            "difficulty_fit": 0.20,
            "spaced_repetition": 0.15,
            "knowledge_gap": 0.15,
        }

    def recommend(self, user_id: str, n_results: int = 10) -> dict:
        """Main recommendation loop: think → score → pick → explain."""

        # ── 1. Gather context ──
        user = self.memory.get_user(user_id)
        history = self.memory.get_user_history(user_id, limit=50)
        exemplars = self.memory.get_best_exemplars(user_id, limit=5)
        preference_vec = self.memory.get_user_preference_vector(user_id)

        # ── 2. Generate CoT reasoning ──
        cot = self._generate_reasoning(user, history, exemplars, preference_vec)

        # ── 3. Score all available content ──
        scored = self._score_content(user_id, history, preference_vec, cot)

        # ── 4. Select recommendations ──
        recommendations = scored[:n_results]

        return {
            "user_id": user_id,
            "recommendations": recommendations,
            "cot_trace": cot,
            "scored_count": len(scored),
            "timestamp": datetime.datetime.now().isoformat(),
        }

    def _generate_reasoning(self, user, history, exemplars, preference_vec):
        """Generate chain-of-thought reasoning about this user.

        In production this would call an LLM. MVP uses structured reasoning.
        """
        steps = []

        # Step 1: Profile analysis
        user_interests = json.loads(user.get("interests", "[]")) if user else []
        steps.append(
            f"[User Profile] id={user['id'][:8] if user else 'unknown'}, "
            f"interests={user_interests[:3]}, "
            f"streak={user.get('streak', 0) if user else 0}"
        )

        # Step 2: History analysis
        if history:
            recent_content = history[:5]
            actions = [h["action"] for h in recent_content]
            liked = sum(1 for h in recent_content if h.get("rating", 0) >= 0.7)
            skipped = sum(1 for a in actions if a == "skip")
            steps.append(
                f"[History] Last {len(recent_content)} items: "
                f"{liked} liked, {skipped} skipped, "
                f"avg_reward={sum(h.get('reward', 0) for h in recent_content) / len(recent_content):.2f}"
            )

            # Step 3: Preference insight
            categories_seen = set(
                h.get("category", "") for h in history if h.get("category")
            )
            steps.append(f"[Categories] User has seen: {list(categories_seen)[:5]}")

            if preference_vec is not None and np.any(preference_vec):
                steps.append(f"[Preference vec] Active — using semantic similarity")
        else:
            steps.append(
                "[History] New user — will explore broadly with highest-rated content"
            )

        # Step 4: Exemplar matching
        if exemplars:
            best_ex = exemplars[0]
            steps.append(
                f"[Policy] Best exemplar: success_rate={best_ex['success_rate']:.2f}, "
                f"pattern='{best_ex.get('user_pattern', '')[:40]}'"
            )
        else:
            steps.append("[Policy] No exemplars yet — starting fresh")

        # Step 5: Recommendation strategy
        if history and len(history) > 5:
            steps.append(
                "[Strategy] Mix of: semantically similar to liked items + "
                "new categories for diversity + easier items for streak maintenance"
            )
        else:
            steps.append(
                "[Strategy] Cold-start: recommend popular content across diverse categories"
            )

        return "\n".join(steps)

    def _score_content(
        self, user_id: str, history: list, preference_vec: np.ndarray, cot: str
    ) -> list:
        """Score all content in the database based on multiple factors."""

        # Get all content (in production, use a smarter query)
        rows = self.memory.conn.execute("SELECT * FROM content").fetchall()

        # Get content IDs the user has already seen
        seen_ids = set(h["content_id"] for h in history)

        scored = []
        for row in rows:
            content = dict(row)
            content_id = content["id"]

            # Skip already-seen content (unless it's time for review)
            time_for_review = self._is_due_for_review(history, content_id, content)
            if content_id in seen_ids and not time_for_review:
                continue

            # Compute multi-factor score
            score = self._compute_score(user_id, content, history, preference_vec)
            content["_score"] = round(score, 4)
            content["_reason"] = self._explain_score(content, score, history)
            scored.append(content)

        scored.sort(key=lambda x: x["_score"], reverse=True)
        return scored

    def _compute_score(
        self, user_id: str, content: dict, history: list, preference_vec: np.ndarray
    ) -> float:
        """Multi-factor score combining all reasoning dimensions."""

        # 1. Semantic similarity to user preference
        sim_score = 0.0
        if np.any(preference_vec):
            content_text = f"{content.get('title', '')} {content.get('body', '')} {content.get('tags', '')}"
            content_vec = _simple_embed(content_text, dim=128)
            sim = float(np.dot(preference_vec, content_vec))
            sim_score = max(0, sim) * self.weights["semantic_similarity"]

        # 2. Category diversity (boost unseen categories)
        categories_seen = set(
            h.get("category", "") for h in history if h.get("category")
        )
        cat_div = 0.0
        if categories_seen:
            cat_score = 0.0 if content.get("category", "") in categories_seen else 1.0
            cat_div = cat_score * self.weights["category_diversity"]

        # 3. Difficulty fit (match user's demonstrated level)
        diff_fit = 0.0
        if history and content.get("difficulty"):
            avg_engagement = sum(
                h.get("rating", 0) * h.get("difficulty", 0.5)
                for h in history
                if h.get("rating", 0) > 0
            )
            engaged_count = sum(1 for h in history if h.get("rating", 0) > 0)
            if engaged_count > 0:
                user_level = avg_engagement / engaged_count
                diff_match = 1.0 - abs(content["difficulty"] - user_level)
                diff_fit = diff_match * self.weights["difficulty_fit"]

        # 4. Popularity / quality signal (fallback for cold start)
        popularity = min(1.0, content.get("engagement_count", 0) / 100) * 0.10

        # 5. Exemplar match bonus (match on category, which is what content_pattern stores)
        exemplar_bonus = 0.0
        category = content.get("category", "")
        if category:
            exs = self.memory.conn.execute(
                "SELECT * FROM exemplars WHERE content_pattern = ? ORDER BY success_rate DESC LIMIT 1",
                (category,),
            ).fetchall()
            if exs:
                exemplar_bonus = exs[0]["success_rate"] * 0.15

        total = sim_score + cat_div + diff_fit + popularity + exemplar_bonus
        return min(1.0, max(0.0, total))

    def _explain_score(self, content: dict, score: float, history: list) -> str:
        """Human-readable explanation of why this content scored how it did."""
        parts = []
        if score > 0.7:
            parts.append("high semantic match")
        if content.get("category") and not any(
            h.get("category") == content["category"] for h in history[:20]
        ):
            parts.append("new category")
        if content.get("engagement_count", 0) > 50:
            parts.append("popular")
        if content.get("difficulty", 0.5) < 0.3:
            parts.append("easy win")
        elif content.get("difficulty", 0.5) > 0.7:
            parts.append("challenging")

        return ", ".join(parts) if parts else "exploration pick"

    def _is_due_for_review(self, history: list, content_id: str, content: dict) -> bool:
        """Spaced repetition: is this content due for review?"""
        interactions = [h for h in history if h["content_id"] == content_id]
        if not interactions:
            return False

        latest = interactions[-1]
        try:
            last_seen = datetime.datetime.strptime(
                latest.get("timestamp", "2000-01-01"), "%Y-%m-%d %H:%M:%S"
            )
            hours_ago = (datetime.datetime.now() - last_seen).total_seconds() / 3600

            # If they rated it low, review sooner
            rating = latest.get("rating", 0.5)
            review_hours = 24 + (1 - rating) * 48  # 24-72 hours

            return hours_ago >= review_hours
        except:
            return False

    # ── Learning (RL Update) ──

    def learn_from_interaction(
        self,
        user_id: str,
        content_id: str,
        action: str,
        dwell_time: float = 0.0,
        rating: float = 0.0,
    ):
        """Process a user interaction and update the policy."""

        # Compute reward
        reward = self._compute_reward(action, dwell_time, rating)

        # Store interaction episode
        cot = f"[Agent] Recommended based on: user profile + history + semantic similarity"
        ep_id = self.memory.record_interaction(
            user_id=user_id,
            content_id=content_id,
            action=action,
            dwell_time=dwell_time,
            rating=rating,
            reward=reward,
            agent_cot=cot,
        )

        # Update exemplars (the "policy")
        user = self.memory.get_user(user_id)
        user_interests = json.loads(user.get("interests", "[]")) if user else []
        user_pattern = (
            f"streak_{user.get('streak', 0)}_interests_{'_'.join(user_interests[:3])}"
        )

        content = self.memory.get_content(content_id)
        content_pattern = content.get("category", "general") if content else "general"

        self.memory.update_exemplar(user_pattern, content_pattern, reward)

        # Store as knowledge if high reward
        if reward >= 0.6:
            fact = f"User {user_id[:8]} engages well with {content_pattern} content"
            self.memory.store_knowledge(
                fact=fact,
                category="user_preference",
                confidence=reward,
                user_id=user_id,
            )

        return {"episode_id": ep_id, "reward": reward, "interaction_id": ep_id}

    def _compute_reward(self, action: str, dwell_time: float, rating: float) -> float:
        """Compute reward from user engagement signal.

        | Action     | Base Reward | Notes                        |
        |------------|-------------|------------------------------|
        | save       | 1.0         | Strong positive signal       |
        | complete   | 0.8         | Finished reading             |
        | view       | 0.3         | Just looked at it            |
        | share      | 1.2         | Highest engagement           |
        | skip       | -0.2        | Negative signal              |
        | quick_skip | -0.5        | < 2 seconds, strong negative |
        """
        action_rewards = {
            "save": 1.0,
            "complete": 0.8,
            "share": 1.2,
            "view": 0.3,
            "skip": -0.2,
            "quick_skip": -0.5,
            "timeout": 0.0,
        }

        reward = action_rewards.get(action, 0.0)

        # Dwell time bonus: 2-30 seconds is good engagement
        if 2 <= dwell_time <= 30:
            reward += 0.1 * (dwell_time / 15)  # peaks at ~0.2
        elif dwell_time > 30:
            reward += 0.05  # might have walked away

        # Rating bonus
        if rating > 0:
            reward += rating * 0.5

        return max(-1.0, min(2.0, reward))


# ── CLI for testing ──


def main():
    import sys

    memory = MemoryDB()
    agent = BrainByteAgent(memory)

    print("═" * 50)
    print("BrainByte Self-Learning Agent")
    print("RL-CoT reasoning + SQLite memory")
    print("═" * 50)

    # Create a test user
    user_id = "test_user_001"
    memory.upsert_user(
        user_id,
        name="Test User",
        interests=["math", "science", "history"],
        goals=["learn daily", "improve focus"],
    )

    # Add some test content
    test_content = [
        (
            "c001",
            "Calculus Basics",
            "Understanding limits and derivatives",
            "math",
            ["calculus", "algebra"],
            0.6,
        ),
        (
            "c002",
            "Quantum Physics Intro",
            "Basic principles of quantum mechanics",
            "science",
            ["physics", "quantum"],
            0.7,
        ),
        (
            "c003",
            "World War II Overview",
            "Key events and figures of WWII",
            "history",
            ["war", "20th century"],
            0.4,
        ),
        (
            "c004",
            "Python for Beginners",
            "Getting started with Python programming",
            "tech",
            ["coding", "python"],
            0.3,
        ),
        (
            "c005",
            "Ancient Rome",
            "The rise and fall of the Roman Empire",
            "history",
            ["ancient", "empire"],
            0.5,
        ),
        (
            "c006",
            "Linear Algebra",
            "Vectors, matrices, and transformations",
            "math",
            ["algebra", "vectors"],
            0.7,
        ),
        (
            "c007",
            "Machine Learning 101",
            "Introduction to ML concepts",
            "tech",
            ["AI", "ML"],
            0.6,
        ),
        (
            "c008",
            "Chemistry Fundamentals",
            "Atoms, molecules, and reactions",
            "science",
            ["chemistry", "atoms"],
            0.4,
        ),
        (
            "c009",
            "Space Exploration",
            "History of space travel and missions",
            "science",
            ["space", "NASA"],
            0.3,
        ),
        (
            "c010",
            "Creative Writing Tips",
            "Improve your writing skills",
            "arts",
            ["writing", "creativity"],
            0.2,
        ),
    ]

    for cid, title, body, cat, tags, diff in test_content:
        memory.add_content(cid, title, body, cat, tags, diff)

    print(f"\n[1] User '{user_id}' created with interests: math, science, history")
    print(f"[2] {len(test_content)} content bytes loaded")

    # Simulate some interactions to build history
    print("\n[3] Simulating initial interactions (RL training)...")
    simulated_actions = [
        ("c001", "complete", 12.0, 0.9),
        ("c002", "view", 5.0, 0.4),
        ("c003", "complete", 20.0, 0.8),
        ("c004", "skip", 1.0, 0.0),
        ("c005", "complete", 15.0, 0.7),
    ]
    for content_id, action, dwell, rating in simulated_actions:
        result = agent.learn_from_interaction(
            user_id, content_id, action, dwell, rating
        )
        print(f"   content={content_id} action={action} reward={result['reward']:.2f}")

    # Generate recommendation
    print("\n[4] Generating RL-CoT recommendations...")
    rec = agent.recommend(user_id, n_results=5)

    print(f"\n  CoT Reasoning:")
    for line in rec["cot_trace"].split("\n"):
        print(f"    {line}")

    print(f"\n  Top 5 Recommendations:")
    for i, r in enumerate(rec["recommendations"][:5]):
        print(f"    {i + 1}. [{r['_score']:.3f}] {r['title']} — {r['_reason']}")

    print(f"\n  Scored {rec['scored_count']} content items in total")

    # Show memory stats
    stats = memory.get_stats()
    print(f"\n  Memory Stats:")
    print(f"    Users: {stats['users']}, Content: {stats['content']}")
    print(f"    Interactions: {stats['interactions']}")
    print(f"    Exemplars (policies): {stats['exemplars']}")
    print(f"    Knowledge facts: {stats['knowledge']}")

    # Simulate another round of learning
    print("\n[5] Second round — user comes back...")
    # User engages positively with recommended content
    for r in rec["recommendations"][:3]:
        result = agent.learn_from_interaction(user_id, r["id"], "complete", 10.0, 0.85)
        print(f"   engaged with {r['id']} → reward={result['reward']:.2f}")

    rec2 = agent.recommend(user_id)
    print(f"\n  Updated Top 5 (after learning):")
    for i, r in enumerate(rec2["recommendations"][:5]):
        print(f"    {i + 1}. [{r['_score']:.3f}] {r['title']} — {r['_reason']}")

    print("\n  Done! Memory persists in brainbyte_memory.db")

    memory.close()


if __name__ == "__main__":
    main()
