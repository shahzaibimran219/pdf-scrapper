# Plan v2 — Next.js Resume PDF Scraper (OpenAI + Supabase + NextAuth)

> Production-ready plan aligned 100% with the assignment requirements.

> Scope: Upload & extract data from text, image, and hybrid PDFs; store structured JSON in Supabase; authenticated dashboard; robust UX and error handling.

---

## 1) Tech Stack

- **Framework/UI**: Next.js 14 (App Router), TypeScript, TailwindCSS, shadcn/ui, `sonner` toasts
- **Auth**: NextAuth (Google provider initially; extensible)
- **Database**: Supabase Postgres + Prisma
- **Storage**: Supabase Storage (private bucket; per-user prefix)
- **LLM**: OpenAI (text + Vision), schema-constrained JSON outputs
- **Observability**: Sentry (client + server), structured logs with `requestId`
- **Deployment**: Vercel; optional background processing via Vercel Queues or Supabase Edge Functions

---

## 2) Data Model (Prisma)

### Entities

- `User` (managed by NextAuth/PrismaAdapter)
- `Resume`
  - `id` (UUID), `userId (FK)`
  - `fileName`, `fileSize`, `storagePath` (nullable for small uploads)
  - `uploadedAt` (timestamp), `sourceHash` (SHA-256 of bytes + userId)
  - `detectedPages` (JSONB, e.g., `[{ page: 1, type: "text"|"image" }]`)
  - `lastProcessStatus` (`PENDING|SUCCEEDED|FAILED`)
  - `schemaVersion` (string, e.g., `"1.0.0"`)
  - `resumeData` (JSONB, latest parsed JSON following Appendix schema)
- `ResumeHistory`
  - `id` (UUID), `resumeId (FK)`, `userId (FK)`
  - `extractedAt` (timestamp), `schemaVersion` (string)
  - `snapshot` (JSONB), `notes` (nullable)

### Indexes & Security

- Indexes: `(userId, uploadedAt)`, `sourceHash`, and selective GIN on `resumeData` keys if needed
- **RLS**: enabled on `Resume` and `ResumeHistory` with policies enforcing `userId = auth.uid()` (or mapped NextAuth user id)

---

## 3) Upload & Size Limits (≤ 10 MB)

- **Small (≤ ~4 MB)**: server action accepts `File` → compute `sourceHash` → sync extract → persist
- **Large (> ~4–10 MB)**: client requests **short‑lived signed URL** → direct upload to Supabase Storage → call `/api/extract` with `storagePath` + `sourceHash`
- **Async path (recommended for OCR-heavy files)**: `/api/extract` can enqueue a background job and return `{ jobId }`; dashboard polls job status
- **README** includes rationale: Vercel server actions are ~4 MB payload; larger files require direct-to-storage

**Validation**: reject non-PDF or >10 MB with precise, user-friendly errors; MIME + magic‑bytes checks

---

## 4) Page‑Aware Extraction Pipeline

1. **Document guard (optional but helpful)**: quick prompt classifier — “Is this a resume?”; if low confidence, show warning and allow proceed
2. **Per‑page detection**:

   - Extract text per page using `pdf-parse` or `pdfjs-dist` textContent
   - If text length ≥ threshold (e.g., 300 chars) → **Text Path** for that page
   - Else → **Vision Path**: render page to PNG (node-canvas, 144–180 DPI), compress

3. **Chunking & Budgets**:

   - Text pages chunked to ≤ ~8k tokens, respecting section boundaries
   - Vision pages: 1 page image per call; cap total page/image budget (configurable)
   - Dynamic coverage: prioritize pages containing “work/experience/education/skills”; allow “Process all pages” toggle for very long PDFs

4. **Extraction**:

   - Use schema-constrained prompting (JSON/function-call mode) to fill **Appendix schema**
   - Normalize enums & dates (case-insensitive mapping, synonyms → canonical values)

5. **Merge & Reconcile**:

   - Deterministic rules; preserve provenance (page index + method) per field
   - De-dup arrays (e.g., achievements) by key tuple (title + org + date)

6. **Validation & Repair**:

   - Zod validation (versioned); on failure, targeted repair prompts for missing/invalid fields
   - Final status: `SUCCEEDED` / `FAILED` with error details

7. **Persist**:

   - Update `Resume.resumeData`, `schemaVersion`, `detectedPages`, `lastProcessStatus`
   - Append `ResumeHistory` snapshot

---

## 5) API & Server Actions

- `POST /api/upload-url`
  - **Auth required**
  - Returns: `{ signedUrl, storagePath, expiresAt }` (PUT-only, content-type `application/pdf`, content-length ≤ 10 MB)
- `POST /api/extract` (Node runtime)
  - **Auth required**
  - Body: `{ file? | storagePath?, sourceHash, mode?: "sync"|"async" }`
  - Validates `storagePath` prefix matches user’s folder
  - Sync: runs pipeline and returns `{ resumeId, resumeData }`
  - Async: enqueues job and returns `{ jobId }`
- `GET /api/jobs/:id`
  - Returns: `{ status: "PENDING"|"PROCESSING"|"SUCCEEDED"|"FAILED", error?, result? }`
- Server action: `processSmallPdf(formData)` for ≤ ~4 MB path

**Idempotency**: server enforces `sourceHash` reuse to avoid duplicates and save costs

---

## 6) UI/UX

- **Route protection**: middleware + server layouts enforce NextAuth on `/dashboard` and `/resumes/*`
- **Dashboard**:
  - Drag‑drop upload (PDF only, ≤ 10 MB), progress bar, clear tips
  - Status steps: `Uploading → Extracting → Saving` or `Queued → Processing → Done`
  - Table (paginated): fileName, date, size, per‑page badges (Text/Vision), status, actions
- **Detail View**:
  - Pretty sections (Profile, Work, Education, Skills, etc.) + raw JSON viewer
  - **History diff** (field-level) and “Restore snapshot”
  - Actions: Re-run extraction, Export JSON, Copy JSON
- **Accessibility & Responsiveness**:
  - Keyboard navigation, aria labels, focus states
  - Mobile-friendly cards and tables

---

## 7) Security & Privacy

- Private bucket; files under `userId/` prefix
- Signed URLs expire ≤ 10 minutes; validate `storagePath` on server
- Enforce MIME + magic‑bytes; strict 10 MB limit
- **RLS** policies on all reads/writes
- **No PII in logs**; prompt redaction where possible; Sentry PII scrubbing
- OpenAI requests minimized to essential content only

---

## 8) Observability & Error Handling

- Standard server error envelope: `{ code, message, details? }`
- Sentry instrumentation (frontend + backend)
- Structured logs with `requestId`, `userId`, `resumeId`
- Clear toasts for: invalid file type/size, upload failures, OpenAI rate/length errors, DB/storage errors
- Dashboard shows last error with remediation hints

---

## 9) Cost & Performance Controls

- Configurable **token** and **page/image** budgets (hard fails with helpful message)
- Retry with exponential backoff on transient OpenAI/storage errors
- Cache text extraction per page (temp cache keyed by `resumeId:page`); reuse on re‑runs
- **Idempotency** via `sourceHash` (reuse prior results when identical)

---

## 10) Documentation (README)

- Architecture diagram and sequence for small vs. large uploads
- Explanation of Vercel server action ~4 MB limit and direct‑to‑storage flow
- Page‑aware extraction + merge strategy
- Env var table; local dev; Prisma migrations; RLS setup
- Troubleshooting: timeouts, rate limits, non‑resume PDFs, token budget exceeded

---

## 11) Testing Strategy

- **Unit**: per‑page detector, enum/date normalizer, merger, Zod schemas
- **Integration**: small & large upload flows; RLS enforcement; idempotency path
- **E2E (Playwright)**: auth guard, drag‑drop, progress states, toasts, history diff/restore
- **Mock OpenAI** for deterministic tests and cost/load simulations

---

## 12) Milestones

1. Scaffold, deps, base layout
2. NextAuth + protected routes (middleware + server layouts)
3. Prisma schema, migrations, **RLS policies**
4. Storage signing + small/large upload flows **with idempotency**
5. Page‑aware detection + text extraction path
6. Vision rendering (pdfjs + node‑canvas) + extraction path
7. Merge, normalize, **Zod validate** + `schemaVersion`
8. Dashboard + detail view with **history diff**
9. Observability (Sentry), standardized error envelope, **cost limits**
10. Documentation + comprehensive unit/integration/e2e tests

---

## 13) Environment Variables

- `OPENAI_API_KEY`
- `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `DATABASE_URL` (Supabase Postgres)
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE`

---

## 14) Deliverables Checklist

- [ ] Auth-protected Next.js app with Supabase + Prisma
- [ ] Upload PDFs up to 10 MB (small via server action, large via signed URL)
- [ ] Page-aware extraction (text first, Vision fallback), schema-constrained JSON
- [ ] `Resume` + `ResumeHistory` persistence with `schemaVersion`, RLS, idempotency
- [ ] Dashboard with progress, statuses, and history
- [ ] Detail view with raw JSON, pretty sections, and **history diff**
- [ ] Robust errors/toasts; observability; cost controls
- [ ] README with limits, flows, and troubleshooting

---

## 15) Detailed To‑Dos (Engineering Task List)

> Each task lists: **files**, **commands**, and **acceptance criteria**. Use issues with labels: `area/*`, `type/*`, `priority/*`.

### 15.1 Project Setup & Quality Gates

- [ ] Initialize repo and baseline app
  - **Files**: `package.json`, `.nvmrc`, `.editorconfig`, `.gitignore`
  - **Commands**:
    - `npx create-next-app@latest pdf-scraper --ts --eslint --app --tailwind`
    - `npm i @tanstack/react-table sonner zod jsondiffpatch`
  - **Acceptance**: App boots locally; base page renders.
- [ ] Styling & UI libs
  - **Files**: `tailwind.config.ts`, `postcss.config.js`, `app/globals.css`
  - **Commands**: `npx shadcn@latest init && npx shadcn@latest add button card input table badge`
  - **Acceptance**: shadcn components render; Tailwind working.
- [ ] Linting, formatting, git hooks
  - **Files**: `.eslintrc.cjs`, `.prettierrc`, `.prettierignore`, `lint-staged.config.js`
  - **Commands**:
    - `npm i -D eslint prettier eslint-config-next lint-staged husky`
    - `npx husky init`
    - Add pre-commit: `lint-staged`
  - **Acceptance**: `npm run lint` passes; pre-commit checks run.
- [ ] Types & paths
  - **Files**: `tsconfig.json`
  - **Acceptance**: Absolute imports from `@/lib/*`, `@/components/*` compile.

### 15.2 Auth (NextAuth) & Route Protection

- [ ] Install & configure NextAuth with Google
  - **Files**: `app/api/auth/[...nextauth]/route.ts`, `lib/auth.ts`
  - **Commands**: `npm i next-auth @auth/prisma-adapter`
  - **Acceptance**: Login/logout works; user stored via PrismaAdapter.
- [ ] Protect routes
  - **Files**: `middleware.ts`, `app/(protected)/layout.tsx`
  - **Acceptance**: Unauthed users are redirected to login for `/dashboard` and `/resumes/*`.
- [ ] Session access on server & client
  - **Files**: `lib/auth.ts`, usage in server components
  - **Acceptance**: `getServerSession` returns user on server pages.

### 15.3 Database (Supabase + Prisma) & RLS

- [ ] Prisma models & migrations
  - **Files**: `prisma/schema.prisma`, `lib/prisma.ts`
  - **Commands**: `npx prisma generate && npx prisma migrate dev --name init`
  - **Acceptance**: Tables `User`, `Resume`, `ResumeHistory` exist.
- [ ] Supabase setup
  - **Tasks**: Create project; get `DATABASE_URL`, anon/service keys.
  - **Acceptance**: DB reachable from local app.
- [ ] RLS Policies
  - **Files**: `supabase/policies.sql`
  - **Policy (example)**:
    ```sql
    alter table public."Resume" enable row level security;
    create policy "owner-read-write" on public."Resume"
      for all using (auth.uid() = "userId") with check (auth.uid() = "userId");
    
    alter table public."ResumeHistory" enable row level security;
    create policy "owner-read-write" on public."ResumeHistory"
      for all using (auth.uid() = "userId") with check (auth.uid() = "userId");
    ```

  - **Acceptance**: Cross-user access is blocked in tests.
- [ ] Indexes
  - **Files**: `prisma/migrations/*`
  - **Acceptance**: Index on `(userId, uploadedAt)`, `sourceHash`; performance checked with `EXPLAIN`.

### 15.4 Storage (Supabase Storage)

- [ ] Bucket creation
  - **Tasks**: Create private bucket `resumes`.
  - **Acceptance**: Bucket exists; private by default.
- [ ] Signed upload route
  - **Files**: `app/api/upload-url/route.ts`
  - **Acceptance**: Returns PUT-only `signedUrl` for `userId/<uuid>.pdf`, expires ≤ 10 min, size ≤ 10 MB.
- [ ] Server-side path validation
  - **Files**: `lib/storage.ts`
  - **Acceptance**: `storagePath` must start with `userId/`; otherwise 403.

### 15.5 Idempotency & File Hashing

- [ ] Compute `sourceHash`
  - **Files**: `lib/hash.ts`
  - **Acceptance**: SHA-256 over file bytes + userId; stable across retries.
- [ ] Enforce idempotency
  - **Files**: `/api/extract`, `processSmallPdf`
  - **Acceptance**: Re-upload of same file reuses prior parse or informs user.

### 15.6 Extraction Core (Per-Page, Text-First, Vision Fallback)

- [ ] PDF plumbing
  - **Files**: `lib/pdf/text.ts`, `lib/pdf/vision.ts`
  - **Commands**: `npm i pdf-parse pdfjs-dist canvas sharp`
  - **Acceptance**: Per-page text extracted; image rendering produces PNG buffers.
- [ ] Page type detector
  - **Files**: `lib/pdf/detect.ts`
  - **Acceptance**: Page marked `text` if text ≥ threshold (e.g., 300 chars), else `image`.
- [ ] OpenAI client & structured output
  - **Files**: `lib/openai.ts`
  - **Acceptance**: Helper supports JSON-mode/function-call; retries with backoff.
- [ ] Zod schemas & versioning
  - **Files**: `lib/schema/v1.ts`, `lib/schema/index.ts`
  - **Acceptance**: `schemaVersion="1.0.0"`; strict validation passes for well-formed output.
- [ ] Enum/date normalization
  - **Files**: `lib/normalize.ts`
  - **Acceptance**: Maps “full time”, “FULL TIME” → `FULL_TIME`; standardizes date formats.
- [ ] Chunking strategy
  - **Files**: `lib/chunk.ts`
  - **Acceptance**: Text chunks ≤ ~8k tokens, split on section headings; no overflows.
- [ ] Merge & de-dup
  - **Files**: `lib/merge.ts`
  - **Acceptance**: Deterministic merge; arrays deduped by key; provenance retained.
- [ ] Repair prompts (targeted fixes)
  - **Files**: `lib/repair.ts`
  - **Acceptance**: Missing/invalid fields retried; ultimately either valid JSON or clear failure.

### 15.7 API & Background Jobs

- [ ] `/api/extract` route
  - **Files**: `app/api/extract/route.ts`
  - **Acceptance**: Accepts `file|storagePath`, validates user, runs pipeline, saves results, returns `{ resumeId, resumeData }`.
- [ ] Background processing (optional but recommended)
  - **Option A (Vercel Queues)**: enqueue job; worker processes extraction.
  - **Option B (Supabase Edge Function + cron)**: put job in table; function consumes.
  - **Files**: `app/api/jobs/[id]/route.ts`, `lib/jobs.ts`, worker file(s)
  - **Acceptance**: Large OCR jobs complete without HTTP timeouts; dashboard polls status.

### 15.8 UI — Dashboard & Detail

- [ ] Upload card (drag & drop)
  - **Files**: `app/dashboard/upload-form.tsx`, `components/ui/uploader.tsx`
  - **Acceptance**: Accepts PDF only; validates size; shows progress.
- [ ] Status toasts & steps
  - **Files**: `components/status-steps.tsx`
  - **Acceptance**: `Uploading → Extracting → Saving` (or queued/process) visually clear.
- [ ] History table
  - **Files**: `app/dashboard/page.tsx`
  - **Acceptance**: Paginated list; columns: name, date, size, badges per page, status, actions.
- [ ] Resume detail page
  - **Files**: `app/resumes/[id]/page.tsx`, `components/json-viewer.tsx`, `components/section-cards/*`
  - **Acceptance**: Pretty sections + raw JSON; buttons: Copy, Export, Re-run.
- [ ] JSON diff & restore
  - **Files**: `components/history-diff.tsx`
  - **Acceptance**: Field-level diffs; “Restore snapshot” updates `resumeData` and app state.

### 15.9 Error Handling & Envelope

- [ ] Standard error shape
  - **Files**: `lib/errors.ts`
  - **Acceptance**: All API responses use `{ code, message, details? }`; UI toasts show friendly text.
- [ ] Edge cases
  - Invalid PDF; >10 MB; OpenAI rate limit; token limit; storage/network errors
  - **Acceptance**: Each case produces precise messaging and guidance.

### 15.10 Observability

- [ ] Sentry
  - **Files**: `sentry.client.config.ts`, `sentry.server.config.ts`
  - **Acceptance**: Errors/events captured; PII scrubbing enabled.
- [ ] Structured logs
  - **Files**: `lib/log.ts`
  - **Acceptance**: Logs include `requestId`, `userId`, `resumeId`; transport-safe, no PII.

### 15.11 Security

- [ ] MIME + magic-bytes
  - **Files**: `lib/file-checks.ts`
  - **Acceptance**: Reject disguised files; unit tests pass.
- [ ] Signed URL constraints
  - **Acceptance**: PUT-only, content-type `application/pdf`, max length ≤ 10 MB, expires ≤ 10 min.
- [ ] Policy verification
  - **Acceptance**: RLS prevents cross-tenant access in tests/e2e.

### 15.12 Cost & Performance

- [ ] Configurable budgets
  - **Files**: `config/extract.ts`
  - **Acceptance**: Token/page budgets enforced; friendly error when exceeded.
- [ ] Caching
  - **Files**: `lib/cache.ts`
  - **Acceptance**: Re-runs reuse per-page text extraction; measurable speedup.
- [ ] Retry policy
  - **Acceptance**: Transient OpenAI errors recover automatically (max attempts configurable).

### 15.13 Testing

- [ ] Unit (Vitest/Jest)
  - **Files**: `__tests__/unit/*`
  - **Areas**: detector, normalizer, merge, Zod, file-checks
- [ ] Integration
  - **Files**: `__tests__/integration/*`
  - **Areas**: upload small/large; idempotency; RLS guards; `/api/extract`
  - **Tools**: MSW to mock OpenAI/storage
- [ ] E2E (Playwright)
  - **Files**: `e2e/*`
  - **Scenarios**: auth gating; drag-drop; progress; errors; history diff
- [ ] Load/cost tests
  - **Acceptance**: Synthetic large PDFs complete within budgets; cost-estimate report generated.

### 15.14 CI/CD & Environments

- [ ] GitHub Actions
  - **Files**: `.github/workflows/ci.yml`
  - **Steps**: install, typecheck, lint, unit+integration, e2e (optional), build
  - **Acceptance**: PRs block on red CI; artifacts uploaded.
- [ ] Vercel project & env
  - **Tasks**: Set env vars; `NODE_OPTIONS=--max_old_space_size=4096` if needed
  - **Acceptance**: Preview deployments auto-create; protected env grouping.
- [ ] Release checklist
  - DNS, HTTPS, Sentry DSNs, Supabase RLS verified, storage policies verified.

### 15.15 Documentation

- [ ] README
  - Architecture diagram, flows, limits, env table, local dev, troubleshooting
- [ ] CONTRIBUTING.md
  - Branch strategy, commit conventions, code style, review checklist
- [ ] OPERATIONS.md
  - Rotations, dashboard links (Sentry/Vercel/Supabase), emergency playbook

---

## 16) Acceptance Criteria (Definition of Done)

- Upload PDFs up to **10 MB** with clear errors for invalid files/sizes.  
- Extract from **text, image, and hybrid** PDFs with **page-aware** logic.  
- Store **structured JSON** (Appendix schema) + version + history with RLS.  
- Auth-protected **dashboard** and **detail** views with **diff & restore**.  
- **Toasts** for all actions; **observability** and **PII-safe logs**.  
- **Cost controls** (token/page budgets) and **idempotency** in place.  
- **Tests**: unit, integration, e2e passing in CI; docs complete.

---

## 15) To‑Dos — Fully Detailed (Delivery-Ready)

> Use this as your implementation backlog. Each item is intentionally small, testable, and mapped to the plan. Check off as you complete.

### Phase 1 — Project Setup & Scaffolding

- [ ] Initialize Next.js 14 (App Router) with TypeScript, TailwindCSS, shadcn/ui, `sonner`
  - [ ] Create base layout, theme, and typography
  - [ ] Configure ESLint + Prettier, strict TypeScript, and path aliases (`@/lib`, `@/app`, etc.)
  - [ ] Add basic health route `/api/health` returning `{ ok: true }`
- [ ] Add Sentry (client + server) with DSN via env; enable PII scrubbing
- [ ] Create `.env.example` with all variables and short descriptions
- [ ] Add commit hooks (lint-staged + husky) and CI workflow (lint + typecheck + tests)

### Phase 2 — Auth & Route Protection

- [ ] Integrate NextAuth with Google provider
  - [ ] Configure `PrismaAdapter` and session strategy (JWT vs DB)
  - [ ] Implement `getServerSession` helper in `@/lib/auth`
- [ ] Add `middleware.ts` to protect `/dashboard` and `/resumes/*`
- [ ] Create login page and sign-in/out buttons; redirect flow to dashboard on success
- [ ] Add server-side auth checks to root dashboard layout

### Phase 3 — Database & RLS

- [ ] Define Prisma schema for `User`, `Resume`, `ResumeHistory`
- [ ] Generate Prisma client; run initial migration
- [ ] Enable Supabase **RLS** and write policies for `Resume` and `ResumeHistory` (user isolation)
- [ ] Add indexes: `(userId, uploadedAt)`, `sourceHash`; consider GIN on `resumeData`
- [ ] Seed script for local dev (optional)

### Phase 4 — Storage & Upload Paths

- [ ] Configure Supabase Storage private bucket
- [ ] Implement `POST /api/upload-url` (auth required)
  - [ ] Validate filename/size (≤ 10 MB), content-type PDF
  - [ ] Issue PUT-only signed URL with ≤ 10 min expiry under `userId/` prefix
  - [ ] Return `{ signedUrl, storagePath, expiresAt }`
- [ ] Implement `processSmallPdf(formData)` server action
  - [ ] Validate (MIME + magic-bytes, ≤ ~4 MB)
  - [ ] Compute `sourceHash` (bytes + userId) and check idempotency
- [ ] Drag & drop upload UI
  - [ ] Show file size/type and validation errors instantly
  - [ ] Progress bar for uploads; toasts for success/error
  - [ ] Fallback input for non-dnd uploads

### Phase 5 — Extraction Core (Page-Aware)

- [ ] Implement PDF text extraction per page (`pdfjs-dist` or `pdf-parse`)
  - [ ] Page text length threshold (e.g., 300 chars) for path decision
  - [ ] Cache page text by `resumeId:page`
- [ ] Implement image rendering for OCR pages (node-canvas 144–180 DPI)
  - [ ] Compress PNG/JPEG to stay within request budgets
- [ ] Implement **document guard** (is-resume classifier) with confidence
- [ ] Implement **Text Path** extraction
  - [ ] Chunking up to ~8k tokens with section-aware splitting
  - [ ] Schema-constrained prompt for Appendix JSON
- [ ] Implement **Vision Path** extraction
  - [ ] One page image per call; cap page/image budget
- [ ] Implement **normalization layer**
  - [ ] Enum normalization (employmentType, locationType, degree, language levels)
  - [ ] Date normalization (ISO strings, (month,year) → numbers)
- [ ] Implement **merge strategy**
  - [ ] Deterministic precedence, de-dup arrays via key tuples
  - [ ] Keep provenance (page index + method) per field
- [ ] Implement **Zod validation** (with `schemaVersion`)
  - [ ] Targeted repair prompts for missing/invalid fields
  - [ ] Mark `SUCCEEDED`/`FAILED` with reasons

### Phase 6 — API Endpoints & Background Jobs

- [ ] `POST /api/extract` (auth)
  - [ ] Accept `{ file? | storagePath?, sourceHash, mode?: "sync"|"async" }`
  - [ ] Validate `storagePath` belongs to requesting user prefix
  - [ ] Persist `Resume` (PENDING) and update through states
  - [ ] Sync mode: run pipeline inline; return `{ resumeId, resumeData }`
  - [ ] Async mode: enqueue job and return `{ jobId }`
- [ ] `GET /api/jobs/:id` (polling endpoint)
  - [ ] Returns `{ status, error?, result? }`
- [ ] Background processor (Vercel Queue or Supabase Edge Function)
  - [ ] Fetch PDF stream from Storage; run extraction pipeline; write results
  - [ ] Structured logs + Sentry capture; safe retries with backoff
- [ ] Idempotency
  - [ ] Store/lookup by `sourceHash + userId`
  - [ ] Reuse previous `resumeData` if identical upload is detected

### Phase 7 — Persistence & History

- [ ] Update `Resume` with `resumeData`, `schemaVersion`, `detectedPages`, `lastProcessStatus`
- [ ] Insert `ResumeHistory` snapshot on each successful run (and optionally FAILED with errors)
- [ ] Add “restore snapshot” API to copy history snapshot back to `Resume.resumeData` (with audit trail)

### Phase 8 — Dashboard & Detail UI

- [ ] Dashboard table
  - [ ] Pagination; columns: fileName, date, size, status, per-page badges (Text/Vision), actions
  - [ ] Filter/search by filename/date/status
- [ ] Detail page `/resumes/[id]`
  - [ ] Sectioned pretty rendering (Profile, Work, Education, Skills, etc.)
  - [ ] Raw JSON viewer (collapsible)
  - [ ] **History diff** (field-level) with “Restore”
  - [ ] Buttons: Re-run extraction, Export JSON, Copy JSON
- [ ] Toasters and status chips for all flows (Queued/Processing/Done/Failed)

### Phase 9 — Security Hardening

- [ ] Enforce MIME + magic-bytes check server-side
- [ ] Validate `storagePath` prefix (`userId/`)
- [ ] Signed URL constraints: PUT-only, content-length range, short expiry
- [ ] RLS verification (attempt cross-user access tests)
- [ ] Ensure no secrets or PII in client logs / network responses
- [ ] Rate limiting per user (uploads and extraction calls)

### Phase 10 — Observability & Error UX

- [ ] Standardized error envelope everywhere `{ code, message, details? }`
- [ ] Map OpenAI/storage/DB errors to human-friendly messages
- [ ] Add requestId to all server logs; surface it in error toasts for support
- [ ] Sentry dashboards/alerts for failure spikes and latency
- [ ] Last error persisted on `Resume` and shown in UI with remediation tips

### Phase 11 — Cost & Performance

- [ ] Global config for token and page/image budgets (env + UI display of limits)
- [ ] Truncation policy for extreme inputs; graceful failure with guidance
- [ ] Cached page text extraction; reuse on re-runs
- [ ] Deduplicate identical uploads via `sourceHash`
- [ ] Exponential backoff and jitter on transient OpenAI errors

### Phase 12 — Documentation

- [ ] README
  - [ ] Architecture diagram (small vs large upload sequence)
  - [ ] Explanation of 4 MB server action limit & direct-to-storage flow
  - [ ] Page-aware pipeline and merge strategy
  - [ ] Env var table; local dev; Prisma migrations; RLS setup
  - [ ] Troubleshooting (timeouts, rate limits, token budgets, non-resume files)
- [ ] CONTRIBUTING.md (coding standards, commit messages, PR checks)
- [ ] OPERATIONS.md (rotations, secrets management, outage runbook)

### Phase 13 — Testing

- **Unit**
  - [ ] Per-page detector
  - [ ] Enum & date normalizers
  - [ ] Merge logic
  - [ ] Zod schema validators
- **Integration**
  - [ ] Small upload flow (server action path)
  - [ ] Large upload flow (signed URL + `/api/extract`)
  - [ ] Async job processing path
  - [ ] RLS enforcement (cannot read others’ resumes)
  - [ ] Idempotent duplicates reuse results
- **E2E (Playwright)**
  - [ ] Auth guards on routes
  - [ ] Drag-drop + progress + toasts
  - [ ] Dashboard listing & filters
  - [ ] Detail view + history diff + restore
  - [ ] Error scenarios (oversized file, bad MIME, OpenAI rate limit)
- **Load/Cost**
  - [ ] Mock OpenAI for deterministic results and token budget tests
  - [ ] Long PDF sampling: ensure budgets and timeouts enforced

### Phase 14 — Release Readiness

- [ ] Environment variables set in Vercel & Supabase
- [ ] Database migrations applied; RLS policies active
- [ ] Storage bucket exists with correct policies
- [ ] Smoke tests in Preview; promote to Production
- [ ] Post-release monitoring (Sentry alerts) and rollback strategy