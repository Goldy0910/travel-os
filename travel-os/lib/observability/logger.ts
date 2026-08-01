/**
 * Structured logging for AI / chat / tools — redacts secrets and truncates content.
 * No PII dumps: message bodies and prompts are length-capped and never logged in full.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogFields = Record<string, unknown>;

const SECRET_KEY =
  /^(api[_-]?key|authorization|cookie|token|secret|password|x-goog-api-key)$/i;
const MAX_STRING = 120;
const MAX_DEPTH = 4;

function truncate(value: string, max = MAX_STRING): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…(+${value.length - max})`;
}

function sanitize(value: unknown, depth = 0, keyHint = ""): unknown {
  if (depth > MAX_DEPTH) return "[MaxDepth]";
  if (value == null) return value;
  if (typeof value === "string") {
    if (SECRET_KEY.test(keyHint)) return "[REDACTED]";
    return truncate(value);
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Error) {
    return {
      name: value.name,
      message: truncate(value.message, 200),
    };
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitize(item, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY.test(k)) {
        out[k] = "[REDACTED]";
        continue;
      }
      // Never dump full prompts / message bodies / raw SSE payloads.
      if (
        /^(content|message|prompt|systemPrompt|body|text|history)$/i.test(k) &&
        typeof v === "string"
      ) {
        out[k] = truncate(v, 80);
        out[`${k}Length`] = v.length;
        continue;
      }
      out[k] = sanitize(v, depth + 1, k);
    }
    return out;
  }
  return String(value);
}

function emit(level: LogLevel, scope: string, message: string, fields?: LogFields) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    scope,
    message,
    ...(fields ? { fields: sanitize(fields) as LogFields } : {}),
  };
  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else if (level === "debug") {
    if (process.env.NODE_ENV !== "production") {
      console.debug(line);
    }
  } else {
    console.info(line);
  }
}

export function createLogger(scope: string) {
  return {
    debug(message: string, fields?: LogFields) {
      emit("debug", scope, message, fields);
    },
    info(message: string, fields?: LogFields) {
      emit("info", scope, message, fields);
    },
    warn(message: string, fields?: LogFields) {
      emit("warn", scope, message, fields);
    },
    error(message: string, fields?: LogFields) {
      emit("error", scope, message, fields);
    },
  };
}

/** Short opaque id for correlating a single request across logs. */
export function createRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().slice(0, 8);
  }
  return `r${Date.now().toString(36).slice(-6)}`;
}

export const aiLogger = createLogger("ai");
export const chatLogger = createLogger("chat");
export const toolsLogger = createLogger("tools");
