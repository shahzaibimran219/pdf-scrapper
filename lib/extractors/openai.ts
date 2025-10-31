import { getOpenAI } from "@/lib/openai";
import { RESUME_JSON_SCHEMA } from "@/lib/schema/resume-json-schema";
import { toFile } from "openai/uploads";

function extractRawFromOpenAIResponse(resp: unknown): string {
  // Try common shapes from Responses API
  const r = resp as Record<string, unknown> | null | undefined;
  const outputText = r && typeof r === 'object' ? (r as Record<string, unknown>).output_text : undefined;
  if (typeof outputText === 'string') return outputText;

  const content = r && typeof r === 'object' ? (r as Record<string, unknown>).content : undefined;
  const choices = r && typeof r === 'object' ? (r as Record<string, unknown>).choices : undefined;

  const isContentArray = (val: unknown): val is Array<{ text?: unknown }> => Array.isArray(val) && typeof val[0]?.text === 'string';
  const isChoicesArray = (val: unknown): val is Array<{ message?: { content?: Array<{ text?: { value?: unknown } }> } }> =>
    Array.isArray(val) && Array.isArray(val[0]?.message?.content) && typeof val[0]?.message?.content?.[0]?.text?.value === 'string';

  if (isContentArray(content)) {
    return String(content[0].text);
  }
  if (isChoicesArray(choices)) {
    return String(choices[0]?.message?.content?.[0]?.text?.value ?? "{}");
  }
  return "{}";
}

function safeParseJson(raw: unknown): unknown {
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return { rawText: raw }; }
  }
  return raw ?? {};
}

export async function extractResumeWithOpenAI(bytes: Uint8Array, fileName = "resume.pdf") {
  const openai = getOpenAI();

  // 1) Upload the raw PDF to OpenAI Files
  let file;
  try {
    file = await openai.files.create({
      file: await toFile(bytes, fileName, { type: "application/pdf" }),
      purpose: "assistants",
    });
  } catch (e: unknown) {
    const msg = typeof e === 'object' && e && 'message' in e ? String((e as Record<string, unknown>).message) : 'unknown';
    throw new Error(`openai.files.create failed: ${msg}`);
  }

  // 2) Ask the model with attachments + file_search tool (no local PDF parsing)
  let response: unknown;
  try {
    response = await openai.responses.create({
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
    });
  } catch (e: unknown) {
    const msg = typeof e === 'object' && e && 'message' in e ? String((e as Record<string, unknown>).message) : 'unknown';
    throw new Error(`openai.responses.create failed: ${msg}`);
  }

  const raw = extractRawFromOpenAIResponse(response);
  const json = safeParseJson(raw);
  return json;
}

export async function extractResumeWithOpenAIVisionFromUrl(imageUrl: string) {
  const openai = getOpenAI();
  let response: unknown;
  try {
    response = await openai.responses.create({
      model: process.env.OPENAI_MODEL_VISION ?? "gpt-4o-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: "Extract resume data from the following image (scanned resume) and return strictly the JSON per the provided schema." },
            { type: "input_image", image_url: imageUrl, detail: "auto" },
          ],
        },
      ],
      text: { format: { type: "json_schema", name: RESUME_JSON_SCHEMA.name, schema: RESUME_JSON_SCHEMA.schema, strict: RESUME_JSON_SCHEMA.strict } },
      max_output_tokens: 4000,
    });
  } catch (e: unknown) {
    const msg = typeof e === 'object' && e && 'message' in e ? String((e as Record<string, unknown>).message) : 'unknown';
    throw new Error(`openai.vision.responses.create failed: ${msg}`);
  }

  const raw = extractRawFromOpenAIResponse(response);
  const json = safeParseJson(raw);
  return json;
}

export async function extractResumeFromTextWithOpenAI(text: string) {
  const openai = getOpenAI();
  let response: unknown;
  try {
    response = await openai.responses.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      input: [
        {
          role: "user",
          content: [{ type: "input_text", text }],
        },
      ],
      text: { format: { type: "json_schema", name: RESUME_JSON_SCHEMA.name, schema: RESUME_JSON_SCHEMA.schema, strict: RESUME_JSON_SCHEMA.strict } },
      max_output_tokens: 4000,
    });
  } catch (e: unknown) {
    const msg = typeof e === 'object' && e && 'message' in e ? String((e as Record<string, unknown>).message) : 'unknown';
    throw new Error(`openai.responses.create failed: ${msg}`);
  }

  const raw = extractRawFromOpenAIResponse(response);
  const json = safeParseJson(raw);
  return json;
}


