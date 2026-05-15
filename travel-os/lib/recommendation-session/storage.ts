import {
  RECOMMENDATION_SESSION_KEY,
  RECOMMENDATION_SESSION_VERSION,
  type RecommendationContinuationIntent,
  type RecommendationFormState,
  type RecommendationSession,
} from "@/lib/recommendation-session/types";
import type { HomepageDecisionResponse } from "@/lib/homepage-decision/types";
import type { MasterTripPreferences } from "@/lib/master-trip-file/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function persistRecommendationSession(input: {
  decision: HomepageDecisionResponse;
  preferences: MasterTripPreferences;
  form: RecommendationFormState;
  intent?: RecommendationContinuationIntent;
}): void {
  if (typeof window === "undefined") return;
  const session: RecommendationSession = {
    version: RECOMMENDATION_SESSION_VERSION,
    savedAt: Date.now(),
    intent: input.intent ?? "continue-planning",
    decision: input.decision,
    preferences: input.preferences,
    form: input.form,
  };
  try {
    sessionStorage.setItem(RECOMMENDATION_SESSION_KEY, JSON.stringify(session));
  } catch {
    /* quota */
  }
}

export function loadRecommendationSession(): RecommendationSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(RECOMMENDATION_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || parsed.version !== RECOMMENDATION_SESSION_VERSION) {
      return null;
    }
    if (!isRecord(parsed.decision) || !isRecord(parsed.preferences) || !isRecord(parsed.form)) {
      return null;
    }
    const intent =
      parsed.intent === "create-trip-only" ? "create-trip-only" : "continue-planning";
    return {
      version: RECOMMENDATION_SESSION_VERSION,
      savedAt: Number(parsed.savedAt) || Date.now(),
      intent,
      decision: parsed.decision as HomepageDecisionResponse,
      preferences: parsed.preferences as MasterTripPreferences,
      form: parsed.form as RecommendationFormState,
    };
  } catch {
    return null;
  }
}

export function clearRecommendationSession(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(RECOMMENDATION_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/** Legacy draft key used by create-trip — keep in sync for date/place prefill. */
export function syncLegacyHomepageDraft(session: RecommendationSession): void {
  if (typeof window === "undefined") return;
  const slug = session.decision.destinationSlug;
  const query =
    session.decision.mode === "recommendation"
      ? session.decision.canonicalLocation || session.decision.destination
      : session.decision.destination;
  try {
    sessionStorage.setItem(
      "traveltill99-homepage-draft",
      JSON.stringify({
        slug,
        query: query || session.decision.destination,
        days: session.preferences.days,
        savedAt: session.savedAt,
      }),
    );
  } catch {
    /* ignore */
  }
}
