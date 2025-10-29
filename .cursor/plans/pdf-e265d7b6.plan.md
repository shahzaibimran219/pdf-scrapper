<!-- e265d7b6-1621-49e5-bf2e-1c68ec135d18 45bff839-5476-4192-b3ab-1a75c325f295 -->
# Plan: Next.js Resume PDF Scraper (OpenAI Vision + Supabase + NextAuth)

## Architecture decisions

- **Framework**: Next.js 14 App Router, TypeScript, TailwindCSS, shadcn/ui, `sonner` toasts
- **Auth**: NextAuth with Google provider only; PrismaAdapter to persist users in Supabase Postgres
- **DB**: Supabase Postgres via Prisma (models for resumes and history, JSONB for extracted data)
- **Storage**: Supabase Storage for PDFs > ~4MB; transient in-memory for small files
- **LLM**: OpenAI; primary path is text extraction, fallback to Vision for image/hybrid PDFs
- **Runtime**: Route handlers (`/api`) and server actions on Node.js runtime; no Edge for PDF/Canvas
- **Validation**: Zod schema mirroring Appendix JSON; strict parsing before save
- **Docs**: README section explaining Vercel 4MB server action limit and the alternate upload path

## Data model (Prisma)

- `User` (managed by NextAuth/PrismaAdapter)
- `Resume`
- id, userId (FK), fileName, fileSize, storagePath (nullable for small uploads), uploadedAt
- resumeData (JSONB) — latest parsed JSON
- `ResumeHistory`
- id, userId (FK), resumeId (FK), extractedAt, snapshot (JSONB)

Key files:

- `prisma/schema.prisma`
- `lib/prisma.ts` (singleton client)

## Upload strategy (≤10MB requirement)

- **Small (≤ ~4MB)**: server action receives `File` from client form → parse/extract → save results, optionally store the PDF in Supabase Storage for consistency
- **Large (> ~4MB to 10MB)**: client requests a signed upload URL → upload directly to Supabase Storage → call `/api/extract` with `storagePath` → parse/extract on server from readable stream
- README: note that Vercel server actions ~4MB limit; use the direct-to-storage flow for larger files

Key files:

- `app/dashboard/upload-form.tsx` (drag & drop, progress, toasts)
- `app/api/upload-url/route.ts` (POST: returns signed URL + storagePath)
- `app/api/extract/route.ts` (POST: { storagePath? | file? })

## Extraction workflow (text-first, Vision fallback)

1. Detect PDF type:

- Use `pdf-parse` to extract text; compute character count
- If count ≥ threshold (e.g., 1000 chars), use Text Path; else Vision Path

2. Text Path:

- Clean text (remove headers/footers, normalize whitespace)
- Chunk if needed (size ~8–10k tokens max per call), map-reduce: per-chunk extraction → merge pass
- Prompt OpenAI with JSON-schema constrained output; validate with Zod

3. Vision Path (for image/hybrid PDFs):

- Render first N pages (e.g., 3–5) using `pdfjs-dist` + `canvas` (node-canvas) to PNG, compress
- Call OpenAI Vision (e.g., gpt-4o-mini or o4-mini) with the images + short system prompt to fill schema
- Validate with Zod; if partial, retry targeted fields or ask model to correct shape

4. Write `Resume.resumeData` (latest) and append to `ResumeHistory.snapshot`

Key files:

- `lib/pdf/text.ts` (pdf-parse based text extraction)
- `lib/pdf/vision.ts` (pdfjs-dist render to images)
- `lib/openai.ts` (client + helpers for structured outputs)
- `lib/schema.ts` (Zod schema for Appendix JSON)
- `lib/merge.ts` (merge multiple chunk results deterministically)

## API and server actions

- `app/api/extract/route.ts` (Node runtime):
- Auth-check via `getServerSession`
- Accept either `file` (FormData) or `storagePath`
- Persist/ensure `Resume`, run extraction, save `resumeData`, append `ResumeHistory`
- Return unified response `{ resumeId, resumeData }`
- Server action `processSmallPdf(formData)` in `app/dashboard/page.tsx`:
- Auth-check server-side
- Size/type validation, branch to text vs vision logic

## UI/UX flows

- **Login** (`app/(auth)/login/page.tsx`): Google OAuth, redirect to dashboard
- **Dashboard** (`app/dashboard/page.tsx`):
- Upload card (drag & drop, file name, size, progress; disable >10MB; helpful tips)
- Status steps: “Uploading…”, “Extracting data…”, “Saving…” via `sonner`
- Table: history of uploads with file name, date, quick badges (e.g., Text/Vision), view link
- **Detail view** (`app/resumes/[id]/page.tsx`):
- JSON viewer and pretty sections (Profile, Work, Education, etc.)
- Copy JSON, export JSON, and re-run extraction button (for improvements)

## Error handling & observability

- Standardized server error envelope: `{ code, message, details? }`
- Client toasts for all failures (size, type, OpenAI, DB); actionable messages
- Add simple server logging with request IDs; mask PII in logs

## Performance & cost controls

- Page limit for Vision path (configurable, default 3–5 pages)
- Cache parsed text per `Resume.id` during re-runs
- Debounce duplicate submissions; rate-limit per user
- AbortController for client-side cancellation

## Security & compliance

- Strict MIME/type and magic-bytes checking; 10MB hard limit
- Auth enforced server-side for all routes
- Store large files in Supabase Storage under per-user folder; private bucket
- Never send user PII to client beyond their own data; do not log secrets

## Environment & setup

- `.env` vars: OPENAI_API_KEY, NEXTAUTH_URL, NEXTAUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE
- Vercel project with build output Node.js runtime for `/api/*`

## Documentation

- README: architecture diagram, upload limits, text vs vision logic, local dev steps, env var table, troubleshooting

## Milestones

1) Project scaffolding & deps → 2) Auth → 3) DB & Prisma → 4) Upload flows → 5) Extraction logic → 6) UI views → 7) Error/UX polish → 8) Docs & tests

### To-dos

- [ ] Initialize Next.js, Tailwind, shadcn/ui, sonner; add base layout
- [ ] Add NextAuth with Google provider and PrismaAdapter
- [ ] Configure Prisma with Supabase Postgres and generate client
- [ ] Implement Zod schema for resume JSON and Prisma models
- [ ] Create lib for prisma, openai, pdf text/vision helpers
- [ ] Implement server action for ≤4MB upload + extraction
- [ ] Add Supabase Storage, signed URL API for large files
- [ ] Create /api/extract route to process storagePath uploads
- [ ] Build dashboard upload card, progress toasts, and history table
- [ ] Implement resume details page with JSON viewer and sections
- [ ] Add standardized error handling and basic logging
- [ ] Write README with limits, setup, and troubleshooting
- [ ] Add unit tests for parsers and API integration tests