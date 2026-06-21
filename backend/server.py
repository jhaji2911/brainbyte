"""
BrainByte Backend — Single FastAPI server.
==========================================
Runs the curation agent + serves the PWA + provides the API.

Start:
  cd backend && pip install -r requirements.txt && python server.py

With LLM:
  LLM_API_KEY=sk-... LLM_MODEL=gpt-4o-mini python server.py

Without LLM (mock mode):
  python server.py
"""

import json
import os
import sys
import uuid
from typing import Optional

from agent import CurationAgent
from curator import Curator
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from llm_client import LLMConfig, load_llm_config
from memory import MemoryDB
from pydantic import BaseModel

# ── Init ────────────────────────────────────────────────────────────────────

memory = MemoryDB(os.path.join(os.path.dirname(__file__), "brainbyte.db"))
llm_config = load_llm_config()
curator = Curator(llm_config)
agent = CurationAgent(memory, curator)

app = FastAPI(
    title="BrainByte — Self-Learning Curation Agent",
    version="0.2.0",
    description="Agentic backend that curates micro-learning content using an LLM "
    "and learns from user interactions.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Pydantic Models ─────────────────────────────────────────────────────────


class RegisterRequest(BaseModel):
    name: str
    interests: list[str] = []


class LoginRequest(BaseModel):
    user_id: str


class InteractRequest(BaseModel):
    content_id: str
    action: str  # "save", "skip", "complete", "view"
    dwell_time: float = 0.0
    rating: float = 0.0


class OnboardingRequest(BaseModel):
    interests: list[str] = []


# ── Simple token-based auth (MVP) ───────────────────────────────────────────

# In-memory session store: token → user_id
sessions: dict[str, str] = {}


def _get_user_id(authorization: str = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "missing or invalid token")
    token = authorization.removeprefix("Bearer ")
    user_id = sessions.get(token)
    if not user_id:
        raise HTTPException(401, "invalid or expired token")
    return user_id


# ── API Endpoints ───────────────────────────────────────────────────────────


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "llm_mode": "mock" if curator.is_mock else f"live ({llm_config.model})",
        "users": memory.get_stats()["users"],
        "content_curated": memory.get_stats()["content"],
        "exemplars_learned": memory.get_stats()["exemplars"],
    }


@app.post("/api/auth/register")
def register(req: RegisterRequest):
    user_id = f"user_{uuid.uuid4().hex[:8]}"
    memory.upsert_user(user_id, name=req.name, interests=req.interests)
    token = f"tok_{uuid.uuid4().hex}"
    sessions[token] = user_id
    return {
        "token": token,
        "user": {"id": user_id, "name": req.name, "interests": req.interests},
    }


@app.post("/api/auth/login")
def login(req: LoginRequest):
    user = memory.get_user(req.user_id)
    if not user:
        raise HTTPException(404, "user not found")
    token = f"tok_{uuid.uuid4().hex}"
    sessions[token] = req.user_id
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "name": user["name"],
            "interests": json.loads(user.get("interests", "[]")),
        },
    }


@app.get("/api/auth/me")
def me(authorization: str = Header(None)):
    user_id = _get_user_id(authorization)
    user = memory.get_user(user_id)
    history = memory.get_user_history(user_id, limit=20)
    return {
        "user": {
            "id": user["id"],
            "name": user["name"],
            "interests": json.loads(user.get("interests", "[]")),
            "xp": user.get("xp", 0),
            "streak": user.get("streak", 0),
        },
        "history": [
            {
                "content_id": h["content_id"],
                "title": h.get("title", ""),
                "category": h.get("category", ""),
                "action": h["action"],
                "reward": h.get("reward", 0),
            }
            for h in history[-10:]
        ],
        "stats": {
            "total_interactions": len(history),
            "saved": sum(1 for h in history if h["action"] == "save"),
            "skipped": sum(1 for h in history if h["action"] == "skip"),
        },
    }


@app.post("/api/feed/curate")
def curate(authorization: str = Header(None)):
    """Get the next curated byte. The agent decides what to curate,
    calls the LLM to generate it, stores it, and returns it."""
    user_id = _get_user_id(authorization)
    result = agent.curate(user_id)
    if "error" in result:
        raise HTTPException(400, result["error"])
    return result


@app.post("/api/feed/curate-batch")
def curate_batch(count: int = 5, authorization: str = Header(None)):
    """Get multiple curated bytes at once."""
    user_id = _get_user_id(authorization)
    results = agent.get_feed(user_id, count)
    return {"bytes": results, "count": len(results)}


@app.post("/api/feed/interact")
def interact(req: InteractRequest, authorization: str = Header(None)):
    """Report a user interaction — this is the learning signal."""
    user_id = _get_user_id(authorization)
    result = agent.learn(
        user_id=user_id,
        content_id=req.content_id,
        action=req.action,
        dwell_time=req.dwell_time,
        rating=req.rating,
    )
    if "error" in result:
        raise HTTPException(400, result["error"])
    return result


@app.get("/api/feed/history")
def history(limit: int = 20, authorization: str = Header(None)):
    user_id = _get_user_id(authorization)
    rows = memory.get_user_history(user_id, limit)
    return {
        "history": [
            {
                "content_id": h["content_id"],
                "title": h.get("title", ""),
                "category": h.get("category", ""),
                "action": h["action"],
                "reward": h.get("reward", 0),
                "timestamp": h.get("timestamp", ""),
            }
            for h in rows
        ]
    }


@app.post("/api/onboarding")
def save_onboarding(req: OnboardingRequest, authorization: str = Header(None)):
    user_id = _get_user_id(authorization)
    memory.upsert_user(user_id, interests=req.interests)
    return {"status": "ok"}


# ── Demo / Learning Report ──────────────────────────────────────────────────


@app.get("/api/demo/report")
def demo_report():
    """Show the agent's learning state — exemplars, knowledge, token efficiency."""
    stats = memory.get_stats()
    exemplars = memory.get_best_exemplars(limit=50)

    # Compute token efficiency
    total_content = stats["content"]
    total_interactions = stats["interactions"]
    saves = 0
    if total_interactions > 0:
        saves = memory.conn.execute(
            "SELECT COUNT(*) FROM interactions WHERE action='save'"
        ).fetchone()[0]
        save_rate = saves / total_interactions
        token_efficiency = save_rate
    else:
        token_efficiency = 0.0
        save_rate = 0.0

    return {
        "agent": "BrainByte Curation Agent v0.2",
        "llm_mode": "mock" if curator.is_mock else f"live ({llm_config.model})",
        "memory": stats,
        "token_efficiency": {
            "total_curations": total_content,
            "total_interactions": total_interactions,
            "save_rate": round(save_rate, 3),
            "tokens_wasted_on_skips": total_content - saves if saves else total_content,
            "efficiency_pct": round(token_efficiency * 100, 1),
        },
        "top_exemplars": [
            {
                "user_pattern": e.get("user_pattern", ""),
                "content_pattern": e.get("content_pattern", ""),
                "success_rate": e.get("success_rate", 0),
                "usage": e.get("usage_count", 0),
            }
            for e in exemplars[:10]
        ],
        "knowledge_facts": memory.query_knowledge("", limit=10),
    }


# ── Serve PWA ───────────────────────────────────────────────────────────────

WEB_DIR = os.path.join(os.path.dirname(__file__), "..", "web")
INDEX_PATH = os.path.join(WEB_DIR, "index.html")


@app.get("/")
async def serve_pwa():
    if os.path.isfile(INDEX_PATH):
        return FileResponse(INDEX_PATH)
    return HTMLResponse("<h1>BrainByte API</h1><p>PWA not found. API at /api</p>")


@app.get("/{full_path:path}")
async def serve_pwa_files(full_path: str):
    if full_path.startswith("api/"):
        raise HTTPException(404)
    file_path = os.path.join(WEB_DIR, full_path)
    if os.path.isfile(file_path):
        return FileResponse(file_path)
    return FileResponse(INDEX_PATH)


# ── Main ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8080))
    mode = "mock" if curator.is_mock else f"live ({llm_config.model})"
    print(f"╔══════════════════════════════════════════════════════╗")
    print(f"║        BrainByte — Self-Learning Curation Agent      ║")
    print(f"╠══════════════════════════════════════════════════════╣")
    print(f"║  Mode: {mode:<46}║")
    print(f"║  URL:  http://localhost:{port:<37}║")
    print(f"╠══════════════════════════════════════════════════════╣")
    print(f"║  Endpoints:                                          ║")
    print(f"║    POST /auth/register   — Create account            ║")
    print(f"║    POST /auth/login      — Sign in                   ║")
    print(f"║    GET  /auth/me         — Profile + history         ║")
    print(f"║    POST /feed/curate     — Get curated byte          ║")
    print(f"║    POST /feed/interact   — Send learning signal      ║")
    print(f"║    GET  /demo/report     — Agent learning report     ║")
    print(f"║    GET  /                — PWA (if web/ exists)      ║")
    print(f"╚══════════════════════════════════════════════════════╝")
    print()

    uvicorn.run(app, host="0.0.0.0", port=port)
