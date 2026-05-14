# BlueOcean CMS — Coolify Deployment Guide

Target Coolify dashboard: **http://13.212.142.126:8000/**

This guide assumes Coolify is already running on the AWS instance at `13.212.142.126`. You will deploy **five resources** inside one Coolify Project. Each step matches a screen in the Coolify UI.

---

## 0. Is the code Coolify-ready?

**Yes — no further code changes are required.** The rewrite already does everything needed:

| Concern | How it's handled |
|---|---|
| DB connection | Backend reads `DATABASE_URL` (any Postgres URL works) |
| n8n webhook | Backend reads `N8N_WEBHOOK_URL` at runtime |
| CORS | Backend reads `CORS_ORIGIN` |
| Port | Backend reads `PORT` (defaults to 3001) |
| Frontend → backend | Vite bundle reads `VITE_BACKEND_URL` (baked in at build) |
| Schema | `backend/migrate.js` is idempotent and runs on every container start (see Dockerfile `CMD`) |
| Secrets | No service-account JSON files. Everything is env-var driven. |

What this repo now contains (added in this pass):

```
BlueOcean_CMS/
├── Dockerfile              # frontend (multi-stage build → nginx)
├── nginx.conf              # SPA routing + caching
├── docker-compose.yml      # full-stack local reference
├── .dockerignore
└── backend/
    ├── Dockerfile          # backend (Node 20 alpine, runs migrate.js → server.js)
    └── .dockerignore
```

---

## 1. Architecture on Coolify

One **Project**, one **Environment** (call it `production`), five resources:

| # | Resource | Type in Coolify | Source | Internal hostname* |
|---|---|---|---|---|
| 1 | `postgres` | **Database** → PostgreSQL 16 | Coolify-managed | `<service>-db` (Coolify shows it) |
| 2 | `minio` | **Service** → MinIO | One-click template | `minio` |
| 3 | `n8n` | **Service** → n8n (with Postgres) | One-click template | `n8n` |
| 4 | `backend` | **Application** | Git repo, path `BlueOcean_CMS/backend`, Dockerfile | `backend` |
| 5 | `frontend` | **Application** | Git repo, path `BlueOcean_CMS`, Dockerfile | `frontend` |

*Coolify lets services in the same Project reach each other by container name over the internal Docker network. This means **the backend never has to traverse the public internet to talk to Postgres, MinIO, or n8n** — a huge latency win and a security win.

```
Browser ─► frontend (nginx, public)
              │ VITE_BACKEND_URL baked in at build
              ▼
            backend (Express, public)
              │     │
              │     └─► DATABASE_URL ───► postgres (private)
              │
              └─► N8N_WEBHOOK_URL ──► n8n (private)
                                       │
                                       ├─► postgres (writes flashcards)
                                       ├─► minio   (uploads illustrations via S3)
                                       └─► Gemini API (HTTPS, public)
```

---

## 2. Prerequisites

1. SSH or Coolify-UI access to the instance at `13.212.142.126`.
2. Git repository pushed somewhere Coolify can clone (GitHub/GitLab/Bitbucket, or use the "Public Repository" option for a public repo). If you'd rather avoid Git, Coolify also accepts "Dockerfile" deploys where you paste the Dockerfile directly.
3. **Gemini API key** (https://aistudio.google.com/apikey).
4. Decide on a **public domain** for each public service, or use Coolify's auto-assigned `*.sslip.io`/`*.coolify.app`-style URLs.

> If you don't have a domain yet, just use Coolify's auto-generated URLs and come back to add a custom domain later — no code changes required.

---

## 3. Step-by-step deployment

### 3.1 Create the Project

1. Log in to Coolify at **http://13.212.142.126:8000/**.
2. **Projects → + Add** → name it `flashcards-spring-26`.
3. Inside it, an environment named `production` is created automatically.

### 3.2 Deploy PostgreSQL

1. **+ Add Resource → Database → PostgreSQL**.
2. Version: **16**.
3. Coolify auto-generates user/password/db name — leave them, or rename. **Copy the "Postgres URL"** that appears after creation. It looks like:
   ```
   postgres://<user>:<password>@<service-name>:5432/<db>
   ```
4. Click **Deploy**. Wait for the green "Running" state.
5. (Optional) Under **Settings → Public Port** you can expose 5432 for `psql` access from your laptop. Not required for the app to work.

> Coolify exposes this URL as the magic env var `${POSTGRES_URL}` (or similar — name shown on the DB page) that other services in the same project can reference.

### 3.3 Deploy MinIO

1. **+ Add Resource → Service → MinIO**.
2. Coolify generates `MINIO_ROOT_USER` and `MINIO_ROOT_PASSWORD`. Note both.
3. Under **Storages** verify a persistent volume is attached at `/data`.
4. Deploy. Once up, open the **MinIO Console** (port 9001, Coolify gives you a URL):
   - Create a bucket named `flashcards`.
   - **Buckets → flashcards → Anonymous → Add Access Rule → readonly** (so the `<minio-host>/flashcards/<key>` URLs returned by n8n are public-readable).
   - **Access Keys → Create access key** — save the key/secret for n8n.

### 3.4 Deploy n8n

1. **+ Add Resource → Service → n8n (with Postgres)**.
2. Coolify provisions n8n + its own Postgres. Set these env vars:

   | Variable | Value |
   |---|---|
   | `N8N_HOST` | Your n8n public hostname (Coolify will offer one) |
   | `WEBHOOK_URL` | `https://<n8n-host>` |
   | `N8N_PROTOCOL` | `https` |
   | `N8N_ENCRYPTION_KEY` | run `openssl rand -hex 32` and paste |
   | `GENERIC_TIMEZONE` | e.g. `America/New_York` |
   | `N8N_SECURE_COOKIE` | `true` |

3. Confirm the persistent volume on `/home/node/.n8n`.
4. Deploy. Open the n8n URL and create the admin account.
5. **Import the workflow:** Workflows → Import from File → `Automated Vocab Flashcard Generation n8n Workflow.json`. (Since the rewrite swaps Firestore → Postgres and Firebase Storage → MinIO, open each node that previously used Firestore/GCS and reconnect it to your new Postgres + MinIO/S3 credentials — see §4 below.)
6. Activate the workflow → click the **Upload Vocabulary PDF** webhook node → copy the **Production URL** (looks like `https://<n8n-host>/webhook/<uuid>`). You'll paste this into the backend in 3.5.

### 3.5 Deploy the backend

1. **+ Add Resource → Application → Public Repository** (or your Git provider).
2. Repository: your fork/clone of this codebase. Branch: `main`.
3. **Build Pack:** `Dockerfile`.
4. **Base Directory:** `/BlueOcean_CMS/backend` (so Coolify uses the Dockerfile we just added).
5. **Port:** `3001`.
6. **Environment Variables:**

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Paste the Postgres URL from 3.2 (use the **internal** host, not the public one — typically `postgresql://user:pw@<postgres-service-name>:5432/db`) |
   | `N8N_WEBHOOK_URL` | The webhook URL from 3.4 |
   | `CORS_ORIGIN` | The frontend's eventual public URL (from 3.6) — you can set this **after** 3.6 and redeploy |
   | `PORT` | `3001` |

7. **Health Check Path:** `/health`.
8. Deploy. The Dockerfile runs `node migrate.js` first, so the `vocab_flashcards` table is created automatically on first boot.

### 3.6 Deploy the frontend

1. **+ Add Resource → Application** → same repo.
2. **Build Pack:** `Dockerfile`.
3. **Base Directory:** `/BlueOcean_CMS`.
4. **Port:** `80`.
5. **Build Arguments** (this is the key step — Vite bakes env vars at build time):

   | Build Arg | Value |
   |---|---|
   | `VITE_BACKEND_URL` | The backend's public URL from 3.5 (e.g. `https://api-flashcards.yourdomain.com`) |

6. Deploy.
7. Go back to the **backend** resource → set `CORS_ORIGIN` to the frontend's public URL → redeploy backend.

### 3.7 Verify end-to-end

1. `curl https://<backend-public-url>/health` → expect `{"status":"ok",...}`.
2. Open the frontend URL → upload a small test PDF.
3. n8n **Executions** tab should show one successful run.
4. Frontend's "Flashcard Library" should display the new flashcards within ~30 seconds (depending on Gemini latency).

---

## 4. n8n workflow rewiring (Firestore → Postgres, GCS → MinIO)

Inside n8n, replace credentials in these nodes:

| Old node | Replace with |
|---|---|
| Get all words from Cloud Firestore | **Postgres → Execute Query**: `SELECT word FROM vocab_flashcards;` |
| Create documents on Cloud Firestore | **Postgres → Insert**: table `vocab_flashcards`, columns `word, category, definition, example_sentence, label, pos, source` |
| Save image URL on Cloud Firestore | **Postgres → Update**: `UPDATE vocab_flashcards SET media_link=$1 WHERE word=$2` |
| Save illustration on Firebase Storage | **S3 → Upload** (MinIO is S3-compatible). Endpoint = MinIO internal URL, bucket = `flashcards`. Object key = `{{$json.output.word}}.png`. Public URL pattern: `https://<minio-public-host>/flashcards/<key>` |
| Google Gemini (PaLM) credential | **HTTP Request** node calling `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=<YOUR_KEY>` — or use the built-in Gemini node with an API-key credential (no GCP project needed) |

Postgres connection inside n8n: use the **internal** hostname from §3.2 (e.g. `postgres` or whatever Coolify named it). User/password from the Postgres resource page.

---

## 5. Resource sizing on the t-series Lightsail box

Approximate steady-state RAM for all five containers on the smallest Lightsail instance that's reasonable (2 GB):

| Service | RAM |
|---|---|
| postgres | ~80 MB |
| minio | ~120 MB |
| n8n | ~250 MB (more during workflow runs) |
| backend | ~80 MB |
| frontend (nginx) | ~15 MB |
| Coolify itself | ~350 MB |
| **Total** | **~900 MB** |

A 2 GB instance is workable for light use. Bump to 4 GB if you'll process large PDFs or many concurrent uploads — Gemini calls inside n8n are the main RAM spikes.

---

## 6. Operational checklist

- [ ] All five resources show "Running" (green) in Coolify.
- [ ] `curl https://<backend>/health` returns 200.
- [ ] n8n workflow is **Active** and the production webhook URL matches `N8N_WEBHOOK_URL` in the backend.
- [ ] Postgres has a `vocab_flashcards` table (`\dt` via Coolify Terminal on the DB resource).
- [ ] MinIO bucket `flashcards` exists and is anonymous-readable.
- [ ] Test upload writes a row to Postgres **and** an image to MinIO.
- [ ] Frontend "Flashcard Library" renders the test card with its illustration.

---

## 7. Rolling updates

When you push new code:

1. Coolify's GitHub/GitLab webhook auto-redeploys the affected app.
2. For the **frontend**, remember that changing `VITE_BACKEND_URL` requires a **rebuild**, not just a restart (the value is baked into the JS bundle).
3. The backend's `migrate.js` runs on every boot — keep it idempotent (it already uses `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`).

---

## 8. Troubleshooting quick table

| Symptom | First thing to check |
|---|---|
| Backend "ECONNREFUSED" on startup | `DATABASE_URL` uses the **internal** Postgres hostname (not `localhost`, not the public URL) |
| `relation "vocab_flashcards" does not exist` | Container didn't run `migrate.js`. Check Coolify logs for the migration line; verify the Dockerfile `CMD` wasn't overridden |
| Frontend can hit `/health` but uploads fail with CORS | `CORS_ORIGIN` on backend doesn't match the frontend's public URL exactly (protocol matters) |
| n8n webhook returns 404 | Workflow not Active, or you used the test URL instead of the production URL |
| Illustrations 403 in browser | MinIO bucket policy isn't set to anonymous readonly |
| Gemini node times out | Free-tier rate limits — add a Wait node, or move to paid quota |
