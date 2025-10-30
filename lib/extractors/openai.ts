import { getOpenAI } from "@/lib/openai";
import { RESUME_JSON_SCHEMA } from "@/lib/schema/resume-json-schema";
import { toFile } from "openai/uploads";

export async function extractResumeWithOpenAI(bytes: Uint8Array, fileName = "resume.pdf") {
  const openai = getOpenAI();

  // 1) Upload the raw PDF to OpenAI Files
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  let file;
  try {
    file = await openai.files.create({
      file: await toFile(new Blob([ab] as any, { type: "application/pdf" }), fileName),
      purpose: "assistants",
    });
  } catch (e: any) {
    throw new Error(`openai.files.create failed: ${e?.message ?? "unknown"}`);
  }

  // 2) Ask the model with attachments + file_search tool (no local PDF parsing)
  let response: any;
  try {
    response = await (openai as any).responses.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "You are an expert resume parser. Read the attached PDF and return a single JSON object adhering strictly to the provided JSON schema.\nRules:\n- Use null for unknown scalar fields (do not use empty strings).\n- Use [] for unknown lists.\n- Follow enum hints in comments (e.g., employmentType, locationType).\n- Do not invent data; prefer nulls when uncertain.",
            },
            { type: "input_file", file_id: file.id },
          ],
        },
      ],
      text: { format: { type: "json_schema", name: RESUME_JSON_SCHEMA.name, schema: RESUME_JSON_SCHEMA.schema, strict: RESUME_JSON_SCHEMA.strict } },
      max_output_tokens: 4000,
    } as any);
  } catch (e: any) {
    throw new Error(`openai.responses.create failed: ${e?.message ?? "unknown"}`);
  }

  const raw = (response as any).output_text ?? (response as any).content?.[0]?.text ?? (response as any).choices?.[0]?.message?.content?.[0]?.text?.value ?? "{}";
  let json: any;
  try {
    json = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    // Best effort: wrap non-JSON as text
    json = { rawText: String(raw ?? "") };
  }

  return json;
}

export async function extractResumeWithOpenAIVisionFromUrl(imageUrl: string) {
  const openai = getOpenAI();
  let response: any;
  try {
    response = await (openai as any).responses.create({
      model: process.env.OPENAI_MODEL_VISION ?? "gpt-4o-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: "Extract resume data from the following image (scanned resume) and return strictly the JSON per the provided schema." },
            { type: "input_image", image_url: imageUrl },
          ],
        },
      ],
      text: { format: { type: "json_schema", name: RESUME_JSON_SCHEMA.name, schema: RESUME_JSON_SCHEMA.schema, strict: RESUME_JSON_SCHEMA.strict } },
      max_output_tokens: 4000,
    } as any);
  } catch (e: any) {
    throw new Error(`openai.vision.responses.create failed: ${e?.message ?? "unknown"}`);
  }

  const raw = (response as any).output_text ?? (response as any).content?.[0]?.text ?? (response as any).choices?.[0]?.message?.content?.[0]?.text?.value ?? "{}";
  let json: any;
  try {
    json = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    json = { rawText: String(raw ?? "") };
  }
  return json;
}

export async function extractResumeFromTextWithOpenAI(text: string) {
  const openai = getOpenAI();
  let response: any;
  try {
    response = await (openai as any).responses.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      input: [
        {
          role: "user",
          content: [{ type: "input_text", text }],
        },
      ],
      text: { format: { type: "json_schema", name: RESUME_JSON_SCHEMA.name, schema: RESUME_JSON_SCHEMA.schema, strict: RESUME_JSON_SCHEMA.strict } },
      max_output_tokens: 4000,
    } as any);
  } catch (e: any) {
    throw new Error(`openai.responses.create failed: ${e?.message ?? "unknown"}`);
  }

  const raw = (response as any).output_text ?? (response as any).content?.[0]?.text ?? (response as any).choices?.[0]?.message?.content?.[0]?.text?.value ?? "{}";
  let json: any;
  try {
    json = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    json = { rawText: String(raw ?? "") };
  }
  return json;
}


