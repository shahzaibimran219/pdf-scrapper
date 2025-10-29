type BaseLog = {
  requestId?: string;
  userId?: string;
  resumeId?: string;
};

export function logInfo(message: string, meta: BaseLog = {}) {
  // Avoid logging PII; keep logs structured and transport-safe
  console.info(JSON.stringify({ level: "info", message, ...meta }));
}

export function logError(message: string, meta: BaseLog & { error?: unknown } = {}) {
  console.error(JSON.stringify({ level: "error", message, ...meta }));
}


