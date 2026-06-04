# Clarivue · Pipeline Intelligence

Dump a transcript, email, or message trail → Claude reads it as a **sales signal** (angle pitched, problem that landed, stage, next step) → it logs to the right account and updates your dashboard. Next.js + Supabase, single-table, password-gated.

## What's inside
- **Intake** — paste/drop content, Claude extracts, you review, then Log.
- **Dashboard** — pre-revenue analytics: open pipeline, % past discovery, win rate, response cadence, going-cold count, stage funnel, deal-type & source mix, and a "what's working" panel ranking angles/problems by deals advancing.
- **Accounts** — a table; click any row for the full detail + timeline in a modal.

## Architecture (kept deliberately simple)
- One Postgres table (`accounts`) with `contacts` and `timeline` as JSONB.
- **All** database reads/writes and the Claude call run in Next.js server routes. The browser never sees your Supabase service key or Anthropic key.
- A single shared password (cookie-based gate via `middleware.js`). For multi-user later, swap in Supabase Auth + RLS.

---

## Setup (about 10 minutes)

### 1. Supabase (free)
1. Create a project at supabase.com.
2. Open **SQL Editor → New query**, paste the contents of `supabase-schema.sql`, and Run.
3. Go to **Project Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role** secret key → `SUPABASE_SERVICE_ROLE_KEY` (keep this private)

### 2. Anthropic
Get an API key at console.anthropic.com → `ANTHROPIC_API_KEY`.

### 3. Environment variables
Copy `.env.example` to `.env.local` and fill in every value:
```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=claude-sonnet-4-6
APP_PASSWORD=your-login-password
AUTH_SECRET=run: openssl rand -hex 32
```

### 4. Run locally
```
npm install
npm run dev
```
Open http://localhost:3000, enter your `APP_PASSWORD`, and you're in.

---

## Deploy to Vercel
1. Push this folder to a GitHub repo.
2. In Vercel, **Add New → Project** and import the repo.
3. Under **Settings → Environment Variables**, add the same five (or six) keys from `.env.local`.
4. Deploy. Done.

## Notes
- `ANTHROPIC_MODEL` is swappable — point it at whichever current model you prefer.
- "Response gap" = avg days between logged touches; "going cold" uses a 14-day threshold (change `STALE` in `app/page.jsx`).
- Original uploaded files aren't stored yet — only their extracted text. Add Supabase Storage + a `files` reference if you want true attachments.
