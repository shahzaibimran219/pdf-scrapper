import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { errorEnvelope } from "@/lib/errors";
import { getServerSession } from "@/lib/auth";
import { EXTRACT_CONFIG } from "@/config/extract";

export const runtime = "nodejs";

type Body = {
  fileName: string;
  fileSize: number;
};

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json(errorEnvelope("UNAUTHORIZED", "Auth required"), { status: 401 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(errorEnvelope("BAD_REQUEST", "Invalid JSON body"), { status: 400 });
  }

  const { fileName, fileSize } = body ?? {};
  if (!fileName || typeof fileName !== "string") {
    return NextResponse.json(errorEnvelope("BAD_REQUEST", "fileName is required"), { status: 400 });
  }
  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    return NextResponse.json(errorEnvelope("BAD_REQUEST", "fileSize must be > 0"), { status: 400 });
  }
  const MAX_BYTES = EXTRACT_CONFIG.MAX_BYTES;
  if (fileSize > MAX_BYTES) {
    return NextResponse.json(errorEnvelope("PAYLOAD_TOO_LARGE", "File exceeds 10 MB limit"), { status: 413 });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "resumes";
  if (!supabaseUrl || !serviceRole) {
    return NextResponse.json(
      errorEnvelope("SERVER_CONFIG", "Supabase env vars missing"),
      { status: 500 },
    );
  }
  const supabase = createClient(supabaseUrl, serviceRole);

  const objectKey = `${session.user.id}/${crypto.randomUUID()}.pdf`;
  const path = `${bucket}/${objectKey}`;

  const { data, error } = await supabase.storage
    .from(bucket)
    // createSignedUploadUrl returns a URL for a single-use upload
    .createSignedUploadUrl(objectKey, { upsert: false });

  if (error) {
    return NextResponse.json(
      errorEnvelope("SUPABASE_ERROR", "Failed to create signed upload URL", { error: error.message }),
      { status: 500 },
    );
  }

  return NextResponse.json({
    signedUrl: data?.signedUrl,
    token: data?.token,
    storagePath: objectKey,
    // Supabase default expiry for signed upload tokens is short-lived (~2 minutes)
    // We surface a conservative 10-minute UI expiry expectation
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    constraints: {
      contentType: "application/pdf",
      maxLength: MAX_BYTES,
    },
  });
}


