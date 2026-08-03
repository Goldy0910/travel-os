/**
 * Classify / soften Gemini API errors for chat UI.
 * Never conflate these with Google Maps / Places failures.
 */

export function isGeminiQuotaOrBillingError(message: string): boolean {
  return /prepayment|prepaid|credits? (are )?depleted|billing#prepay|ai\.studio\/projects|exceeded your current quota|RESOURCE_EXHAUSTED|quota exceeded/i.test(
    message,
  );
}

export function isGeminiPrepayCreditsError(message: string): boolean {
  return /prepayment|prepaid|credits? (are )?depleted|billing#prepay/i.test(message);
}

export function isGeminiApiKeyError(message: string): boolean {
  return /API[_ ]?key|PERMISSION_DENIED|UNAUTHENTICATED|invalid.*key/i.test(message);
}

/**
 * Next Gemini daily free-tier / RPD reset: midnight US Pacific Time.
 * @see https://ai.google.dev/gemini-api/docs/rate-limits
 */
export function getNextGeminiDailyQuotaReset(now: Date = new Date()): {
  at: Date;
  /** e.g. "Sunday, 2 Aug, 12:30 pm" in the viewer's local timezone */
  localLabel: string;
  pacificLabel: string;
} {
  const ptClock = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);

  const num = (type: Intl.DateTimeFormatPartTypes) =>
    Number(ptClock.find((p) => p.type === type)?.value ?? "0");

  const hour = num("hour");
  const minute = num("minute");
  const second = num("second");
  const elapsedInPtDay = hour * 3600 + minute * 60 + second;
  const secondsUntilMidnightPt = elapsedInPtDay === 0 ? 24 * 3600 : 24 * 3600 - elapsedInPtDay;
  const at = new Date(now.getTime() + secondsUntilMidnightPt * 1000);

  const localLabel = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(at);

  return {
    at,
    localLabel,
    pacificLabel: "midnight Pacific Time (PT)",
  };
}

function geminiRenewalSentence(now: Date = new Date()): string {
  const { localLabel, pacificLabel } = getNextGeminiDailyQuotaReset(now);
  return `Daily free-tier limits renew at ${pacificLabel} (~${localLabel} your time). Prepaid credits do not auto-renew — top them up in AI Studio if this project uses prepay.`;
}

/**
 * User-facing chat error. Maps/Places issues must never surface here.
 * Prefer calling this on the client so renewal time uses the viewer's timezone.
 */
export function formatChatGeminiError(raw: unknown): string {
  const message = raw instanceof Error ? raw.message : String(raw ?? "");
  const trimmed = message.trim() || "Chat failed";

  // Avoid double-wrapping an already formatted message
  if (/Daily free-tier limits renew at/i.test(trimmed)) {
    return trimmed;
  }

  if (isGeminiQuotaOrBillingError(trimmed)) {
    const renewal = geminiRenewalSentence();
    if (isGeminiPrepayCreditsError(trimmed)) {
      return `Gemini API prepaid credits for this key are depleted. Chat uses Gemini (not Google Maps). ${renewal} Or set a different GEMINI_API_KEY in .env.local.`;
    }
    return `Gemini API quota for this key is exhausted. Chat uses Gemini (not Google Maps). ${renewal} Or set a different GEMINI_API_KEY in .env.local.`;
  }

  if (/Missing GEMINI_API_KEY/i.test(trimmed)) {
    return "Missing GEMINI_API_KEY. Add your Gemini API key from Google AI Studio to .env.local.";
  }

  // Strip long AI Studio URLs from raw Google errors for cleaner UI
  if (trimmed.length > 220 || /ai\.google\.dev|ai\.studio/i.test(trimmed)) {
    return "Gemini could not complete this reply. Check GEMINI_API_KEY and your AI Studio quota, then try again.";
  }

  return trimmed;
}

/**
 * User-facing Maps / Places error — only for place pages / place cards.
 */
export function formatPlacesMapsError(raw?: string | null): string {
  const message = (raw ?? "").trim();
  if (/PERMISSION_DENIED|403|not been used|enable/i.test(message)) {
    return "Google Places API is unavailable for this key. Enable Places API (New) on the project for GOOGLE_PLACES_API_KEY. This does not affect AI chat.";
  }
  if (/referrer|API_KEY_HTTP_REFERRER/i.test(message)) {
    return "This Google key is restricted to HTTP referrers. Use a server key (IP or unrestricted) for Places. Chat is unaffected.";
  }
  if (!message) {
    return "Place details from Google Maps are temporarily unavailable. AI chat still works normally.";
  }
  return `${message} (Google Places / Maps only — chat is unaffected.)`;
}
