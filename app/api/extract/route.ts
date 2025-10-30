import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { errorEnvelope } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";
import { getStorageBucket, validateStoragePath } from "@/lib/storage";
import { ensurePdfAndSize } from "@/lib/file-checks";
import { EXTRACT_CONFIG } from "@/config/extract";
import { computeSourceHash } from "@/lib/hash";
import { extractResumeWithOpenAI, extractResumeWithOpenAIVisionFromUrl, extractResumeFromTextWithOpenAI } from "@/lib/extractors/openai";
import { prisma as prismaClient } from "@/lib/prisma";
import { debitCreditsForResume } from "@/lib/credits";
import { rasterizeFirstPageToPng, ocrPngWithTesseract } from "@/lib/ocr";

export const runtime = "nodejs";

type ExtractBody = {
  sourceHash: string;
  storagePath?: string; // preferred for large uploads
  mode?: "sync" | "async";
};

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json(errorEnvelope("UNAUTHORIZED", "Auth required"), { status: 401 });
  }

  let body: ExtractBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(errorEnvelope("BAD_REQUEST", "Invalid JSON body"), { status: 400 });
  }

  const { sourceHash, storagePath, mode = "sync" } = body ?? {};

  // If storagePath provided, validate it belongs to user
  if (storagePath && !validateStoragePath(session.user.id, storagePath)) {
    return NextResponse.json(errorEnvelope("FORBIDDEN", "Invalid storagePath for user"), { status: 403 });
  }

  // Download bytes from storage (large path only for now)
  if (!storagePath) {
    return NextResponse.json(
      errorEnvelope("NOT_IMPLEMENTED", "Direct file upload path not implemented yet. Provide storagePath."),
      { status: 501 },
    );
  }

  const supabase = createClient(
    process.env.SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE ?? "",
  );
  const bucket = getStorageBucket();
  const { data: fileData, error: downloadErr } = await supabase.storage.from(bucket).download(storagePath);
  if (downloadErr || !fileData) {
    return NextResponse.json(
      errorEnvelope("SUPABASE_ERROR", "Failed to download file", { error: downloadErr?.message }),
      { status: 500 },
    );
  }
  const bytes = new Uint8Array(await fileData.arrayBuffer());

  // Validate PDF & size
  const check = ensurePdfAndSize(bytes, EXTRACT_CONFIG.MAX_BYTES);
  if (!check.ok) {
    return NextResponse.json(errorEnvelope("INVALID_FILE", check.reason), { status: 400 });
  }

  // Compute server-side sourceHash (enforce idempotency)
  const serverHash = await computeSourceHash(bytes, session.user.id);
  if (sourceHash && sourceHash !== serverHash) {
    return NextResponse.json(
      errorEnvelope("HASH_MISMATCH", "Provided sourceHash does not match server-computed hash"),
      { status: 400 },
    );
  }

  // Optional billing pre-check
  try {
    if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLIC_KEY) {
      const user = await prismaClient.user.findUnique({ where: { id: session.user.id }, select: { credits: true, scrapingFrozen: true } });
      
      console.log(`[EXTRACT] Credit check for user ${session.user.id}:`, {
        currentCredits: user?.credits ?? 0,
        required: 100,
        scrapingFrozen: user?.scrapingFrozen ?? false,
      });
      
      if (user?.scrapingFrozen) {
        console.log(`[EXTRACT] BILLING_FROZEN: User ${session.user.id} subscription is frozen`);
        return NextResponse.json(errorEnvelope("BILLING_FROZEN", "Subscription inactive; please reactivate."), { status: 402 });
      }
      
      if ((user?.credits ?? 0) < 100) {
        console.log(`[EXTRACT] INSUFFICIENT_CREDITS: User ${session.user.id} has ${user?.credits ?? 0} credits, needs 100`);
        return NextResponse.json(errorEnvelope("INSUFFICIENT_CREDITS", "Not enough credits (100 required)."), { status: 402 });
      }
    }
  } catch {}

  // Idempotency: reuse existing parse for identical uploads, only if schema matches current
  const existing = await prisma.resume.findFirst({
    where: { userId: session.user.id, sourceHash: serverHash },
  });
  if (existing?.resumeData && existing.schemaVersion === EXTRACT_CONFIG.SCHEMA_VERSION && (existing.resumeData as any)?.profile) {
    return NextResponse.json({ resumeId: existing.id, resumeData: existing.resumeData });
  }

  // Create a PENDING record
  const resume = await prisma.resume.create({
    data: {
      userId: session.user.id,
      fileName: storagePath.split("/").pop() ?? "uploaded.pdf",
      fileSize: bytes.length,
      storagePath,
      sourceHash: serverHash,
      schemaVersion: EXTRACT_CONFIG.SCHEMA_VERSION,
      lastProcessStatus: "PENDING",
    },
  });

  if (mode === "async") {
    // TODO: enqueue background job (Vercel Queues or Supabase Edge Function)
    return NextResponse.json({ jobId: resume.id, status: "QUEUED" });
  }

  // Minimal Sync Pipeline: extract text with pdf-parse, classify pages by text length
  // OpenAI direct PDF extraction
  let resumeData: any;
  try {
    resumeData = await extractResumeWithOpenAI(bytes, storagePath.split("/").pop() ?? "uploaded.pdf");
  } catch (e: any) {
    await prisma.resume.update({
      where: { id: resume.id },
      data: { lastProcessStatus: "FAILED", lastError: e?.message ?? "openai failed" },
    });
    return NextResponse.json(errorEnvelope("OPENAI_ERROR", e?.message ?? "Failed to extract with OpenAI"), { status: 500 });
  }

  // Fallback for image-only PDFs: if low signal, try Vision on rendered PNG; then OCR if still low
  let tempPngPath: string | null = null;
  try {
    const keys = Object.keys(resumeData || {});
    const lowSignal = !resumeData || keys.length < 3 || (!resumeData.profile && (!resumeData.experience && !resumeData.workExperiences));
    console.log(`[EXTRACT] Low-signal check: keys=${keys.length}, lowSignal=${lowSignal}`);
    if (lowSignal) {
      console.log(`[EXTRACT] Rasterizing first page to PNG for Vision/OCR fallback…`);
      const png = await rasterizeFirstPageToPng(bytes);
      if (!png) {
        console.warn(`[EXTRACT] Rasterization returned null; skipping Vision/OCR fallback.`);
      } else {
        // Upload PNG temporarily
        const baseName = (storagePath.split("/").pop() ?? "uploaded").replace(/\.pdf$/i, "");
        tempPngPath = storagePath.replace(/\.pdf$/i, "") + "-p1.png";
        console.log(`[EXTRACT] Uploading temporary PNG: ${tempPngPath}`);
        await supabase.storage.from(bucket).upload(tempPngPath, new Blob([png] as any, { type: "image/png" }), { upsert: true, contentType: "image/png" } as any);
        const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(tempPngPath, 60 * 5);
        if (signed?.signedUrl) {
          console.log(`[EXTRACT] Vision fallback attempting with signed image URL`);
          const visionJson = await extractResumeWithOpenAIVisionFromUrl(signed.signedUrl);
          const vKeys = Object.keys(visionJson || {});
          console.log(`[EXTRACT] Vision result keys=${vKeys.length}`);
          if (vKeys.length > keys.length) {
            console.log(`[EXTRACT] Vision improved result; adopting Vision JSON.`);
            resumeData = visionJson;
          } else {
            console.log(`[EXTRACT] Vision did not improve; attempting OCR with Tesseract…`);
            const ocrText = await ocrPngWithTesseract(png);
            console.log(`[EXTRACT] OCR text length: ${ocrText ? ocrText.length : 0}`);
            if (ocrText && ocrText.length > 200) {
              const ocrJson = await extractResumeFromTextWithOpenAI(ocrText);
              const oKeys = Object.keys(ocrJson || {});
              console.log(`[EXTRACT] OCR→JSON keys=${oKeys.length}`);
              if (oKeys.length > keys.length) {
                console.log(`[EXTRACT] OCR→JSON improved result; adopting.`);
                resumeData = ocrJson;
              } else {
                console.log(`[EXTRACT] OCR→JSON not better than initial; keeping initial JSON.`);
              }
            } else {
              console.log(`[EXTRACT] OCR produced too little text; keeping initial JSON.`);
            }
          }
        } else {
          console.warn(`[EXTRACT] Failed to get signed URL for PNG; skipping Vision fallback.`);
        }
      }
    }
  } catch (e) {
    console.warn("[EXTRACT] vision/ocr fallback failed:", (e as any)?.message);
  } finally {
    // Best-effort delete temp png
    if (tempPngPath) {
      try {
        console.log(`[EXTRACT] Removing temporary PNG: ${tempPngPath}`);
        await supabase.storage.from(bucket).remove([tempPngPath]);
      } catch {}
    }
  }

  await prisma.resume.update({
    where: { id: resume.id },
    data: {
      resumeData,
      lastProcessStatus: "SUCCEEDED",
    },
  });

  // Optional billing post-debit
  try {
    if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLIC_KEY) {
      console.log(`[EXTRACT] Debiting 100 credits from user ${session.user.id} for successful extraction`);
      await debitCreditsForResume(session.user.id, resume.id, 100);
      console.log(`[EXTRACT] Successfully debited credits for user ${session.user.id}`);
    }
  } catch (err: any) {
    console.error(`[EXTRACT] Failed to debit credits for user ${session.user.id}:`, err.message);
  }

  await prisma.resumeHistory.create({
    data: {
      resumeId: resume.id,
      userId: session.user.id,
      schemaVersion: EXTRACT_CONFIG.SCHEMA_VERSION,
      snapshot: resumeData,
      notes: "Initial extraction (auto + vision fallback)",
    },
  });

  return NextResponse.json({ resumeId: resume.id, resumeData });
}


