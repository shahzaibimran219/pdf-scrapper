import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { errorEnvelope } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";
import { getStorageBucket, validateStoragePath } from "@/lib/storage";
import { ensurePdfAndSize } from "@/lib/file-checks";
import { EXTRACT_CONFIG } from "@/config/extract";
import { computeSourceHash } from "@/lib/hash";
import { extractResumeWithOpenAI } from "@/lib/extractors/openai";
import { prisma as prismaClient } from "@/lib/prisma";
import { debitCreditsForResume } from "@/lib/credits";

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
      notes: "Initial extraction (text-only)",
    },
  });

  return NextResponse.json({ resumeId: resume.id, resumeData });
}


