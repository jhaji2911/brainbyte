#!/usr/bin/env python3
"""
BrainByte Agent API Service
===========================
FastAPI service that the BrainByte Rust API calls for
self-learning recommendations.

Endpoints:
  POST /recommend           — Get personalized recommendations
  POST /learn               — Report user interaction (RL feedback)
  POST /content/index       — Add new content to the knowledge base
  GET  /user/{id}           — Get user profile & stats
  GET  /agent/status        — Agent status & memory stats
  GET  /agent/cot/{user_id} — Get the agent's reasoning trace for a user
"""

import json
import os
import sys

from agent import BrainByteAgent
from memory import MemoryDB

# Try importing FastAPI — if not installed, provide instructions
try:
    from typing import List, Optional

    import uvicorn
    from fastapi import FastAPI, HTTPException
    from pydantic import BaseModel
except ImportError:
    print("Need FastAPI + uvicorn. Install with:")
    print("  pip install fastapi uvicorn pydantic")
    print("Then run: python3 api_service.py")
    sys.exit(1)


# ── Initialise Agent ────────────────────────────────────────────────────────
memory = MemoryDB()
agent = BrainByteAgent(memory)

app = FastAPI(
    title="BrainByte Self-Learning Agent",
    version="0.1.0",
    description="""
    RL-CoT backend for adaptive micro-learning.
    Call /recommend to get personalized content, /learn to provide feedback.
    """,
)


# ── Pydantic Schemas ────────────────────────────────────────────────────────


class UserCreate(BaseModel):
    user_id: str
    name: str = ""
    interests: List[str] = []
    learning_goals: List[str] = []


class ContentIndex(BaseModel):
    content_id: str
    title: str
    body: str
    category: str = "general"
    tags: List[str] = []
    difficulty: float = 0.5
    source: str = ""


class InteractionReport(BaseModel):
    user_id: str
    content_id: str
    action: str  # view, complete, save, share, skip
    dwell_time: float = 0.0
    rating: float = 0.0  # 0.0 to 1.0


class RecommendRequest(BaseModel):
    user_id: str
    n_results: int = 10


# ── API Endpoints ───────────────────────────────────────────────────────────


@app.get("/health")
def health():
    return {"status": "ok", "agent": "BrainByte RL-CoT Agent v0.1"}


@app.post("/user/create")
def create_user(user: UserCreate):
    result = memory.upsert_user(
        user_id=user.user_id,
        name=user.name,
        interests=user.interests,
        goals=user.learning_goals,
    )
    if not result:
        raise HTTPException(400, "User creation failed")
    return {
        "status": "ok",
        "user": {
            "id": result["id"],
            "interests": json.loads(result.get("interests", "[]")),
            "goals": json.loads(result.get("learning_goals", "[]")),
        },
    }


@app.get("/user/{user_id}")
def get_user(user_id: str):
    user = memory.get_user(user_id)
    if not user:
        raise HTTPException(404, f"User {user_id} not found")
    return {"user": user}


@app.post("/content/index")
def index_content(content: ContentIndex):
    result = memory.add_content(
        content_id=content.content_id,
        title=content.title,
        body=content.body,
        category=content.category,
        tags=content.tags,
        difficulty=content.difficulty,
        source=content.source,
    )
    if not result:
        raise HTTPException(400, "Content indexing failed")
    return {"status": "ok", "content_id": content.content_id}


@app.post("/recommend")
def recommend(req: RecommendRequest):
    """Get RL-CoT personalized recommendations for a user."""
    user = memory.get_user(req.user_id)
    if not user:
        raise HTTPException(404, f"User {req.user_id} not found")

    result = agent.recommend(user_id=req.user_id, n_results=req.n_results)

    return {
        "user_id": req.user_id,
        "recommendations": [
            {
                "id": r["id"],
                "title": r["title"],
                "category": r.get("category", ""),
                "difficulty": r.get("difficulty", 0.5),
                "score": r["_score"],
                "reason": r["_reason"],
            }
            for r in result["recommendations"]
        ],
        "cot_trace": result["cot_trace"],
        "timestamp": result["timestamp"],
    }


@app.post("/learn")
def learn(interaction: InteractionReport):
    """Report a user interaction — this is the RL feedback loop."""
    user = memory.get_user(interaction.user_id)
    if not user:
        raise HTTPException(404, f"User {interaction.user_id} not found")

    content = memory.get_content(interaction.content_id)
    if not content:
        raise HTTPException(404, f"Content {interaction.content_id} not found")

    result = agent.learn_from_interaction(
        user_id=interaction.user_id,
        content_id=interaction.content_id,
        action=interaction.action,
        dwell_time=interaction.dwell_time,
        rating=interaction.rating,
    )

    return {
        "status": "ok",
        "reward": result["reward"],
        "episode_id": result["episode_id"],
        "message": f"Interaction recorded — reward={result['reward']:.2f}",
    }


@app.post("/content/bulk-index")
def bulk_index(contents: List[ContentIndex]):
    """Index multiple content items at once."""
    count = 0
    for c in contents:
        memory.add_content(
            content_id=c.content_id,
            title=c.title,
            body=c.body,
            category=c.category,
            tags=c.tags,
            difficulty=c.difficulty,
            source=c.source,
        )
        count += 1
    return {"status": "ok", "indexed": count}


@app.get("/agent/status")
def agent_status():
    stats = memory.get_stats()
    return {
        "agent": "RL-CoT + SQLite",
        "version": "0.1.0",
        "memory": stats,
        "weights": agent.weights,
    }


@app.get("/agent/cot/{user_id}")
def agent_cot(user_id: str):
    """Get the agent's reasoning trace for this user."""
    user = memory.get_user(user_id)
    if not user:
        raise HTTPException(404, f"User {user_id} not found")

    history = memory.get_user_history(user_id, limit=10)
    exemplars = memory.get_best_exemplars(user_id, limit=3)

    return {
        "user_id": user_id,
        "recent_history": [
            {
                "content_id": h["content_id"],
                "action": h["action"],
                "reward": h["reward"],
            }
            for h in history
        ],
        "active_exemplars": [
            {
                "pattern": e.get("user_pattern", ""),
                "success_rate": e["success_rate"],
                "usage": e["usage_count"],
            }
            for e in exemplars
        ],
    }


# ── Main ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.environ.get("BRAINBYTE_AGENT_PORT", 8090))
    print(f"BrainByte Agent API running on http://0.0.0.0:{port}")
    print(f"Endpoints:")
    print(f"  POST /recommend       — Get personalized recommendations")
    print(f"  POST /learn           — Report user interaction (RL feedback)")
    print(f"  POST /content/index   — Add content to knowledge base")
    print(f"  POST /content/bulk-index — Index multiple items")
    print(f"  POST /user/create     — Create/update user")
    print(f"  GET  /user/{'{id}'}   — Get user info")
    print(f"  GET  /agent/status    — Agent memory stats")
    print(f"  GET  /agent/cot/{'{id}'} — Reasoning trace")
    print(f"  GET  /health          — Health check")
    print()
    uvicorn.run(app, host="0.0.0.0", port=port)
