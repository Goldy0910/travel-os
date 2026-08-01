/**
 * Rate-limit helpers for chat / AI paths.
 *
 * Happy path: when under the limit, checkRateLimit returns allowed:true with
 * negligible overhead — callers should not change behavior on allow.
 *
 * Enforcement is optional via env (RATE_LIMIT_ENABLED=true). Without it, the
 * helpers still record hits so wiring can be verified in logs/metrics later.
 */

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  limit: number;
  retryAfterMs: number;
  /** True when enforcement is off — always allowed, counters still update. */
  enforce: boolean;
};

export type RateLimitOptions = {
  /** Unique bucket key, e.g. `chat:userId` or `tool:name:userId`. */
  key: string;
  /** Max requests in the window. */
  limit?: number;
  /** Sliding window length in ms. */
  windowMs?: number;
  /**
   * When true (or RATE_LIMIT_ENABLED=true), deny over-limit requests.
   * Default false so production wiring is safe until explicitly enabled.
   */
  enforce?: boolean;
};

type Bucket = {
  timestamps: number[];
};

const globalStore = globalThis as typeof globalThis & {
  __travelOsRateLimitStore?: Map<string, Bucket>;
};

function store(): Map<string, Bucket> {
  if (!globalStore.__travelOsRateLimitStore) {
    globalStore.__travelOsRateLimitStore = new Map();
  }
  return globalStore.__travelOsRateLimitStore;
}

function shouldEnforce(explicit?: boolean): boolean {
  if (typeof explicit === "boolean") return explicit;
  return process.env.RATE_LIMIT_ENABLED === "true";
}

/**
 * Sliding-window rate check. Safe to call on every request.
 * Prunes old timestamps; O(n) where n is hits in the window (small).
 */
export function checkRateLimit(options: RateLimitOptions): RateLimitResult {
  const limit = Math.max(1, options.limit ?? 60);
  const windowMs = Math.max(1_000, options.windowMs ?? 60_000);
  const enforce = shouldEnforce(options.enforce);
  const now = Date.now();
  const cutoff = now - windowMs;

  const buckets = store();
  let bucket = buckets.get(options.key);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(options.key, bucket);
  }

  bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);

  if (bucket.timestamps.length >= limit) {
    const oldest = bucket.timestamps[0] ?? now;
    const retryAfterMs = Math.max(0, oldest + windowMs - now);
    return {
      allowed: !enforce,
      remaining: 0,
      limit,
      retryAfterMs,
      enforce,
    };
  }

  bucket.timestamps.push(now);
  return {
    allowed: true,
    remaining: Math.max(0, limit - bucket.timestamps.length),
    limit,
    retryAfterMs: 0,
    enforce,
  };
}

/** Convenience for chat POST — 30 req / min / user by default. */
export function checkChatRateLimit(userId: string, enforce?: boolean): RateLimitResult {
  return checkRateLimit({
    key: `chat:${userId}`,
    limit: 30,
    windowMs: 60_000,
    enforce,
  });
}

/** Convenience for tool execution — 60 / min / user+tool. */
export function checkToolRateLimit(
  userId: string | undefined,
  toolName: string,
  enforce?: boolean,
): RateLimitResult {
  return checkRateLimit({
    key: `tool:${toolName}:${userId || "anon"}`,
    limit: 60,
    windowMs: 60_000,
    enforce,
  });
}

/**
 * Client-side cooldown guard (module singleton).
 * Returns false if called again within `minIntervalMs` for the same key.
 */
const clientLastHit = new Map<string, number>();

export function clientAllowRequest(
  key: string,
  minIntervalMs = 400,
): boolean {
  const now =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  const last = clientLastHit.get(key) ?? 0;
  if (now - last < minIntervalMs) return false;
  clientLastHit.set(key, now);
  return true;
}

/** Build standard 429 JSON body when a limit is enforced. */
export function rateLimitResponse(result: RateLimitResult): Response {
  const retrySec = Math.max(1, Math.ceil(result.retryAfterMs / 1000));
  return Response.json(
    {
      ok: false,
      error: "Too many requests. Please wait a moment and try again.",
      code: "RATE_LIMITED",
      retryAfterSec: retrySec,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retrySec),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
      },
    },
  );
}
