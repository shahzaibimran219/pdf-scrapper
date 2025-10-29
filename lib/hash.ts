export async function computeSourceHash(bytes: Uint8Array, userId: string): Promise<string> {
  const data = new Uint8Array(bytes.length + userId.length);
  data.set(bytes, 0);
  data.set(new TextEncoder().encode(userId), bytes.length);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}


