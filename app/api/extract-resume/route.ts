import { NextRequest, NextResponse } from "next/server";
import { getOpenAI } from "@/lib/openai";
import { RESUME_JSON_SCHEMA } from "@/lib/schema/resume-json-schema";
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EXTRACT_CONFIG } from "@/config/extract";
import { debitCreditsForResume } from "@/lib/credits";
import { createHash } from "crypto";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Auth required" }, { status: 401 });
    }

    const body = await req.json().catch(() => null) as { images?: string[]; fileName?: string; fileSize?: number } | null;
    const images = body?.images ?? [];
    if (!Array.isArray(images) || images.length === 0) {
      console.warn("[EXTRACT-RESUME] No images provided");
      return NextResponse.json({ error: "No images provided" }, { status: 400 });
    }
    const fileName = body?.fileName || "uploaded.pdf";
    const fileSize = body?.fileSize || 0;
    console.log("[EXTRACT-RESUME] Received images:", images.length);

    // Compute a deterministic hash from images and user id (idempotency for re-uploads)
    const shasum = createHash("sha256");
    shasum.update(session.user.id);
    for (const img of images) shasum.update(img);
    const sourceHash = shasum.digest("hex");

    // Create PENDING record (no storagePath for client-side flow)
    const resume = await prisma.resume.create({
      data: {
        user: { connect: { id: session.user.id } },
        fileName,
        fileSize,
        storagePath: null,
        sourceHash,
        schemaVersion: EXTRACT_CONFIG.SCHEMA_VERSION,
        lastProcessStatus: "PENDING",
      },
      select: { id: true },
    });

    const openai = getOpenAI();
    const model = process.env.OPENAI_MODEL_VISION ?? "gpt-4o-mini";

    const input = [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text:
              "You are an OCR + resume parser. Read all images (pages) and return ONE JSON object.\nRules:\n- Strictly adhere to the provided JSON schema.\n- Use null for unknown scalars; use [] for lists.\n- Normalize whitespace, keep bullet points as bullets.\n- Prefer nulls to guessing.",
          },
          ...images.map((dataUrl) => ({ type: "input_image", image_url: dataUrl })),
        ],
      },
    ] as any[];

    console.log("[EXTRACT-RESUME] Calling OpenAI Vision model:", model);
    const response = await (openai as any).responses.create({
      model,
      input,
      text: {
        format: {
          type: "json_schema",
          name: RESUME_JSON_SCHEMA.name,
          schema: RESUME_JSON_SCHEMA.schema,
          strict: RESUME_JSON_SCHEMA.strict,
        },
      },
      max_output_tokens: 4000,
    } as any);

    const raw = (response as any).output_text
      ?? (response as any).content?.[0]?.text
      ?? (response as any).choices?.[0]?.message?.content?.[0]?.text?.value
      ?? "{}";

    let resumeData: any;
    try {
      resumeData = typeof raw === "string" ? JSON.parse(raw) : raw;
      console.log("[EXTRACT-RESUME] Parsed JSON keys:", Object.keys(resumeData || {}).length);
    } catch {
      console.warn("[EXTRACT-RESUME] Failed to parse JSON; returning raw_text");
      resumeData = { raw_text: String(raw ?? ""), _error: "Failed to parse JSON" };
    }

    // Update record to SUCCEEDED and store JSON
    await prisma.resume.update({ where: { id: resume.id }, data: { resumeData, lastProcessStatus: "SUCCEEDED" } });
    await prisma.resumeHistory.create({ data: { resumeId: resume.id, userId: session.user.id, schemaVersion: EXTRACT_CONFIG.SCHEMA_VERSION, snapshot: resumeData, notes: "Client-side images (vision)" } });

    // Debit credits if billing enabled
    try {
      if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLIC_KEY) {
        console.log(`[EXTRACT-RESUME] Debiting 100 credits from user ${session.user.id}`);
        await debitCreditsForResume(session.user.id, resume.id, 100);
      }
    } catch (e: any) {
      console.error("[EXTRACT-RESUME] Debit failed:", e?.message);
    }

    return NextResponse.json({ resumeId: resume.id, resumeData });
  } catch (e: any) {
    console.error("[EXTRACT-RESUME] Error:", e?.message);
    return NextResponse.json({ error: e?.message ?? "Unexpected error" }, { status: 500 });
  }
}
