# BrainByte CMS

Admin panel for managing content in the BrainByte app, built on [Payload CMS v3](https://payloadcms.com/).

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env .env.local   # edit PAYLOAD_SECRET!

# 3. Start the dev server (creates the SQLite DB on first run)
npm run dev
# → admin panel at http://localhost:3000/admin
# → REST API    at http://localhost:3000/api/facts
```

On first launch, Payload will prompt you to create an admin user.

## Content Types

| Collection | Description |
|---|---|
| **Facts** | Knowledge bytes displayed in the app feed and library |
| **Categories** | Knowledge domains (Science, Psychology, History, …) used for filtering |
| **Media** | Uploaded images for fact cards and curator avatars |
| **Users** | CMS admin/editor accounts (separate from app users) |

## Connecting to the Rust API

The Rust API (`/api`) can pull published facts from the CMS via:

```
POST http://localhost:8080/cms/sync
X-Sync-Secret: dev-sync-secret
```

This fetches all `published` facts from `http://localhost:3000/api/facts` and upserts them into the in-memory store.

Set these env vars in the Rust API:
- `CMS_API_URL` — URL of this CMS (default: `http://localhost:3000`)
- `CMS_SYNC_SECRET` — shared secret for the sync endpoint (default: `dev-sync-secret`)

## Seeding Initial Data

After creating an admin account, run:

```bash
npm run seed
```

This imports the five hard-coded facts from the Rust API seed data into Payload so you have content to work with immediately.

## REST API

Payload exposes a full REST API at `/api/<collection>`:

```
# List published facts (depth=1 populates category objects)
GET http://localhost:3000/api/facts?where[status][equals]=published&depth=1

# Get a single fact
GET http://localhost:3000/api/facts/:id

# List categories
GET http://localhost:3000/api/categories
```

Authentication (for write operations) uses Payload's built-in JWT:

```
POST http://localhost:3000/api/users/login
{"email":"admin@example.com","password":"..."}
# → returns token for Authorization: JWT <token>
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with Turbopack |
| `npm run build` | Production build |
| `npm run seed` | Import seed facts & categories into the DB |
| `npm run generate:types` | Regenerate TypeScript types from collections |
| `npm run generate:importmap` | Regenerate import map after adding custom views |
