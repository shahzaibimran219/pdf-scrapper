## AI Scraper — Resume PDF → Structured JSON

Live: https://pdf-scrapper-five.vercel.app/

Modern Next.js app that turns resume PDFs into structured JSON using OpenAI. It includes Google sign‑in, secure storage, a premium UI, and a history of extractions.

### Highlights
- Upload PDFs up to 10 MB (small via server, large via signed URL)
- Direct OpenAI extraction (Responses API) with a strict JSON schema (v2.0.0)
- Auth (Google) with JWT sessions (NextAuth)
- Supabase (Postgres + Storage) with per‑user isolation and RLS policies
- Premium UI: sidebar dashboard (Upload / History), filters, progress, detail view with collapsible raw JSON

---

## Architecture

- App Router (Next.js 16), TypeScript, Tailwind v4 tokens
- Authentication: NextAuth (Google provider), JWT session strategy
- Database: Supabase Postgres + Prisma Client
- Storage: Supabase Storage
- Extraction: OpenAI Responses API with file upload + JSON schema
- Routes
  - `POST /api/upload-url` — signed URL for large uploads
  - `POST /api/extract-small` — multipart form (≤ ~4 MB)
  - `POST /api/extract` — use storagePath for large files
  - `GET /api/health` — basic healthcheck

Schema versioning
- We store `schemaVersion` on each `Resume` and only reuse cached results if the stored version matches current.

---

## JSON Schema (v2.0.0)

The model must return this structure (nullable fields allowed; lists default to []):

- `profile` { name, surname, email, headline, professionalSummary, linkedIn, website, country, city, relocation, remote }
- `workExperiences[]` { jobTitle, employmentType, locationType, company, startMonth, startYear, endMonth, endYear, current, description }
- `educations[]` { school, degree, major, startYear, endYear, current, description }
- `skills[]`
- `licenses[]` { name, issuer, issueYear, description }
- `languages[]` { language, level }
- `achievements[]` { title, organization, achieveDate, description }
- `publications[]` { title, publisher, publicationDate, publicationUrl, description }
- `honors[]` { title, issuer, issueMonth, issueYear, description }

See `lib/schema/resume-json-schema.ts`.

---

## Environment Variables

Auth
- `NEXTAUTH_URL` — e.g. `http://localhost:3000`
- `NEXTAUTH_SECRET` — random string (keep stable in dev)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — Google OAuth (type: Web application)

Database (Supabase Postgres)
- `DATABASE_URL` — direct connection string (not the pooler)

Supabase
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE` — server use
- `SUPABASE_STORAGE_BUCKET` — e.g. `resumes` (server)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET` — e.g. `resumes` (client)

OpenAI
- `OPENAI_API_KEY`
- `OPENAI_MODEL` — optional (defaults to `gpt-4o-mini`)

Extraction Budgets
- `EXTRACT_TOKEN_BUDGET` (default 8000)
- `EXTRACT_MAX_PAGES` (default 20)
- `EXTRACT_MAX_IMAGES` (default 10)

Images (Next.js)
- Remote host allowed: `lh3.googleusercontent.com` in `next.config.ts`

---

## Setup

1) Install
```bash
npm i
```

2) Prisma
```bash
npm run prisma:generate
npm run prisma:migrate
```

3) (Optional) Enable Supabase RLS for Resume tables
```sql
-- supabase/policies.sql
alter table public."Resume" enable row level security;
create policy "owner-read-write" on public."Resume"
  for all using (auth.uid()::text = "userId") with check (auth.uid()::text = "userId");

alter table public."ResumeHistory" enable row level security;
create policy "owner-read-write" on public."ResumeHistory"
  for all using (auth.uid()::text = "userId") with check (auth.uid()::text = "userId");
```

4) Dev
```bash
npm run dev
```
Open http://localhost:3000

---

## Usage

1) Sign in with Google
2) Upload a PDF
   - Small (≤ ~4 MB): direct server upload with accurate progress
   - Large (~4–10 MB): signed URL to Supabase Storage, then extraction
3) View History (server‑side search and status filters)
4) Open Detail: premium sections + collapsible raw JSON (with a quick scroll link)

---

## Implementation Details

Extraction (OpenAI)
- We upload the PDF file to OpenAI Files, then call the Responses API with `text.format` using our JSON schema. The prompt enforces null for unknown scalars and [] for lists. Idempotency is keyed by a source hash (bytes + userId) and schema version.

Auth
- NextAuth (Google) with JWT sessions. Middleware protects `/dashboard/*` and `/resumes/*`.

Storage
- `POST /api/upload-url` returns a signed upload URL (short‑lived) and constraints. Server validates `storagePath` `userId/..` prefix.

UI / UX
- New York themed tokens, premium header, sidebar dashboard with Upload and History, refined tables, helpful toasts.

---

## Scripts

```json
"dev": "next dev",
"build": "next build",
"start": "next start",
"lint": "eslint .",
"typecheck": "tsc --noEmit",
"prisma:generate": "prisma generate",
"prisma:migrate": "prisma migrate dev --name init",
"postinstall": "prisma generate"
```

---

## Troubleshooting

State cookie missing after Google callback
- Ensure `NEXTAUTH_URL` matches your browser URL exactly (no trailing slash), keep `NEXTAUTH_SECRET` stable, don’t hot‑reload auth files during OAuth. Clear cookies and try again.

Prisma engines EPERM on Windows
- Stop dev server; delete `node_modules/.prisma` and `node_modules/@prisma/engines`, run `npm cache clean --force`, then `npm run prisma:generate`.

Supabase RLS uuid=text error
- Cast `auth.uid()::text = "userId"` in policies (our IDs are TEXT/cuid in Prisma).

Next Image: Google avatar blocked
- Add `lh3.googleusercontent.com` in `next.config.ts` `images.remotePatterns`.

Filters not updating in History
- We use async `searchParams` with `await` and set `dynamic = "force-dynamic"`/`revalidate = 0`. If local caching persists, hard reload.

---

## Deployment

- Vercel recommended. Configure all env vars there (server and client). Add NextAuth, Supabase, and OpenAI keys. Live site: https://pdf-scrapper-five.vercel.app/

---

## License

MIT (see LICENSE if present).
