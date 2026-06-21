# BrainByte API

Rust API server for the BrainByte mobile/web clients. Uses in-memory state seeded from the frontend data so the UI can be wired to real endpoints before a database exists. Proxies recommendation and learning requests to the RL-CoT agent backend (port 8090).

## Run

```bash
cd api
cargo run
```

The server listens on `http://127.0.0.1:8080`.

## Seed auth

Use this bearer token for the seeded "Felix" user:

```text
seed-token-felix
```

Or log in with:

```text
email: felix@example.com
password: password123
```

## Endpoints

### Health

- `GET /health`

### Authentication

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`

Register/login payload:

```json
{
  "name": "Nishant",
  "email": "nishant@example.com",
  "password": "password123"
}
```

Login payload:

```json
{
  "email": "felix@example.com",
  "password": "password123"
}
```

### Onboarding

- `GET /onboarding`
- `POST /onboarding`

Payload:

```json
{
  "selected_poison": "History",
  "daily_goal": "Growth (5-7 bytes)",
  "interrupts_enabled": true
}
```

### Facts

- `GET /facts/recommended` — Agent-ranked recommendations with CoT trace
- `GET /facts/recommended?n_results=5`
- `POST /facts/learn` — Send interaction signal to RL agent
- `GET /facts`
- `GET /facts?saved_only=true`
- `GET /facts?category=Psychology`
- `GET /facts/random`
- `GET /facts/random?category=Productivity`
- `POST /facts/generate`
- `GET /facts/{id}`
- `POST /facts/{id}/save`
- `DELETE /facts/{id}/save`

Generator payload:

```json
{
  "category": "Psychology",
  "prompt": "why unfinished tasks keep buzzing in my head"
}
```

Learn payload:

```json
{
  "content_id": "fact-1",
  "action": "save",
  "dwell_time": 12.5,
  "rating": 1.0
}
```

### Leaderboard

- `GET /leaderboard`

## Example

```bash
curl -X POST http://127.0.0.1:8080/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"felix@example.com","password":"password123"}'
```

Authenticated request:

```bash
curl http://127.0.0.1:8080/leaderboard \
  -H 'authorization: Bearer seed-token-felix'
```

## Notes

- State is in-memory only and resets when the process restarts.
- Passwords are stored in plaintext because this is a local prototype. Do not ship that to production.
- Response keys use snake_case for straightforward Rust/Serde defaults.
