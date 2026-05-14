# BlueOcean CMS — Project Documentation (Handover)

Audience: Project Manager (PM) + next engineer taking over.

## 1) What this project is

BlueOcean CMS is a small web app that accepts PDF/CSV uploads, sends the file to an n8n workflow for processing, and then lets the user preview the resulting “vocabulary flashcards” and export the processed results as CSV or JSON.

The **supported backend for this project is the Firebase backend**: Upload → backend forwards file to n8n → n8n stores results in Firebase → frontend reads flashcards from Firebase via backend endpoints.

Note: A local backend exists in `backend/` and was used during initial testing/prototyping. It is not considered the primary/maintained backend for ongoing work.

## 2) High-level architecture

**Frontend**: React + TypeScript + Vite (port **3000**).

- Upload UI, file status cards, preview flashcards, export functions.
- Backend selection is a code toggle (not an env var).

**Backend (choose one to run at a time)**: Express server (port **3001**).

- `backend-firebase/` — forwards upload to n8n and provides API to read flashcards from Firestore.

Legacy/testing:

- `backend/` — initial non-Firebase prototype used for testing.

**n8n**: external workflow endpoint (webhook) that processes incoming file bytes.

- In local mode, returns JSON list of flashcards.
- In Firebase mode, stores results into Firestore collection `vocab_flashcards`.

**Firebase (Firebase backend mode only)**:

- Firestore holds flashcards.
- Auth via Firebase Admin SDK service account values in `.env`.

## 3) Repo layout

- `src/` — React app
  - `components/FileUploader.tsx`: upload/dropzone, calls backend upload
  - `components/FileCard.tsx`: shows upload progress + export + preview
  - `components/Flashcard.tsx`: single flashcard renderer
  - `components/FlashcardLibrary.tsx`: Firebase library view grouped by `source`
  - `utils/api.ts`: all frontend API calls
  - `utils/downloadHelper.ts`: CSV/JSON export helpers
  - `config/backend.config.ts`: backend selection + base URL
  - `types.ts`: `FileData`, `WordCard`
- `backend/` — Express upload-forwarding backend
- `backend-firebase/` — Express + Firebase Admin backend
- `docs/` — project documentation

## 4) Key user flows (PM-friendly)

1. User opens the CMS web app.
2. User drags in one or more `.pdf` or `.csv` files.
3. Each file shows a processing card (progress bar).
4. When processing completes:
   - User can **preview** generated flashcards.
   - User can **download** processed output as **CSV** or **JSON**.
5. If Firebase backend is enabled, a **Firebase Flashcard Library** section appears:
   - Shows flashcards grouped by `source` (typically the original filename).
   - Allows per-source export as CSV/JSON.

## 5) Backend modes and how to switch

Backend selection is controlled in **frontend code** via the `ACTIVE_BACKEND` constant in `src/config/backend.config.ts`.

For ongoing work, keep it set to `'firebase'` (the supported backend).

## 6) API contracts

### Frontend → Backend

Base URL comes from `src/config/backend.config.ts` (default `http://localhost:3001`).

**Health**

- `GET /health` → `{ status: "ok", ... }`

**Upload**

- `POST /api/upload` with `multipart/form-data`
  - field name must be `data` (see `src/utils/api.ts`)

**Upload response shape** (Firebase backend)

- `success: true`
- `note: "Data stored in Firebase. Use GET /api/flashcards to retrieve."`

### Firebase backend additional endpoints

- `GET /api/flashcards` → list of flashcards read from Firestore `vocab_flashcards`
- `GET /api/flashcards/:word` → single flashcard by Firestore document id (word)

Firestore mapping (current implementation):

- doc id → `word`
- fields: `category`, `definition`, `exampleSentence`, `label`, `mediaLink`, `pos`, `source`

## 7) n8n integration notes

### Firebase backend (`backend-firebase/server.js`)

- Upload is forwarded to `N8N_WEBHOOK_URL` from `.env`.
- n8n workflow is responsible for writing flashcards into Firestore collection `vocab_flashcards`.

## 8) Local development setup

### Prerequisites

- Node.js (modern version; project uses ESM and Vite)

### Frontend

From repo root:

- Install: `npm install`
- Run dev server: `npm run dev`
- App opens at `http://localhost:3000` (per `vite.config.ts`)

### Backend (Firebase)

- `cd backend-firebase`
- `npm install`
- Create `.env` (see below)
- `npm run dev`
- Runs on `http://localhost:3001`

## 9) Environment variables and secrets

### Firebase backend `.env`

Required keys (see `backend-firebase/server.js`):

- `FIREBASE_PROJECT_ID`
- `FIREBASE_PRIVATE_KEY` (string, with `\n` newlines; server converts `\\n` → `\n`)
- `FIREBASE_CLIENT_EMAIL`
- `N8N_WEBHOOK_URL`

Security:

- `backend-firebase/.gitignore` already ignores `.env`.
- Do **not** commit service account JSON or private key values.

## 10) Operational notes / known constraints

- CORS is configured to allow only `http://localhost:3000` in both backends.
- Max upload size is **10MB** (multer limit).
- Frontend “progress” is simulated (25% → 90% → 100%), not real upload progress.
- When using Firebase backend, upload completion does not automatically refresh the library; user can click **Refresh**.

## 11) Where to change things

Common changes and locations:

- **Switch backend mode**: `src/config/backend.config.ts`
- **Backend base URL / port**: `src/config/backend.config.ts` and backend `PORT` constants
- **n8n webhook URL**:
  - Firebase backend: `backend-firebase/.env`
- **Firestore collection name**: `backend-firebase/server.js` (`vocab_flashcards`)
- **Export format**: `src/utils/downloadHelper.ts` and mapping in `FileCard.tsx` / `FlashcardLibrary.tsx`

## 12) Quick troubleshooting

- Upload fails immediately: confirm backend is running on `http://localhost:3001/health`.
- CORS errors: frontend must be `http://localhost:3000`; update backend CORS `origin` if port changes.
- Firebase backend fails on start: check `.env` formatting, especially `FIREBASE_PRIVATE_KEY` quotes/newlines.
- Firebase library shows empty: confirm n8n workflow writes to Firestore `vocab_flashcards` and fields match expected mapping.

---

Owner notes

- Frontend runs on port 3000; backend runs on 3001.
- Only one backend should be running at a time.
