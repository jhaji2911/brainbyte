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

## Current Status

The app is currently in a development phase with temporary Firebase integration. Firebase is used for authentication (Firebase Auth) and data persistence (Firestore) to enable quick prototyping and testing. This setup allows for user management and real-time data sync but is not the final architecture. The mobile app loads Firebase configuration from environment variables to maintain security.

---

## Roadmap

### Future Integration with Rust API
The long-term plan is to fully integrate the Rust API for all backend operations, replacing Firebase with:
- **Updated Algorithms**: Implement advanced recommendation algorithms in Rust for personalized content delivery, adaptive difficulty, and user engagement optimization.
- **Real Data**: Transition from Firebase to the Rust API for handling user data, facts, leaderboards, and all app interactions, ensuring better performance, scalability, and data control.
- **Enhanced Features**: Add machine learning models for content generation, user behavior analysis, and accessibility improvements.

This will provide a more robust, self-hosted solution with improved privacy and customization.

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
yarn
yarn start          # opens Expo dev server
yarn android    # run on Android
yarn ios        # run on iOS
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
yarn
yarn dev
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


## Link to the app download (firebase auth version, the interruptions feature won't work since this is not play signed) 🔗
[BrainByte v0.1.0-beta](https://appdistribution.firebase.dev/i/3d909b220c854d4d)

---

## Contributions

Contributions are appreciated! Whether it's bug fixes, feature enhancements, documentation improvements, or algorithm development, feel free to reach out or submit pull requests. Connect with the maintainer at jhanishant2000@gmail.com for discussions or collaboration opportunities.

---

## License

MIT
