# BrainByte

A bite-sized learning app that delivers daily knowledge in a swipeable dopamine feed. BrainByte is a full-stack monorepo consisting of a React Native mobile app, a Rust API, and a Payload CMS for content management.

---

## Architecture

```
bbyte/
├── mobile/   # React Native (Expo) app
├── api/      # Rust (Axum) REST API
└── cms/      # Payload CMS (Next.js + SQLite)
```

### Mobile (`/mobile`)
React Native app built with Expo. Features a TikTok-style swipeable feed of "bytes" (bite-sized knowledge cards), a focus session timer, a saved library, a leaderboard, interactive lessons, and user profiles. State is managed with Zustand and React Query, with Firebase for auth persistence.

**Key screens:**
- Splash / Onboarding (topic selection & goals)
- Dopamine Feed — swipe through knowledge bytes
- Fact Detail — expanded view with source
- Focus Session — timed deep-focus mode
- Library — saved bytes
- Leaderboard — XP & streak rankings
- Interactive Lesson — quiz-style learning
- Profile — stats, avatar, settings

### API (`/api`)
REST API written in Rust using [Axum](https://github.com/tokio-rs/axum). Runs on port `8080`. Handles auth (register/login), user onboarding profiles, facts/bytes (list, random, save/unsave), leaderboard, and a CMS sync endpoint.

**Endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/auth/register` | Register a new user |
| POST | `/auth/login` | Login |
| GET | `/auth/me` | Get current user |
| GET/POST | `/onboarding` | Get or upsert onboarding profile |
| GET | `/facts` | List facts |
| GET | `/facts/random` | Get a random fact |
| POST | `/facts/generate` | Generate a fact |
| GET | `/facts/:id` | Get a fact by ID |
| POST/DELETE | `/facts/:id/save` | Save or unsave a fact |
| GET | `/leaderboard` | Get leaderboard |
| POST | `/cms/sync` | Sync content from CMS |

### CMS (`/cms`)
[Payload CMS](https://payloadcms.com/) running on Next.js with a SQLite database. Manages the content pipeline for facts/bytes with collections for Facts, Categories, Media, and Users. Exposes its REST API to the Rust backend for content sync.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native, Expo, TypeScript |
| State | Zustand, TanStack React Query |
| Auth | Firebase |
| API | Rust, Axum, Tokio, Serde |
| CMS | Payload CMS, Next.js, SQLite |

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) >= 18
- [Rust](https://www.rust-lang.org/tools/install) (stable)
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- Android Studio or Xcode (for mobile simulators)

### 1. Mobile

```bash
cd mobile
npm install
npm start          # opens Expo dev server
npm run android    # run on Android
npm run ios        # run on iOS
```

### 2. API

```bash
cd api
cargo run
# API available at http://localhost:8080
```

### 3. CMS

```bash
cd cms
npm install
npm run dev
# CMS available at http://localhost:3000/admin
```

Set the following environment variables in `cms/.env`:

```env
PAYLOAD_SECRET=your_secret_here
DATABASE_URI=file:./bbyte-cms.db
NEXT_PUBLIC_SERVER_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8080
```

---

## Project Structure

```
mobile/src/
├── components/   # Screen components (Feed, Library, Profile, etc.)
├── state/        # AppState context (screen navigation, core logic)
├── store/        # Zustand store
├── lib/          # Firebase, React Query client, app monitor
├── types.ts      # Shared TypeScript types
├── theme.ts      # Colors and design tokens
├── constants.ts
└── api.ts        # API client

api/src/
└── main.rs       # Axum server, routes, state, handlers

cms/src/
├── payload.config.ts
├── collections/
│   ├── Facts.ts
│   ├── Categories.ts
│   ├── Media.ts
│   └── Users.ts
└── app/          # Next.js app router
```

---

## License

MIT
