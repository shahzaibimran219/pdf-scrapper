import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getServerSession } from "@/lib/auth";
import { errorEnvelope } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { EXTRACT_CONFIG } from "@/config/extract";
import { ensurePdfAndSize } from "@/lib/file-checks";
import { computeSourceHash } from "@/lib/hash";
import { extractResumeWithOpenAI, extractResumeFromTextWithOpenAI } from "@/lib/extractors/openai";
import { prisma as prismaClient } from "@/lib/prisma";
import { debitCreditsForResume } from "@/lib/credits";
import { rasterizeFirstPageToPng, ocrPngWithTesseract } from "@/lib/ocr";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json(errorEnvelope("UNAUTHORIZED", "Auth required"), { status: 401 });
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(errorEnvelope("BAD_REQUEST", "Expected multipart/form-data"), { status: 400 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(errorEnvelope("BAD_REQUEST", "Missing file"), { status: 400 });
  }
  const arrayBuf = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuf);

  const check = ensurePdfAndSize(bytes, EXTRACT_CONFIG.SMALL_UPLOAD_MAX_BYTES);
  if (!check.ok) {
    return NextResponse.json(errorEnvelope("INVALID_FILE", check.reason), { status: 400 });
  }

  const serverHash = await computeSourceHash(bytes, session.user.id);
  const existing = await prisma.resume.findFirst({ where: { userId: session.user.id, sourceHash: serverHash } });
  if (existing?.resumeData && existing.schemaVersion === EXTRACT_CONFIG.SCHEMA_VERSION && (existing.resumeData as any)?.profile) {
    return NextResponse.json({ resumeId: existing.id, resumeData: existing.resumeData });
  }

  const resume = await prisma.resume.create({
    data: {
      userId: session.user.id,
      fileName: file.name || "uploaded.pdf",
      fileSize: bytes.length,
      storagePath: null,
      sourceHash: serverHash,
      schemaVersion: EXTRACT_CONFIG.SCHEMA_VERSION,
      lastProcessStatus: "PENDING",
    },
  });

  // Optional billing pre-check
  try {
    if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLIC_KEY) {
      const user = await prismaClient.user.findUnique({ where: { id: session.user.id }, select: { credits: true, scrapingFrozen: true } });
      if (user?.scrapingFrozen) {
        return NextResponse.json(errorEnvelope("BILLING_FROZEN", "Subscription inactive; please reactivate."), { status: 402 });
      }
      if ((user?.credits ?? 0) < 100) {
        return NextResponse.json(errorEnvelope("INSUFFICIENT_CREDITS", "Not enough credits (100 required)."), { status: 402 });
      }
    }
  } catch {}

  let resumeData: any;
  try {
    resumeData = await extractResumeWithOpenAI(bytes, file.name || "uploaded.pdf");
  } catch (e: any) {
    await prisma.resume.update({ where: { id: resume.id }, data: { lastProcessStatus: "FAILED", lastError: e?.message ?? "openai failed" } });
    return NextResponse.json(errorEnvelope("OPENAI_ERROR", e?.message ?? "Failed to extract with OpenAI"), { status: 500 });
  }

  // Low-signal fallback: rasterize first page and OCR with Tesseract, then JSON from text
  try {
    const keys = Object.keys(resumeData || {});
    const lowSignal = !resumeData || keys.length < 3 || (!resumeData.profile && (!resumeData.experience && !resumeData.workExperiences));
    if (lowSignal) {
      console.log(`[EXTRACT-SMALL] Low-signal; rasterizing and OCR…`);
      const png = await rasterizeFirstPageToPng(bytes);
      if (png) {
        const ocrText = await ocrPngWithTesseract(png);
        console.log(`[EXTRACT-SMALL] OCR text length: ${ocrText ? ocrText.length : 0}`);
        if (ocrText && ocrText.length > 200) {
          const ocrJson = await extractResumeFromTextWithOpenAI(ocrText);
          const oKeys = Object.keys(ocrJson || {});
          console.log(`[EXTRACT-SMALL] OCR→JSON keys=${oKeys.length}`);
          if (oKeys.length > keys.length) resumeData = ocrJson;
        }
      }
    }
  } catch (e) {
    console.warn(`[EXTRACT-SMALL] OCR fallback failed:`, (e as any)?.message);
  }

  await prisma.resume.update({ where: { id: resume.id }, data: { resumeData, lastProcessStatus: "SUCCEEDED" } });
  await prisma.resumeHistory.create({ data: { resumeId: resume.id, userId: session.user.id, schemaVersion: EXTRACT_CONFIG.SCHEMA_VERSION, snapshot: resumeData, notes: "Initial extraction (small-file, ocr fallback when needed)" } });

  // Optional billing post-debit
  try {
    if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLIC_KEY) {
      console.log(`[EXTRACT-SMALL] Debiting 100 credits from user ${session.user.id} for successful extraction`);
      await debitCreditsForResume(session.user.id, resume.id, 100);
      console.log(`[EXTRACT-SMALL] Successfully debited credits for user ${session.user.id}`);
    }
  } catch (err: any) {
    console.error(`[EXTRACT-SMALL] Failed to debit credits for user ${session.user.id}:`, err.message);
  }

  // Revalidate history page to show new upload immediately
  revalidatePath("/dashboard/history");

  return NextResponse.json({ resumeId: resume.id, resumeData });
}


