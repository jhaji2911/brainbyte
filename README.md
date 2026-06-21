# BrainByte

A **self-learning micro-learning app** where an LLM-powered curation agent learns what fascinates you, curates knowledge on the fly, and gets smarter with every swipe. Built for minimal infrastructure — a single Python backend serves both the API and a PWA web client. The React Native mobile app talks to the same backend.

> **v2 Proof of Concept** — The agent decides *what* to curate, the LLM generates *fresh* content (or reuses existing bytes across users to save tokens), and every save/skip/dwell-time signal trains the recommendation policy. Knowledge diffuses across users: if a Physics byte works well for one user, it gets recommended to other Physics-interested users.

---

## Architecture

```
brainbyte/
├── brainbyte-v2/       # ★ v2 backend — single-file FastAPI (port 8080)
│   ├── server.py       #   Agent + Curator + Memory + PWA (everything)
│   ├── web/index.html  #   PWA for testing
│   ├── requirements.txt
│   └── .env            #   LLM_API_KEY, LLM_BASE_URL, LLM_MODEL
│
├── mobile/             # React Native (Expo) app — wired to v2 backend
│   ├── App.tsx
│   └── src/
│       ├── components/  # DopamineFeed, Onboarding, Register, GameCard, etc.
│       ├── state/       # AppState (navigation, auth, learning signals)
│       ├── store/       # Zustand store with AsyncStorage persistence
│       ├── rust_api.ts  # ★ API client for v2 backend
│       └── types.ts
│
├── api/                # [Legacy] Rust Axum API (v1)
├── brainbyte-agent/    # [Legacy] Multi-file Python agent (v1)
└── cms/                # [Legacy] Payload CMS
```

### How the v2 Agent Works

```
                      ┌──────────────────────────┐
                      │      Mobile App (PWA)      │
                      │  swipe → save/skip/dwell   │
                      └──────────┬─────────────────┘
                                 │ HTTP POST /api/feed/curate-batch
                                 ▼
                      ┌──────────────────────────┐
                      │   BrainByte v2 Backend     │
                      │   ┌────────────────────┐  │
                      │   │     AGENT           │  │
                      │   │  _decide(): scores   │  │
                      │   │  all 20 topics by:   │  │
                      │   │  • user interests     │  │
                      │   │  • exemplar success   │  │
                      │   │  • novelty bonus      │  │
                      │   │  • skip penalty       │  │
                      │   └────────┬─────────────┘  │
                      │            │ topic, diff    │
                      │   ┌────────▼─────────────┐  │
                      │   │    CURATOR            │  │
                      │   │  find_existing_content│  │ ← reuse if available
                      │   │  OR _llm_generate()   │  │ ← fetch from LLM
                      │   │  OR _mock_generate()  │  │ ← mock library (no key)
                      │   └────────┬─────────────┘  │
                      │            │ Byte object     │
                      │   ┌────────▼─────────────┐  │
                      │   │    LEARN              │  │
                      │   │  reward = 1.0 (save)   │  │
                      │   │         = -0.5 (skip)  │  │
                      │   │  update_exemplar()     │  │ ← EMA success rates
                      │   │  increment XP/streak   │  │
                      │   │  store_knowledge()     │  │ ← extract patterns
                      │   └────────────────────────┘  │
                      └───────────────────────────────┘
```

---

## Quick Start (v2)

### Prerequisites
- Python >= 3.10
- Node.js >= 18 (for mobile)

### Backend

```bash
cd brainbyte-v2
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Mock mode (no LLM key needed — uses 42+ hand-written bytes across 6 categories)
python3 server.py

# Live mode (with DeepSeek or any OpenAI-compatible API)
LLM_API_KEY=sk-... LLM_MODEL=deepseek-v4-flash LLM_BASE_URL=https://api.deepseek.com/v1 python3 server.py
```

Server starts at `http://localhost:8080`. Open the PWA in your browser or use the mobile app.

### Mobile App (Expo Web)

```bash
cd mobile
npm install
EXPO_PUBLIC_API_URL=http://localhost:8080 npx expo start --web --port 8081
```

Open `http://localhost:8081` in your browser.

### Run Tests

```bash
cd brainbyte-v2
source .venv/bin/activate

# Single-user rigorous test
python3 server.py --test

# Multi-user knowledge diffusion simulation
python3 server.py --multi-user-test
```

---

## API (v2)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health + memory stats |
| `POST` | `/api/auth/register` | Register with `{name, interests}` → returns token + preloaded bytes |
| `POST` | `/api/auth/login` | Login with `{user_id}` |
| `GET` | `/api/auth/me` | User profile + XP + streak + saved IDs |
| `POST` | `/api/feed/curate` | Agent curates ONE byte (decides topic/difficulty/format) |
| `POST` | `/api/feed/curate-batch?count=N` | Agent curates N bytes |
| `POST` | `/api/feed/interact` | Send learning signal `{content_id, action, dwell_time, rating}` |
| `GET` | `/api/leaderboard` | XP-ranked users |
| `GET` | `/api/demo/report` | Agent learning report: exemplars, token efficiency, knowledge facts |
| `GET` | `/` | PWA web client |

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Single-file backend** | One `server.py` with SQLite — no Docker, no microservices. Start with one command. |
| **Mock mode first** | 42+ hand-written bytes + games across 6 categories. Works without any API keys. |
| **Content reuse** | `find_existing_content()` matches on `curated_topic` — saves tokens by reusing bytes across users with similar interests |
| **Topic diversity** | Agent tracks last 3 topics per user, avoids repeats. Game titles are unique for proper dedup. |
| **LLM-agnostic** | Uses OpenAI-compatible API. Tested with DeepSeek v4 Flash. Works with any provider. |
| **Simplified auth** | Token-based, sessions in-memory. No bcrypt, no JWT — designed for demo/single-server. |
| **XP/Streak** | Reward ≥ 0.5 increments XP (reward × 10) and streak. Reflected in leaderboard. |

---

## Mobile App Screens

| Screen | Description |
|--------|-------------|
| Splash | Animated boot with progress labels |
| Onboarding | Name → topic interests → daily goal → auto-register |
| Dopamine Feed | Swipeable cards. Dwell-time tracked. Games open in modal overlay |
| Game Modal | Quiz, Word Scramble, Fill-in-the-Blank — agent-generated |
| Library | Saved bytes |
| Leaderboard | XP & streak rankings |
| Profile | Stats, avatar, interrupt settings |

---

## Remaining Work

| Priority | Task | Status |
|----------|------|--------|
| 🔴 | Real semantic embeddings (sentence-transformers) | Not yet — uses n-gram hash |
| 🔴 | Web-based content fetching (agent searches open web) | Not yet — LLM generates from prompt |
| 🟡 | Feather icon rendering on web | Garbled unicode on Expo web — needs web-compatible icon set |
| 🟡 | Re-fetch user XP after each interaction in feed header | Currently updates local store but header doesn't re-read |
| 🟡 | Fill-in-blank game TextInput on web | Layout overflow on narrow screens |
| 🟢 | Dockerize | Single command would be nice |
| 🟢 | PWA offline support + service worker | Nice-to-have |

---

## Legacy (v1)

The original v1 architecture used a 3-service stack:
- **Rust Axum API** (`api/`) — proxied to agent
- **Python RL-CoT Agent** (`brainbyte-agent/`) — multi-file with TurboVec
- **Payload CMS** (`cms/`)

This was overkill for an MVP. The v2 single-file backend replaces all of it.

---

## License

MIT
