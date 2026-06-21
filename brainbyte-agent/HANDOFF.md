# BrainByte Agent — Handoff for Zed Agent

## Project Context

BrainByte is a bite-sized micro-learning app (React Native mobile + Rust Axum API + Payload CMS). This directory (`brainbyte-agent/`) contains the **self-learning RL-CoT backend agent** that provides adaptive content recommendations using reinforcement learning + chain-of-thought reasoning.

## The Stack

```
brainbyte/brainbyte-agent/
├── agent.py           # RL-CoT reasoning engine (BrainByteAgent class)
├── memory.py          # SQLite + NumPy hybrid memory (MemoryDB)
├── api_service.py     # FastAPI REST service (port 8090)
└── requirements.txt   # numpy
```

### Dependencies
- `numpy` — Vector operations and similarity scoring
- `fastapi`, `uvicorn`, `pydantic` — API service layer

### Architecture

```
mobile (React Native) ──► Rust API (Axum, port 8080) ──► Agent Backend (port 8090)
                                                             │
                                                     ┌───────┴────────┐
                                                     │  BrainByteAgent │
                                                     │  (agent.py)     │
                                                     │                 │
                                                     │  MemoryDB       │
                                                     │  (memory.py)    │
                                                     │  ├─ SQLite      │
                                                     │  │  ├─ users    │
                                                     │  │  ├─ content  │
                                                     │  │  ├─ interactions (episodic memory)
                                                     │  │  ├─ exemplars (procedural/policy)
                                                     │  │  └─ knowledge (semantic facts)
                                                     │  └─ NumPy       │
                                                     │     └─ in-process vector similarity
                                                     └──────────────────┘
```

## How It Works

### 1. Recommendation Loop (POST /recommend)

```
Request: { user_id: "abc", n_results: 10 }

Agent does CoT reasoning:
  [Profile]     — User interests, streak
  [History]     — Past interactions, likes/skips, rewards
  [Categories]  — What topics user has/hasn't seen
  [Policy]      — Exemplars matching this user pattern (learned weights)
  [Strategy]    — Diversity + difficulty fit + exploration

→ Scores all unseen content via multi-factor scoring:
  - semantic_similarity (35%) — cosine sim to user's preference vector
  - category_diversity (15%)  — boost new categories
  - difficulty_fit (20%)      — match demonstrated user level
  - popularity (10%)          — cold-start fallback
  - exemplar_bonus (15%)      — learned from past success patterns

→ Returns ranked recommendations with CoT trace
```

### 2. Learning Loop (POST /learn)

```
Request: { user_id, content_id, action, dwell_time, rating }

Reward computed from engagement:
  save        → 1.0   (strong positive)
  complete    → 0.8   (finished reading)
  share       → 1.2   (highest engagement)
  view        → 0.3   (just looked)
  skip        → -0.2  (negative)
  quick_skip  → -0.5  (< 2 seconds, strong negative)

+ dwell_time bonus (2-30s sweet spot)
+ rating bonus

→ Stores episode in SQLite (interactions table)
→ Updates exemplar success_rate via EMA (REINFORCE-style)
→ Extracts knowledge if reward >= 0.6
```

### 3. Memory Layer (memory.py)

**SQLite tables:**
| Table | Purpose | Key columns |
|-------|---------|-------------|
| `users` | User profiles, interests, goals | id, interests, streak, xp |
| `content` | Knowledge bytes | id, title, body, category, difficulty |
| `interactions` | Episodic memory | user_id, content_id, action, reward, agent_cot |
| `exemplars` | Procedural memory (policy) | user_pattern, success_rate, avg_reward, usage_count |
| `knowledge` | Semantic facts | fact, category, confidence, user_id |
| `content_fts` | FTS5 full-text search | title, body, tags |

**Embedding approach:**
`_simple_embed()` uses character n-gram hashing (2/3/4-grams → MD5 → 128-dim vector). Similar texts produce similar vectors without external dependencies. This is sufficient for MVP scale (<10K items). **Replace with `sentence-transformers/all-MiniLM-L6-v2` for production semantic search.**

**Vector similarity:**
Brute-force numpy dot product across all content items. For MVP scale (5-1000 items) this is faster than an ANN index. If content grows past 10K items, add FAISS or pgvector.

### 4. CoT Reasoning (agent.py)

The `BrainByteAgent.recommend()` method generates structured CoT reasoning:

```python
# Example output from a real run:
[User Profile] id=demo, interests=['math'], streak=0
[History] Last 5 items: 3 liked, 1 skipped, avg_reward=0.85
[Categories] User has seen: tech, math, science, history
[Preference vec] Active — using semantic similarity
[Policy] Best exemplar: success_rate=0.79, pattern='streak_0_interests_math'
[Strategy] Cold-start: recommend popular content across diverse categories
```

In production, replace the structured CoT generation with actual LLM calls for richer reasoning.

## API Endpoints (port 8090)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Health check |
| POST | `/user/create` | Create/update user |
| GET | `/user/{id}` | Get user profile |
| POST | `/content/index` | Index a single content byte |
| POST | `/content/bulk-index` | Index multiple content items |
| POST | `/recommend` | Get RL-CoT personalized recommendations |
| POST | `/learn` | Report user interaction (RL feedback signal) |
| GET | `/agent/status` | Agent memory stats |
| GET | `/agent/cot/{user_id}` | Get agent's reasoning trace for a user |

## Integration with Rust API

The Rust API (`api/src/main.rs`, Axum on port 8080) proxies requests to the agent via `api/src/agent_client.rs`:

```rust
// Type-safe client with request/response structs matching the agent's API
agent_client::recommend(&user_id, n_results).await?
agent_client::learn(&user_id, &content_id, action, dwell_time, rating).await?
agent_client::create_user(&user_id, &name, interests, goals).await?
agent_client::index_content(&content_id, &title, &body, &category, tags, difficulty, &source).await?
agent_client::bulk_index_contents(items).await?
```

The Rust API also seeds the agent on startup — creating users and indexing all seeded facts so the recommendation engine has data immediately.

## State of the Code

✅ **Working:**
- Full CLI demo (`python3 agent.py`) — 10 content items, RL training loop, CoT reasoning, recommendations
- FastAPI service — all endpoints tested and responding
- N-gram hash embeddings — deterministic, meaningful similarity (validated: related texts ~0.74, unrelated ~0.35)
- RL policy updates — exemplar success rates learned via EMA
- Multi-factor scoring — semantic + diversity + difficulty + popularity + exemplars
- Bidirectional Rust API ↔ Agent wiring — `agent_client.rs` with typed methods
- Content ID consistency — all 8 bytes use `fact-{n}` IDs across all tiers

❌ **Needs work:**
- N-gram embeddings are lightweight but not truly semantic — needs sentence-transformers for production
- CoT generation is template-based — needs LLM integration for richer reasoning
- No Dockerfile or deployment config
- Spaced repetition scoring is basic
- No true GRPO — samples single recommendation set, not N for group-relative advantages

## Next Steps Priority

1. **Dockerize services** — Dockerfile for Rust API + agent for reproducible deployment
2. **Real embeddings** — Replace `_simple_embed()` with `sentence-transformers/all-MiniLM-L6-v2`
3. **Real auth** — Bcrypt password hashing + proper session management (currently plain-text, token-based)
4. **LLM-powered CoT** — When available, pipe the context into an LLM for richer reasoning traces
5. **Content generation** — Hook LLM into `POST /facts/generate` for on-the-fly content creation
6. **True GRPO** — Sample N recommendation sets, compute group-relative advantages

## Key Research References

The architecture is inspired by:
- **DeepSeek-R1** (arXiv:2501.12948) — Pure RL incentivizes reasoning without human demonstrations
- **GRPO** (arXiv:2402.03300) — Group Relative Policy Optimization from DeepSeekMath
- **Multi-Memory RL** — Three-part memory architecture (episodic, semantic, procedural) for self-learning agents

## Running It

```bash
cd brainbyte/brainbyte-agent
source .venv/bin/activate
python3 api_service.py    # Starts on port 8090
# Or for CLI demo:
python3 agent.py
```

## Contact

Built in collaboration with Nishant (jhanishant2000@gmail.com).
