export function isPdfMagicBytes(bytes: Uint8Array): boolean {
  // Minimal PDF check: starts with %PDF-
  if (bytes.length < 5) return false;
  const header = new TextDecoder().decode(bytes.subarray(0, 5));
  return header === "%PDF-";
}

export function ensurePdfAndSize(bytes: Uint8Array, maxBytes: number): { ok: true } | { ok: false; reason: string } {
  if (bytes.length === 0) return { ok: false, reason: "Empty file" };
  if (bytes.length > maxBytes) return { ok: false, reason: `File exceeds ${Math.floor(maxBytes / (1024 * 1024))} MB limit` };
  if (!isPdfMagicBytes(bytes)) return { ok: false, reason: "Invalid PDF (magic bytes)" };
  return { ok: true };
}


