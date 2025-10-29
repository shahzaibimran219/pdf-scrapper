Plan v2 — production-ready and 100% aligned
1) Tech stack (unchanged with specifics)

Next.js 14 (App Router), TypeScript, Tailwind, shadcn/ui, sonner

Auth: NextAuth (Google provider now; architecture allows adding more later)

DB: Supabase Postgres + Prisma

Storage: Supabase Storage (private bucket; per-user prefix)

LLM: OpenAI (text models + Vision) with strict token budgets and retries

Observability: Sentry + structured server logs (requestId, userId, resumeId)

Deployment: Vercel; background path via Vercel Queues or Supabase Edge Functions (optional but recommended)

2) Data model (Prisma, key fields)

User (NextAuth)

Resume

id, userId (FK), fileName, fileSize, storagePath, uploadedAt, sourceHash, detectedPages (JSONB: array of {page,type: "text"|"image"}), lastProcessStatus (PENDING|SUCCEEDED|FAILED), schemaVersion

resumeData (JSONB)

ResumeHistory

id, resumeId (FK), userId (FK), extractedAt, schemaVersion, snapshot (JSONB), notes?

Indexes: (userId, uploadedAt), GIN on resumeData (selected keys), index on sourceHash

RLS Policies: userId = auth.uid() semantics; reads/writes restricted by user

3) Upload flows (≤10 MB)

Small (≤ ~4 MB): server action accepts File, computes sourceHash, checks idempotency, processes synchronously, persists, returns data.

Large (> ~4–10 MB): client requests short-lived signed URL; uploads directly; calls /api/extract with storagePath and sourceHash.

Async option (recommended for big OCR): /api/extract enqueues background work and returns jobId; dashboard polls /api/jobs/:id.

4) Extraction pipeline (page-aware, robust)

Document type guard: mini prompt “Is this a resume?” → proceed / warn.

Per-page detection:

Extract text per page with pdf-parse or pdfjs-dist textContent.

If text length ≥ threshold (e.g., 300 chars) → Text Path for that page.

Else → Vision Path for that page: render to PNG (node-canvas) at 144–180 DPI, compress.

Chunking:

Text pages: chunk into ≤ ~8k tokens with semantic boundaries (sections).

Vision pages: one image per page (avoid multi-image per call unless necessary).

Extraction:

Use schema-constrained prompting (function-call/JSON mode).

Normalization layer converts free-text enums and dates to canonical types before Zod.

Merge & reconcile:

Deterministic merge strategy: prefer latest page for duplicates; union arrays with de-dup by (title+org+date) keys; keep provenance per field (page and method).

Validation:

Zod validation (vX) → on failure, run targeted repair prompts; else record errors and mark FAILED.

Persist:

Update Resume.resumeData, schemaVersion, detectedPages, add ResumeHistory snapshot.

5) API surface

POST /api/upload-url → { signedUrl, storagePath, expiresAt }

POST /api/extract (Node runtime)

Body: { file? | storagePath?, sourceHash, mode?: "sync"|"async" }

Auth required; validates storagePath prefix belongs to user

GET /api/jobs/:id → { status, error?, result? }

Server action processSmallPdf(formData) used only for ≤4 MB path.

6) UI/UX

Protected layouts for /dashboard and /resumes/* using server-side auth.

Dashboard

Drag-drop card (accept PDF only, ≤10 MB), progress bar

Status chips: Uploading → Extracting → Saving (or Queued → Processing → Done)

Table (paginated): fileName, date, size, method per page (text/vision badge), status, “View”

Detail

Pretty sections (Profile, Work, Education, etc.) + a raw JSON viewer

Diff against history; “Restore snapshot”, “Re-run extraction”

“Export JSON” and “Copy”

Toasts everywhere (success/warn/error) with clear reasons and actions

Responsive & a11y: keyboard-navigable, aria labels, focus outlines

7) Security & privacy

Enforce MIME + magic-bytes checks; reject >10 MB with a precise error

Private bucket; objects under userId/ prefix

Signed URLs: PUT only, expire ≤10 minutes, limited content-type/length

No PII in logs; OpenAI prompts must omit raw emails unless required for mapping

RLS enabled + server-side checks on every read/write

8) Observability & errors

Standard error envelope { code, message, details? }

Sentry instrumentation (frontend + backend); requestId on each flow

OpenAI errors mapped to user-friendly messages (rate limit, length, API key, etc.)

Dashboard shows per-resume last error with guidance

9) Cost & performance controls

Configurable page and token budgets; hard stop with friendly message if exceeded

Dedup via sourceHash to avoid re-parsing identical files

Cache page text extraction (local/tmp or Supabase KV/Redis if available)

Retry policy with exponential backoff on transient OpenAI errors

10) Documentation (README)

Architecture diagram

Upload paths and why ≤4 MB uses server actions and >4 MB uses signed URL

Page-aware extraction and merging

Env var table, local dev steps, RLS setup, CLI commands

Troubleshooting (timeouts, rate limits, “file not a resume”)

11) Testing

Unit: detectors, normalizer, merger, Zod schemas

Integration: small and large paths; RLS enforcement

e2e (Playwright): auth, upload, progress, error toasts, history diff

Mock OpenAI for deterministic tests; fitness tests with synthetic resumes (text, scanned, hybrid)

12) Milestones (revised)

Scaffold, deps, base layout

NextAuth + protected routes (middleware + server layouts)

Prisma schema + RLS policies + migrations

Storage signing + small/large upload paths with idempotency

Page-aware detection + text extraction

Vision rendering + extraction

Merge, normalize, Zod validate + schemaVersion

Dashboard + detail with history diff

Observability (Sentry) + standardized errors + cost limits

Docs + comprehensive tests