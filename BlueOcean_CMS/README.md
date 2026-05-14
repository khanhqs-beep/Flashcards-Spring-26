# BlueOcean CMS

React + TypeScript + Vite frontend for uploading PDF/CSV files, processing them via n8n, previewing vocabulary flashcards, and exporting processed results as CSV/JSON.

For the full handover documentation (architecture, endpoints, env vars, and operational notes), see:

- [docs/PROJECT_DOCUMENTATION.md](docs/PROJECT_DOCUMENTATION.md)

## Quick start

### Frontend

From repo root:

- `npm install`
- `npm run dev`

Runs at `http://localhost:3000`.

### Backend (Firebase)

The backend run on port `3001`.

**Firebase backend (n8n writes results to Firestore; frontend reads via API)**

- `cd backend-firebase`
- `npm install`
- create `backend-firebase/.env` (see [docs/PROJECT_DOCUMENTATION.md](docs/PROJECT_DOCUMENTATION.md))
- `npm run dev`

Legacy/testing:

- `backend/` exists as an early non-Firebase prototype used during initial testing.

## Switching backend mode

Edit `src/config/backend.config.ts` and keep `ACTIVE_BACKEND` set to `'firebase'` for the supported backend.
