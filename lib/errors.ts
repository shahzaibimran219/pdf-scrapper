export type ErrorEnvelope = {
  code: string;
  message: string;
  details?: unknown;
};

export function errorEnvelope(code: string, message: string, details?: unknown): ErrorEnvelope {
  return { code, message, details };
}


