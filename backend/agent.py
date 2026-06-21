"""
BrainByte Curation Agent — Self-learning content curator.
==========================================================
The agent decides WHAT to curate for each user, calls the LLM to generate it,
and learns from the user's response to get better over time.

Core loop:
  Agent decides topic/difficulty/format → LLM generates byte → User interacts
       ↑                                                                    │
       └─────────── Agent learns, updates policy (exemplars) ───────────────┘

Token saving mechanism:
  When User A teaches the agent "Physics at beginner works well," User B
  (also science-inclined) gets Physics curated on the first try — one LLM
  call instead of five exploration calls. Saved tokens accumulate as the
  exemplar table grows.
"""

import datetime
import hashlib
import json
import math
import random

from curator import CuratedByte, Curator
from memory import MemoryDB

# ── Topic pool for exploration ──────────────────────────────────────────────

TOPICS = [
    "physics",
    "biology",
    "neuroscience",
    "history",
    "psychology",
    "philosophy",
    "technology",
    "mathematics",
    "economics",
    "astronomy",
    "chemistry",
    "linguistics",
    "art history",
    "music theory",
    "political science",
    "anthropology",
    "environmental science",
    "computer science",
    "cognitive science",
    "sociology",
]

DIFFICULTIES = ["beginner", "intermediate", "advanced"]
FORMATS = ["fact", "comparison", "quiz", "story", "howto"]


class CurationAgent:
    """Self-learning agent that decides what to curate for each user.

    Combines:
    - User profile (interests, goals, demonstrated level)
    - Interaction history (what they engaged with)
    - Learned exemplars (what worked for similar users)
    - Exploration/exploitation tradeoff
    """

    def __init__(self, memory: MemoryDB, curator: Curator):
        self.memory = memory
        self.curator = curator

        # Exploration rate: probability of trying something new vs exploiting
        self.exploration_rate = 0.3

        # Scoring weights for curation decisions
        self.weights = {
            "interest_match": 0.30,  # Topic matches user's stated interests
            "exemplar_bonus": 0.30,  # Topic succeeded for similar users
            "category_diversity": 0.20,  # Avoid repeating categories
            "difficulty_fit": 0.20,  # Match user's demonstrated level
        }

    # ── Main curation loop ───────────────────────────────────────────────

    def curate(self, user_id: str) -> dict:
        """Decide what to curate, generate it via LLM, store, and return."""
        user = self.memory.get_user(user_id)
        if not user:
            return {"error": "user not found"}

        history = self.memory.get_user_history(user_id, limit=50)
        exemplars = self.memory.get_best_exemplars(user_id, limit=10)

        # ── 1. Agent decides what to curate ──
        topic, difficulty, format_type, reason = self._decide_curation(
            user, history, exemplars
        )

        # ── 2. Build user context for the LLM prompt ──
        user_interests = json.loads(user.get("interests", "[]"))
        context = f"User interests: {', '.join(user_interests[:5])}. "
        context += f"Streak: {user.get('streak', 0)} days. "
        if history:
            saved_topics = [
                h.get("category", "")
                for h in history[-10:]
                if h.get("action") == "save"
            ]
            if saved_topics:
                context += f"Previously saved: {', '.join(saved_topics[-3:])}."

        # ── 3. Generate the byte ──
        byte = self.curator.generate(topic, difficulty, format_type, context)

        # ── 4. Store in memory ──
        content_id = hashlib.md5(
            f"{user_id}:{topic}:{datetime.datetime.now().isoformat()}".encode()
        ).hexdigest()[:16]

        self.memory.add_curated_content(
            content_id=content_id,
            title=byte.title,
            content=byte.content,
            category=byte.category,
            tags=byte.tags,
            difficulty=byte.difficulty,
            source=byte.source,
            format_type=byte.format,
        )

        return {
            "id": content_id,
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

    def _decide_curation(self, user: dict, history: list, exemplars: list) -> tuple:
        """The agent's 'brain' — picks what to curate next.

        Returns: (topic, difficulty, format, reason_string)
        """
        user_interests = json.loads(user.get("interests", "[]"))
        seen_categories = set(
            h.get("category", "") for h in history if h.get("category")
        )
        saved_categories = set(
            h.get("category", "")
            for h in history
            if h.get("category") and h.get("action") == "save"
        )
        skipped_categories = set(
            h.get("category", "")
            for h in history
            if h.get("category") and h.get("action") == "skip"
        )

        # ── Topic selection ──
        # Score each topic
        topic_scores = {}
        for topic in TOPICS:
            score = 0.0
            reasons = []

            # Interest match
            if topic in [i.lower() for i in user_interests]:
                score += self.weights["interest_match"]
                reasons.append("interest match")

            # Exemplar bonus: has this topic worked for similar users?
            for ex in exemplars:
                if ex.get("content_pattern", "").lower() == topic.lower():
                    score += (
                        ex.get("success_rate", 0.5) * self.weights["exemplar_bonus"]
                    )
                    if ex.get("success_rate", 0) > 0.6:
                        reasons.append("proven for similar users")
                    break

            # Category diversity: boost unseen topics
            if topic not in seen_categories:
                score += self.weights["category_diversity"] * 0.5

            # Penalize skipped topics (but don't permanently exclude)
            if topic in skipped_categories:
                score *= 0.5

            topic_scores[topic] = (score, reasons)

        # Exploration vs exploitation
        if random.random() < self.exploration_rate and len(history) < 5:
            # New user or exploration roll: pick a random topic from interests
            interest_topics = [
                t for t in TOPICS if t in [i.lower() for i in user_interests]
            ]
            if interest_topics:
                topic = random.choice(interest_topics)
            else:
                topic = random.choice(TOPICS)
            reason = "exploring (new user or exploration roll)"
        else:
            # Exploit: pick highest-scoring topic
            ranked = sorted(topic_scores.items(), key=lambda x: x[1][0], reverse=True)
            # Add some randomness: pick from top 3
            top_n = ranked[: min(3, len(ranked))]
            topic, (_, reasons) = random.choice(top_n)
            reason = f"selected based on: {', '.join(reasons) if reasons else 'general interest'}"

        # ── Difficulty selection ──
        # Progress from beginner → intermediate → advanced based on engagement
        if not history:
            difficulty = "beginner"
        else:
            completed = sum(
                1 for h in history if h.get("action") in ("save", "complete")
            )
            if completed >= 10:
                difficulty = "advanced"
            elif completed >= 4:
                difficulty = "intermediate"
            else:
                difficulty = "beginner"

        # ── Format selection ──
        # Default to "fact", occasionally mix in variety
        format_roll = random.random()
        if format_roll < 0.5:
            format_type = "fact"
        elif format_roll < 0.7:
            format_type = "story"
        elif format_roll < 0.85:
            format_type = "comparison"
        elif format_roll < 0.95:
            format_type = "howto"
        else:
            format_type = "quiz"

        return topic, difficulty, format_type, reason

    # ── Learning from interactions ───────────────────────────────────────

    def learn(
        self,
        user_id: str,
        content_id: str,
        action: str,
        dwell_time: float = 0.0,
        rating: float = 0.0,
    ) -> dict:
        """Process a user interaction and update the agent's policy."""
        content = self.memory.get_content(content_id)
        if not content:
            return {"error": "content not found"}

        reward = self._compute_reward(action, dwell_time, rating)
        category = content.get("category", "general")

        # Record interaction
        ep_id = self.memory.record_interaction(
            user_id=user_id,
            content_id=content_id,
            action=action,
            dwell_time=dwell_time,
            rating=rating,
            reward=reward,
            agent_cot=f"Curated {category} at difficulty {content.get('difficulty', 0.5)}",
        )

        # Update exemplar (the "policy"): user_pattern → content_pattern → reward
        user = self.memory.get_user(user_id)
        user_interests = json.loads(user.get("interests", "[]")) if user else []
        user_pattern = (
            f"interests_{'_'.join(sorted(user_interests[:3])).lower()}"
            if user_interests
            else "generalist"
        )
        self.memory.update_exemplar(user_pattern, category.lower(), reward)

        # Store knowledge for high-reward interactions
        if reward >= 0.6:
            self.memory.store_knowledge(
                fact=f"User {user_id[:8]} engages with {category} content "
                f"(reward={reward:.2f})",
                category="user_preference",
                confidence=reward,
                user_id=user_id,
            )

        # Update content engagement stats
        self.memory.conn.execute(
            """UPDATE content SET
               engagement_count = engagement_count + 1,
               avg_rating = (avg_rating * engagement_count + ?) / (engagement_count + 1)
               WHERE id = ?""",
            (rating, content_id),
        )
        self.memory.conn.commit()

        return {
            "reward": reward,
            "episode_id": ep_id,
            "action": action,
            "message": self._reward_message(reward, category),
        }

    def _compute_reward(self, action: str, dwell_time: float, rating: float) -> float:
        """Compute reward from user engagement signal."""
        action_rewards = {
            "save": 1.0,
            "complete": 0.8,
            "share": 1.2,
            "view": 0.3,
            "skip": -0.2,
        }

        reward = action_rewards.get(action, 0.0)

        # Quick skip: strong negative signal
        if action == "skip" and dwell_time < 2:
            reward = -0.5

        # Dwell time bonus: 2-30 seconds is good engagement
        if 2 <= dwell_time <= 30:
            reward += 0.1 * (dwell_time / 15)
        elif dwell_time > 30:
            reward += 0.05

        if rating > 0:
            reward += rating * 0.5

        return max(-1.0, min(2.0, reward))

    def _reward_message(self, reward: float, category: str) -> str:
        if reward >= 1.0:
            return f"Strong signal — {category} content works well for this user"
        elif reward >= 0.5:
            return f"Positive — {category} is a good fit"
        elif reward >= 0:
            return "Neutral engagement"
        elif reward >= -0.3:
            return f"Mild negative — {category} may not be ideal"
        else:
            return f"Strong negative — avoid {category} for this user type"

    # ── Feed helper ───────────────────────────────────────────────────────

    def get_feed(self, user_id: str, count: int = 5) -> list:
        """Get multiple curated bytes for the feed."""
        return [self.curate(user_id) for _ in range(count)]
