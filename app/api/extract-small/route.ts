import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { errorEnvelope } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { EXTRACT_CONFIG } from "@/config/extract";
import { ensurePdfAndSize } from "@/lib/file-checks";
import { computeSourceHash } from "@/lib/hash";
import { extractResumeWithOpenAI } from "@/lib/extractors/openai";

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

  let resumeData: any;
  try {
    resumeData = await extractResumeWithOpenAI(bytes, file.name || "uploaded.pdf");
  } catch (e: any) {
    await prisma.resume.update({ where: { id: resume.id }, data: { lastProcessStatus: "FAILED", lastError: e?.message ?? "openai failed" } });
    return NextResponse.json(errorEnvelope("OPENAI_ERROR", e?.message ?? "Failed to extract with OpenAI"), { status: 500 });
  }

  await prisma.resume.update({ where: { id: resume.id }, data: { resumeData, lastProcessStatus: "SUCCEEDED" } });
  await prisma.resumeHistory.create({ data: { resumeId: resume.id, userId: session.user.id, schemaVersion: EXTRACT_CONFIG.SCHEMA_VERSION, snapshot: resumeData, notes: "Initial extraction (small-file, text-only)" } });

  return NextResponse.json({ resumeId: resume.id, resumeData });
}


