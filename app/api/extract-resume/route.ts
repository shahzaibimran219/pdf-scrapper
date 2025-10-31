import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getOpenAI } from "@/lib/openai";
import { RESUME_JSON_SCHEMA } from "@/lib/schema/resume-json-schema";
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EXTRACT_CONFIG } from "@/config/extract";
import { debitCreditsForResume } from "@/lib/credits";
import { createHash } from "crypto";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: "Auth required" }, { status: 401 });
    }

    const body = await req.json().catch(() => null) as { images?: string[]; fileName?: string; fileSize?: number } | null;
    const images = body?.images ?? [];
    if (!Array.isArray(images) || images.length === 0) {
      console.warn("[EXTRACT-RESUME] No images provided");
      return NextResponse.json({ code: "BAD_REQUEST", message: "No images provided" }, { status: 400 });
    }
    const fileName = body?.fileName || "uploaded.pdf";
    const fileSize = body?.fileSize || 0;
    // Enforce hard 10MB limit server-side
    const MAX_BYTES = 10 * 1024 * 1024;
    if (fileSize > MAX_BYTES) {
      return NextResponse.json({ code: "FILE_TOO_LARGE", message: "File exceeds 10 MB limit." }, { status: 413 });
    }
    console.log("[EXTRACT-RESUME] Received images:", images.length);

    // Billing pre-check (require >=100 credits and not frozen)
    try {
      if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLIC_KEY) {
        const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { credits: true, scrapingFrozen: true } });
        if (user?.scrapingFrozen) {
          return NextResponse.json({ code: "BILLING_FROZEN", message: "Subscription inactive; please reactivate." }, { status: 402 });
        }
        if ((user?.credits ?? 0) < 100) {
          return NextResponse.json({ code: "INSUFFICIENT_CREDITS", message: "Not enough credits (100 required)." }, { status: 402 });
        }
      }
    } catch {}

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

    const input: Array<{
      role: string;
      content: Array<{ type: "input_text"; text: string } | { type: "input_image"; image_url: string }>;
    }> = [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text:
              "You are an OCR + resume parser. Read all images (pages) and return ONE JSON object.\nRules:\n- Strictly adhere to the provided JSON schema.\n- Use null for unknown scalars; use [] for lists.\n- Normalize whitespace, keep bullet points as bullets.\n- Prefer nulls to guessing.",
          },
          ...images.map((dataUrl) => ({ type: "input_image" as const, image_url: dataUrl })),
        ],
      },
    ];

    console.log("[EXTRACT-RESUME] Calling OpenAI Vision model:", model);
    type OpenAIClient = { responses: { create: (req: unknown) => Promise<unknown> } };
    const client = openai as unknown as OpenAIClient;
    const response = await client.responses.create({
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
    });

    const respObj = response as Record<string, unknown>;
    const choices = respObj.choices;
    const content = respObj.content;
    const outputText = respObj.output_text;
    
    // Type guards for response parsing
    const isContentArray = (val: unknown): val is Array<{ text?: unknown }> =>
      Array.isArray(val) && typeof val[0]?.text === 'string';
    
    const isChoicesArray = (val: unknown): val is Array<{ message?: { content?: Array<{ text?: { value?: unknown } }> } }> =>
      Array.isArray(val) &&
      Array.isArray(val[0]?.message?.content) &&
      typeof val[0]?.message?.content?.[0]?.text?.value === 'string';
    
    const raw = typeof outputText === 'string'
      ? outputText
      : isContentArray(content) && typeof content[0]?.text === 'string'
        ? String(content[0].text)
        : isChoicesArray(choices)
          ? String(choices[0]?.message?.content?.[0]?.text?.value ?? "{}")
          : "{}";

    let resumeData: Prisma.InputJsonValue;
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      resumeData = parsed as Prisma.InputJsonValue;
      const keys = typeof parsed === 'object' && parsed ? Object.keys(parsed as Record<string, unknown>).length : 0;
      console.log("[EXTRACT-RESUME] Parsed JSON keys:", keys);
    } catch {
      console.warn("[EXTRACT-RESUME] Failed to parse JSON; returning raw_text");
      resumeData = { raw_text: String(raw ?? ""), _error: "Failed to parse JSON" } as unknown as Prisma.InputJsonValue;
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
    } catch (e: unknown) {
      const message = typeof e === 'object' && e && 'message' in e ? String((e as Record<string, unknown>).message) : '';
      console.error("[EXTRACT-RESUME] Debit failed:", message);
    }

    // Revalidate history page to show new upload immediately
    revalidatePath("/dashboard/history");

    return NextResponse.json({ resumeId: resume.id, resumeData });
  } catch (e: unknown) {
    const message = typeof e === 'object' && e && 'message' in e ? String((e as Record<string, unknown>).message) : 'Unexpected error';
    console.error("[EXTRACT-RESUME] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
