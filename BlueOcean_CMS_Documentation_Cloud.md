# BlueOcean CMS — Cloud Deployment Documentation

## 1) Overview

BlueOcean CMS is a web-based content processing tool that allows users to upload PDF or CSV files, send them to an n8n workflow for processing, preview generated vocabulary flashcards, and export results as CSV or JSON.

All processed results are stored in PostgreSQL and retrieved by the frontend through backend APIs. Flashcard illustrations are stored in MinIO (S3-compatible object storage). The system includes a library view that allows users to revisit previously generated flashcards grouped by source.

### Key outcomes

- Users can upload one or multiple PDF/CSV files.
- Files are processed through n8n automation.
- Output is stored persistently in PostgreSQL.
- Illustrations are stored in MinIO.
- Output is presented as flashcards (word, definition, example sentence, etc.).
- Output can be downloaded in CSV or JSON format.
- A library view displays previously generated flashcards grouped by source.

---

## 2) User-facing behavior

### Primary flow

1. User opens the CMS web app at its Coolify-assigned URL.
2. User drags and drops (or selects) one or more `.pdf` or `.csv` files.
3. Each file shows a processing status and progress indicator.
4. Once processing is complete, the user can:
   - Preview generated flashcards.
   - Download flashcards as CSV.
   - Download flashcards as JSON.

### Flashcard library

- The UI displays a "Flashcard Library" section.
- The library loads flashcards from PostgreSQL, groups them by source, and allows per-source preview and export (CSV or JSON).

---

## 3) High-level architecture (cloud)

All services are deployed on **Coolify** running on **AWS Lightsail**.

```
┌───────────────────────────────────────────────────────────────────┐
│                      AWS Lightsail Instance                       │
│                          (Coolify)                                │
│                                                                   │
│  ┌───────────┐  ┌───────────┐  ┌────────┐  ┌──────┐  ┌───────┐  │
│  │ Frontend   │  │ Backend   │  │  n8n   │  │ Pg   │  │ MinIO │  │
│  │ React+Vite │─▶│ Express   │─▶│        │─▶│      │  │       │  │
│  │ :3000      │  │ :3001     │  │ :5678  │  │:5432 │  │ :9000 │  │
│  └───────────┘  └─────┬─────┘  └───┬────┘  └──┬───┘  └───┬───┘  │
│                       │            │           │          │       │
│                       └────────────┴───────────┴──────────┘       │
│                          All internal on Coolify network           │
└───────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │  Google Gemini API  │
                    │  (external, API     │
                    │   key only)         │
                    └────────────────────┘
```

### Frontend

- **Stack:** React + TypeScript + Vite
- **Deployed as:** Coolify app (Nixpacks or Dockerfile)
- **URL:** Coolify-assigned domain
- **Responsibilities:** File upload UI, calling backend APIs, rendering flashcards, CSV/JSON export, library display.

### Backend

- **Stack:** Express (Node.js) + `pg` (PostgreSQL client)
- **Deployed as:** Coolify app (Nixpacks or Dockerfile)
- **URL:** Coolify-assigned domain
- **Responsibilities:** Accept file uploads, forward to n8n webhook, expose PostgreSQL-backed APIs.

### n8n

- **Deployed as:** Coolify app using `n8nio/n8n` Docker image
- **URL:** Coolify-assigned domain
- **Responsibilities:** Receive files via webhook, extract vocabulary via AI, write to PostgreSQL, generate illustrations, upload to MinIO.

### PostgreSQL

- **Deployed as:** Coolify service (managed PostgreSQL)
- **Purpose:** Stores all flashcard data.
- **Internal only** — not exposed to the internet.

### MinIO

- **Deployed as:** Coolify app using `minio/minio` Docker image
- **Purpose:** S3-compatible object storage for flashcard illustrations.
- **Public read access** — images are served directly from MinIO's public URL.

### Google Gemini (external)

- Used via standalone API key (no GCP project or service account needed).
- Provides text enrichment and image generation.

---

## 4) Backend behavior

1. Frontend sends file upload to the backend's `/api/upload` endpoint.
2. Backend forwards the raw file to the n8n webhook URL.
3. n8n processes the file, writes flashcard data to PostgreSQL, and uploads illustrations to MinIO.
4. The upload API returns an acknowledgment only.
5. Frontend loads flashcards via `GET /api/flashcards` (reads from PostgreSQL).

---

## 5) Deployment setup (Coolify on Lightsail)

### Prerequisites

- An AWS Lightsail instance running Coolify.
- A Google Gemini API key (get one at https://aistudio.google.com/apikey).

### Step 1: Deploy PostgreSQL

1. In Coolify, add a new **Service** > **PostgreSQL**.
2. Note the generated credentials (or set your own):
   - Database name, username, password
   - The internal connection URL will look like: `postgresql://user:pass@<pg-service>:5432/dbname`
3. Deploy.

### Step 2: Deploy MinIO

1. In Coolify, create a new application using Docker image `minio/minio`.
2. **Start command:** `server /data --console-address ":9001"`
3. **Ports:** `9000` (API) and `9001` (console UI)
4. Set environment variables:

| Variable | Value |
|---|---|
| `MINIO_ROOT_USER` | Your chosen admin username |
| `MINIO_ROOT_PASSWORD` | Your chosen admin password (min 8 chars) |

5. Mount a persistent volume at `/data`.
6. Deploy and note:
   - **API URL:** `https://<minio-coolify-domain>` (port 9000)
   - **Console URL:** port 9001 (for web UI access)
7. Open the MinIO console and create a bucket called `flashcards`.
8. Set the bucket's access policy to **public** (so images can be loaded by the frontend).

### Step 3: Deploy n8n

1. In Coolify, create a new application using Docker image `n8nio/n8n`.
2. **Port:** `5678`
3. Set environment variables:

| Variable | Value |
|---|---|
| `N8N_PROTOCOL` | `https` |
| `N8N_HOST` | Your n8n Coolify domain (without `https://`) |
| `WEBHOOK_URL` | `https://<your-n8n-coolify-domain>` |
| `N8N_ENCRYPTION_KEY` | Random string (`openssl rand -hex 32`) |
| `GENERIC_TIMEZONE` | `America/New_York` (or your timezone) |
| `N8N_SECURE_COOKIE` | `true` |
| `MINIO_BUCKET` | `flashcards` |
| `MINIO_PUBLIC_URL` | `https://<minio-coolify-domain>` |

4. Mount a persistent volume at `/home/node/.n8n`.
5. Deploy, create admin account.
6. Import the workflow from `Automated Vocab Flashcard Generation n8n Workflow (PostgreSQL + MinIO).json`.
7. Configure credentials inside n8n:
   - **Google Gemini (PaLM) API** — your Gemini API key.
   - **PostgreSQL** — host/port/db/user/password from Step 1.
   - **S3 (MinIO)** — endpoint URL, access key, secret key from Step 2.
8. Activate the workflow and copy the **production webhook URL**.

### Step 4: Run database migration

Before the backend can serve data, create the `vocab_flashcards` table:

```bash
# From the backend directory, with DATABASE_URL set:
node migrate.js
```

Or run the SQL directly against PostgreSQL:

```sql
CREATE TABLE IF NOT EXISTS vocab_flashcards (
  word TEXT PRIMARY KEY,
  category TEXT,
  definition TEXT,
  example_sentence TEXT,
  label TEXT,
  media_link TEXT,
  pos TEXT,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flashcards_source ON vocab_flashcards(source);
```

### Step 5: Deploy the backend

1. In Coolify, create a new application from the Git repository.
   - **Build path:** `BlueOcean_CMS/backend`
   - **Build pack:** Nixpacks (auto-detects Node.js)
   - **Start command:** `node server.js`
   - **Port:** `3001`
2. Set environment variables:

| Variable | Value |
|---|---|
| `DATABASE_URL` | `postgresql://user:pass@<pg-internal-host>:5432/dbname` |
| `N8N_WEBHOOK_URL` | Production webhook URL from Step 3 |
| `CORS_ORIGIN` | Will be set after frontend deploys |
| `PORT` | `3001` |

3. Deploy and test: `GET https://<backend-url>/health`

### Step 6: Deploy the frontend

1. In Coolify, create a new application from the Git repository.
   - **Build path:** `BlueOcean_CMS`
   - **Build pack:** Nixpacks (auto-detects Vite/React)
   - **Build command:** `npm run build`
   - **Publish directory:** `build`
2. Set environment variable:

| Variable | Value |
|---|---|
| `VITE_BACKEND_URL` | `https://<backend-coolify-domain>` |

3. Deploy and note the public URL.

### Step 7: Wire up CORS

Go back to the backend in Coolify and set `CORS_ORIGIN` to the frontend's URL. Redeploy the backend.

### Step 8: Verify end-to-end

1. Open the frontend URL in a browser.
2. Check backend health: `GET https://<backend-url>/health`
3. Upload a test PDF.
4. Wait for n8n to process, then click Refresh in the Flashcard Library.
5. Verify flashcards appear with illustrations.

---

## 6) Environment variables summary

### PostgreSQL (Coolify service)

Auto-configured by Coolify. Note the internal connection string.

### MinIO

| Variable | Value |
|---|---|
| `MINIO_ROOT_USER` | Admin username |
| `MINIO_ROOT_PASSWORD` | Admin password |

### n8n

| Variable | Description |
|---|---|
| `N8N_PROTOCOL` | `https` |
| `N8N_HOST` | Coolify-assigned domain |
| `WEBHOOK_URL` | `https://<n8n-domain>` |
| `N8N_ENCRYPTION_KEY` | Random encryption key |
| `GENERIC_TIMEZONE` | Timezone |
| `N8N_SECURE_COOKIE` | `true` |
| `MINIO_BUCKET` | `flashcards` |
| `MINIO_PUBLIC_URL` | MinIO public URL |

### Backend

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@pg:5432/flashcards` |
| `N8N_WEBHOOK_URL` | n8n webhook endpoint | `https://<n8n-url>/webhook/xxx` |
| `CORS_ORIGIN` | Frontend URL | `https://<frontend-url>` |
| `PORT` | Server port | `3001` |

### Frontend

| Variable | Description | Example |
|---|---|---|
| `VITE_BACKEND_URL` | Backend public URL | `https://<backend-url>` |

### Security

- Never commit `.env` files or credentials to the repository.
- Store all secrets in Coolify's environment variable manager (encrypted at rest).
- Rotate credentials immediately if exposure is suspected.

---

## 7) API surface

All API calls are made from the frontend to the backend's Coolify-assigned URL.

### Health check

`GET /health` — Verify the backend is running.

### Upload

`POST /api/upload`
- Content type: `multipart/form-data`
- Required field name: `data`
- Supported file types: PDF and CSV
- Response: `{ "success": true, "message": "File uploaded and sent for processing" }`

### Flashcard retrieval

`GET /api/flashcards` — Returns all flashcards from the `vocab_flashcards` table.

`GET /api/flashcards/:word` — Returns a single flashcard by word.

---

## 8) Data model

### PostgreSQL schema

- **Table:** `vocab_flashcards`
- **Primary key:** `word`

| Column | Type | Description |
|---|---|---|
| `word` | `TEXT` | The vocabulary word (PK) |
| `category` | `TEXT` | Word category |
| `definition` | `TEXT` | Short definition |
| `example_sentence` | `TEXT` | Example usage |
| `label` | `TEXT` | CEFR level (A1-C1) |
| `media_link` | `TEXT` | URL to illustration in MinIO |
| `pos` | `TEXT` | Part of speech |
| `source` | `TEXT` | Originating filename |
| `created_at` | `TIMESTAMPTZ` | Auto-set on insert |

---

## 9) Operational notes

- **CORS:** Must be configured to allow the frontend's Coolify domain.
- **Max upload size:** 10MB.
- **Upload progress:** Staged in the UI (not byte-accurate).
- **Library refresh:** After uploading, users may need to click Refresh depending on n8n processing time.
- **SSL:** Coolify provides automatic HTTPS via Let's Encrypt or its proxy.
- **Backups:** Configure PostgreSQL backups in Coolify. MinIO volume should also be backed up.

---

## 10) Troubleshooting

| Problem | Check |
|---|---|
| Upload fails | Backend health endpoint reachable? `VITE_BACKEND_URL` correct? |
| CORS errors | `CORS_ORIGIN` matches frontend URL exactly (including `https://`)? |
| n8n not processing | `N8N_WEBHOOK_URL` correct? Workflow activated? |
| Backend won't start | `DATABASE_URL` correct? PostgreSQL service running? |
| Library empty | n8n writing to `vocab_flashcards`? PostgreSQL credentials in n8n correct? |
| Images not loading | MinIO bucket set to public? `MINIO_PUBLIC_URL` correct in n8n env? |
| Database errors | Run `node migrate.js` to ensure table exists. |

---

## 11) Handover checklist

- [ ] Coolify instance running on Lightsail with sufficient resources.
- [ ] PostgreSQL deployed and migration run (`vocab_flashcards` table exists).
- [ ] MinIO deployed with `flashcards` bucket set to public.
- [ ] n8n deployed with persistent volume, workflow imported + activated.
- [ ] n8n credentials configured (Gemini API key, PostgreSQL, S3/MinIO).
- [ ] Backend deployed with `DATABASE_URL`, `N8N_WEBHOOK_URL`, `CORS_ORIGIN`.
- [ ] Frontend deployed with `VITE_BACKEND_URL`.
- [ ] CORS wired up (backend allows frontend origin).
- [ ] End-to-end test: upload PDF -> n8n processes -> flashcards appear in library with images.
