# PDF Resume Scrapper — Intelligent PDF to Structured JSON Converter

**Live Demo:** https://pdf-scrapper-five.vercel.app/

A modern Next.js application that intelligently extracts structured data from resume PDFs using AI. Supports both **text-based PDFs** and **scanned/image-based PDFs** through a multi-strategy extraction pipeline with automatic fallback mechanisms.

---

## 🎯 **Key Features**

### **Intelligent Multi-Strategy Extraction**
- **Text-Based PDFs**: Direct extraction using OpenAI Responses API with PDF file upload
- **Image/Scanned PDFs**: Automatic fallback to OpenAI Vision API for image recognition
- **OCR Fallback**: Tesseract.js OCR → OpenAI text extraction for complex scanned documents
- **Smart Detection**: Automatically determines optimal extraction path based on content

### **Upload Methods**
- **Small Files (≤4 MB)**: Direct server upload with real-time progress tracking
- **Large Files (4-10 MB)**: Secure signed URL upload to Supabase Storage
- **Client-Side Processing**: PDF.js rendering for small files with immediate image-based extraction

### **User Experience**
- Google OAuth authentication (NextAuth)
- Premium UI with dashboard, history, filters, and detailed resume views
- Real-time extraction progress with status indicators
- Complete extraction history with search and filters
- Export JSON functionality with collapsible raw JSON viewer

### **Billing & Credits System**
- Free tier with limited credits
- Basic and Pro subscription plans via Stripe
- Credit-based usage (100 credits per extraction)
- Automatic credit deduction with billing webhooks
- Credit refresh and upgrade workflows

---

## 🏗️ **Architecture**

### **Tech Stack**
- **Framework**: Next.js 16 (App Router) with TypeScript
- **Authentication**: NextAuth v4 with Google OAuth, JWT sessions
- **Database**: Supabase Postgres with Prisma ORM
- **Storage**: Supabase Storage (private buckets per user)
- **AI/ML**: 
  - OpenAI Responses API (primary)
  - OpenAI Vision API (fallback)
  - Tesseract.js OCR (secondary fallback)
- **UI**: Tailwind CSS v4, shadcn/ui components, Lucide icons
- **State**: Zustand for client-side state management
- **Payments**: Stripe integration for subscriptions

### **Component Architecture**
- **Server Components**: All pages use Server Components for optimal performance
- **Client Components**: Only interactive UI elements marked with `"use client"`
- **Data Fetching**: Server-side data fetching with proper caching strategies
- **Type Safety**: Full TypeScript coverage with no `any` types

---

## 📊 **Extraction Pipeline**

### **Three-Path Extraction Strategy**

#### **Path 1: Text-Based PDFs (Primary)**
1. **Upload** PDF file to OpenAI Files API
2. **Extract** using OpenAI Responses API with JSON schema constraints
3. **Validate** extracted data structure
4. **Store** results in database

**When Used**: PDFs with extractable text content

#### **Path 2: Vision API Fallback**
1. **Detect** low signal from primary extraction (few extracted fields)
2. **Rasterize** first page(s) to PNG using pdfjs-dist + node-canvas
3. **Upload** image to temporary storage
4. **Extract** using OpenAI Vision API (gpt-4o-mini with vision)
5. **Compare** results - adopt if improved

**When Used**: Scanned PDFs or image-heavy documents with poor text extraction

#### **Path 3: OCR → Text Extraction Fallback**
1. **Trigger** if Vision API doesn't improve results
2. **OCR** PNG image using Tesseract.js
3. **Extract** structured data from OCR text using OpenAI
4. **Compare** and adopt if better than previous attempts

**When Used**: Low-quality scanned documents where Vision API struggles

### **Smart Signal Detection**
The system automatically detects low-quality extractions by checking:
- Number of extracted fields (keys < 3)
- Presence of critical fields (profile, workExperience)
- Text content length (for OCR path)

---

## 🔄 **Upload & Extraction Workflows**

### **Workflow 1: Small Files (≤4 MB) - Client-Side Rendering**
```
1. User uploads PDF (client)
2. PDF.js renders first 3 pages to canvas images
3. POST /api/extract-resume with base64 images
4. Server extracts using OpenAI Vision API
5. Store results and return resumeId
```

### **Workflow 2: Small Files (≤4 MB) - Server Processing**
```
1. User uploads PDF via FormData
2. POST /api/extract-small (multipart/form-data)
3. Server extracts text using OpenAI Responses API
4. If low signal → OCR fallback path
5. Store results and return resumeId
```

### **Workflow 3: Large Files (4-10 MB) - Signed URL Upload**
```
1. Request signed upload URL
   POST /api/upload-url → { signedUrl, storagePath, expiresAt }
2. Upload directly to Supabase Storage (client)
3. POST /api/extract with { storagePath, sourceHash }
4. Server downloads from storage
5. Extract using primary path → Vision fallback → OCR fallback
6. Store results and return resumeId
```

### **Idempotency & Caching**
- **Source Hash**: SHA-256 hash of PDF bytes + userId
- **Schema Version**: Ensures cached results match current schema (v2.0.0)
- **Reuse Logic**: Identical PDFs reuse previous extraction results (saves costs)

---

## 🔌 **API Routes**

### **Authentication**
- `POST /api/auth/[...nextauth]` - NextAuth handler (GET & POST)

### **File Upload**
- `POST /api/upload-url` - Generate signed upload URL for large files
  - Returns: `{ signedUrl, token, storagePath, expiresAt, constraints }`
  - Auth required
  - Validates file size ≤ 10 MB

### **Extraction**
- `POST /api/extract-small` - Small file extraction (≤4 MB)
  - Accepts: `multipart/form-data` with file
  - Path: OpenAI Responses API → OCR fallback if needed
  - Returns: `{ resumeId, resumeData }`
  
- `POST /api/extract` - Large file extraction (uses storagePath)
  - Accepts: `{ storagePath, sourceHash, mode? }`
  - Path: OpenAI Responses API → Vision API fallback → OCR fallback
  - Returns: `{ resumeId, resumeData }`
  
- `POST /api/extract-resume` - Client-side image extraction
  - Accepts: `{ images: string[], fileName, fileSize }`
  - Uses: OpenAI Vision API directly
  - Returns: `{ resumeId, resumeData }`

### **Billing**
- `GET /api/billing/me` - Get current user billing info
- `POST /api/billing/checkout` - Initiate Stripe checkout session
- `POST /api/billing/portal` - Open Stripe customer portal
- `POST /api/billing/cancel` - Cancel subscription
- `POST /api/billing/downgrade-schedule` - Schedule downgrade at renewal
- `GET /api/billing/verify-session` - Verify payment session
- `POST /api/webhooks/stripe` - Stripe webhook handler

### **Health**
- `GET /api/health` - Basic health check

---

## 📋 **JSON Schema (v2.0.0)**

The extracted resume data follows a strict schema:

```typescript
{
  profile: {
    name?: string | null;
    surname?: string | null;
    email?: string | null;
    headline?: string | null;
    professionalSummary?: string | null;
    linkedIn?: string | null;
    website?: string | null;
    country?: string | null;
    city?: string | null;
    relocation?: boolean | null;
    remote?: boolean | null;
  };
  workExperiences?: Array<{
    jobTitle?: string;
    employmentType?: string;
    locationType?: string;
    company?: string;
    startMonth?: number;
    startYear?: number;
    endMonth?: number;
    endYear?: number;
    current?: boolean;
    description?: string;
  }>;
  educations?: Array<{
    school?: string;
    degree?: string;
    major?: string;
    startYear?: number;
    endYear?: number;
    current?: boolean;
    description?: string;
  }>;
  skills?: string[];
  licenses?: Array<{...}>;
  languages?: Array<{...}>;
  achievements?: Array<{...}>;
  publications?: Array<{...}>;
  honors?: Array<{...}>;
}
```

**Schema Versioning**: Each resume stores `schemaVersion`. Cached results are only reused if the version matches the current schema.

See `lib/schema/resume-json-schema.ts` for complete schema definition.

---

## 🔐 **Environment Variables**

### **Authentication (NextAuth)**
```bash
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### **Database (Supabase Postgres)**
```bash
DATABASE_URL=postgresql://user:password@host:port/dbname
DIRECT_URL=postgresql://user:password@host:port/dbname  # For migrations
```

### **Supabase Storage**
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE=your-service-role-key
SUPABASE_STORAGE_BUCKET=resumes

# Client-side (public)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=resumes
```

### **Stripe (Billing)**
```bash
STRIPE_SECRET_KEY=sk_test_********************************
STRIPE_PUBLIC_KEY=pk_test_********************************
STRIPE_WEBHOOK_SECRET=whsec_*****
STRIPE_PRICE_BASIC=price_*******
STRIPE_PRICE_PRO=price_**********
```

### **OpenAI**
```bash
OPENAI_API_KEY=sk-********************************
OPENAI_MODEL=gpt-4o-mini  # Optional, defaults to gpt-4o-mini
OPENAI_MODEL_VISION=gpt-4o-mini  # Optional, for Vision API
```

### **Extraction Configuration**
```bash
EXTRACT_TOKEN_BUDGET=8000  # Default: 8000
EXTRACT_MAX_PAGES=20       # Default: 20
EXTRACT_MAX_IMAGES=10      # Default: 10
```

### **Next.js Image Configuration**
- Remote host allowed: `lh3.googleusercontent.com` (for Google avatars)
- Configured in `next.config.ts`

---

## 🚀 **Setup & Installation**

### **1. Install Dependencies**
```bash
npm install
```

### **2. Database Setup (Prisma)**
```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations
npm run prisma:migrate
```

### **3. Supabase Row Level Security (RLS)**
Enable RLS policies for user data isolation:

```sql
-- Enable RLS on Resume table
ALTER TABLE public."Resume" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner-read-write" ON public."Resume"
  FOR ALL 
  USING (auth.uid()::text = "userId") 
  WITH CHECK (auth.uid()::text = "userId");

-- Enable RLS on ResumeHistory table
ALTER TABLE public."ResumeHistory" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner-read-write" ON public."ResumeHistory"
  FOR ALL 
  USING (auth.uid()::text = "userId") 
  WITH CHECK (auth.uid()::text = "userId");
```

### **4. Environment Configuration**
1. Copy `.env.example` to `.env.local`
2. Fill in all required environment variables (see above)
3. Ensure `NEXTAUTH_URL` matches your development URL exactly

### **5. Development Server**
```bash
npm run dev
```
Open http://localhost:3000

---

## 📖 **Usage Guide**

### **For Users**

1. **Sign In**: Use Google OAuth to authenticate
2. **Upload Resume**: 
   - Drag and drop or click to select PDF (up to 10 MB)
   - Watch real-time progress (Uploading → Extracting → Saving)
3. **View Results**:
   - Automatically redirected to resume detail page
   - View structured data in organized sections
   - Expand/collapse raw JSON for debugging
4. **Manage History**:
   - Browse all uploads in History page
   - Search by filename
   - Filter by status (Succeeded/Pending/Failed)
   - Pagination for large histories
5. **Export Data**:
   - Copy JSON to clipboard
   - Download as JSON file
6. **Account Settings**:
   - View credits and subscription status
   - Upgrade/downgrade plans
   - Manage Stripe subscription

### **For Developers**

#### **Adding New Extraction Strategies**
1. Create new extractor in `lib/extractors/`
2. Add fallback logic in `app/api/extract/route.ts` or `app/api/extract-small/route.ts`
3. Update schema version if data structure changes

#### **Extending JSON Schema**
1. Update `lib/schema/resume-json-schema.ts`
2. Increment `EXTRACT_CONFIG.SCHEMA_VERSION`
3. Update TypeScript types in `types/resume.ts`
4. Re-run migrations if database schema changes

---

## 🛠️ **Available Scripts**

```bash
# Development
npm run dev          # Start Next.js dev server

# Production
npm run build        # Build for production
npm start            # Start production server

# Code Quality
npm run lint         # Run ESLint
npm run typecheck    # TypeScript type checking

# Database
npm run prisma:generate   # Generate Prisma Client
npm run prisma:migrate    # Run database migrations
```

---

## 🐛 **Troubleshooting**

### **Authentication Issues**

**State cookie missing after Google callback**
- Ensure `NEXTAUTH_URL` matches browser URL exactly (no trailing slash)
- Keep `NEXTAUTH_SECRET` stable across restarts
- Don't hot-reload auth files during OAuth flow
- Clear cookies and try again

### **Database Issues**

**Prisma engines EPERM on Windows**
- Stop dev server
- Delete `node_modules/.prisma` and `node_modules/@prisma/engines`
- Run `npm cache clean --force`
- Run `npm run prisma:generate`

**Supabase RLS uuid=text error**
- Cast `auth.uid()::text = "userId"` in policies
- Prisma uses TEXT/cuid IDs, not UUIDs

### **Image/Upload Issues**

**Next Image: Google avatar blocked**
- Add `lh3.googleusercontent.com` to `next.config.ts` `images.remotePatterns`

**File upload fails**
- Check file size ≤ 10 MB
- Verify file is valid PDF (MIME type + magic bytes)
- Check Supabase Storage bucket configuration
- Verify signed URL hasn't expired

### **Extraction Issues**

**Low-quality extraction results**
- System automatically tries Vision API and OCR fallbacks
- Check extraction logs for which path was used
- Verify OpenAI API key has sufficient credits
- Ensure PDF has readable text or clear images

**Filters not updating in History**
- Uses async `searchParams` with `await`
- Set `dynamic = "force-dynamic"` and `revalidate = 0`
- Hard reload if local caching persists

### **Billing Issues**

**Credits not updating after payment**
- Check Stripe webhook configuration
- Verify `STRIPE_WEBHOOK_SECRET` is correct
- Check webhook logs in Stripe dashboard
- Ensure webhook endpoint is publicly accessible

---

## 📦 **Dependencies**

### **Core**
- `next@16.0.1` - Next.js framework
- `react@19.2.0` - React library
- `typescript@^5` - TypeScript support

### **Authentication**
- `next-auth@^4.24.12` - Authentication
- `@auth/prisma-adapter@^2.11.1` - Prisma adapter for NextAuth

### **Database & ORM**
- `@prisma/client@^6.18.0` - Prisma Client
- `prisma@^6.18.0` - Prisma CLI

### **Storage & Database**
- `@supabase/supabase-js@^2.76.1` - Supabase client

### **AI/ML**
- `openai@^6.7.0` - OpenAI API client
- `pdfjs-dist@^5.4.296` - PDF parsing and rendering
- `tesseract.js@^6.0.1` - OCR processing
- `canvas@^3.2.0` - Server-side canvas for PDF rendering
- `pdf-parse@^2.4.5` - PDF text extraction

### **Payments**
- `stripe@^19.1.0` - Stripe server SDK
- `@stripe/stripe-js@^8.2.0` - Stripe client SDK

### **UI & Styling**
- `tailwindcss@^4.1.16` - CSS framework
- `lucide-react@^0.548.0` - Icon library
- `sonner@^2.0.7` - Toast notifications
- `zustand@^5.0.8` - State management

---

## 📝 **Implementation Details**

### **Extraction Pipeline Deep Dive**

#### **Primary Path: OpenAI Responses API**
1. Upload PDF file to OpenAI Files API
2. Create response using Responses API with:
   - File attachment
   - JSON schema constraint
   - Structured output format
3. Parse response and validate structure
4. Store in database with schema version

#### **Vision API Fallback**
1. Detect low signal (few extracted fields)
2. Rasterize first page to PNG (pdfjs-dist + canvas)
3. Upload PNG to temporary Supabase Storage location
4. Generate signed URL for image
5. Call OpenAI Vision API with:
   - Image URL
   - JSON schema prompt
6. Compare results - adopt if more fields extracted

#### **OCR Fallback**
1. Trigger if Vision API doesn't improve
2. Run Tesseract.js OCR on PNG image
3. Extract text (minimum 200 characters required)
4. Send OCR text to OpenAI for structured extraction
5. Compare results - adopt if better

### **Idempotency Strategy**
- **Source Hash**: SHA-256(`userId` + `fileBytes`)
- **Reuse Logic**: If `sourceHash` and `schemaVersion` match existing record, return cached results
- **Cost Savings**: Prevents duplicate extractions for same file

### **Security**
- **Authentication**: All protected routes require NextAuth session
- **Storage Isolation**: Files stored under `userId/` prefix with RLS policies
- **Signed URLs**: Short-lived (≤10 minutes) with PUT-only constraints
- **Validation**: MIME type + magic bytes verification
- **File Size Limits**: Hard 10 MB limit enforced server-side

### **Performance Optimizations**
- **Server Components**: Pages render on server for faster initial load
- **Client-Side Routing**: Next.js router for instant navigation
- **Caching**: Proper revalidation after mutations
- **Progress Tracking**: Real-time upload progress with XHR
- **Parallel Processing**: Promise.all for concurrent database queries

---

## 🚢 **Deployment**

### **Vercel (Recommended)**

1. **Connect Repository**: Import your Git repository to Vercel
2. **Configure Environment Variables**: Add all required variables (see Environment Variables section)
3. **Build Settings**:
   - Framework Preset: Next.js
   - Build Command: `npm run build`
   - Output Directory: `.next`
4. **Database**: Ensure Supabase database is accessible from Vercel
5. **Stripe Webhooks**: Configure webhook endpoint in Stripe dashboard
6. **Deploy**: Push to main branch triggers deployment

### **Environment Variables Checklist**
- ✅ All NextAuth variables
- ✅ Supabase URLs and keys (server + client)
- ✅ Stripe keys and webhook secret
- ✅ OpenAI API key
- ✅ Database connection strings

### **Post-Deployment**
- Verify Google OAuth callback URLs
- Test Stripe webhook endpoints
- Check Supabase RLS policies
- Monitor extraction logs for errors

---

## 📄 **License**

MIT License (see LICENSE file if present)

---

## 🔗 **Links**

- **Live Demo**: https://pdf-scrapper-five.vercel.app/
- **Architecture**: See implementation details above
- **Schema Definition**: `lib/schema/resume-json-schema.ts`
- **Type Definitions**: `types/resume.ts`

---

**Built with ❤️ using Next.js, OpenAI, and modern web technologies**
