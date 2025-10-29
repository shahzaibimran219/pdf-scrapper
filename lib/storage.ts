export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export function getStorageBucket(): string {
  return process.env.SUPABASE_STORAGE_BUCKET ?? "resumes";
}

export function validateStoragePath(userId: string, storagePath: string): boolean {
  // Must be something like `${userId}/<uuid>.pdf`
  if (!storagePath) return false;
  if (!storagePath.startsWith(`${userId}/`)) return false;
  if (!storagePath.endsWith(".pdf")) return false;
  // prevent traversal
  if (storagePath.includes("..")) return false;
  return true;
}


