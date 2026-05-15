import { saveMasterTripAction } from "@/app/app/master-trip/actions";
import {
  clearRecommendationSession,
  loadRecommendationSession,
  syncLegacyHomepageDraft,
} from "@/lib/recommendation-session/storage";

type RouterLike = {
  push: (href: string) => void;
  refresh: () => void;
};

export type ContinueRecommendationResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string; needsAuth?: boolean };

export async function continueRecommendationPlanning(): Promise<ContinueRecommendationResult> {
  const session = loadRecommendationSession();
  if (!session || session.intent !== "continue-planning") {
    return { ok: false, error: "No trip plan to continue." };
  }

  const fd = new FormData();
  fd.set(
    "payload",
    JSON.stringify({
      decision: session.decision,
      preferences: session.preferences,
      travelPlaceSlug: session.decision.destinationSlug,
    }),
  );

  const res = await saveMasterTripAction(fd);
  if (res.ok) {
    clearRecommendationSession();
    if (res.redirectTo) {
      return { ok: true, redirectTo: res.redirectTo };
    }
    return { ok: true, redirectTo: "/app/trips" };
  }

  if (res.error.toLowerCase().includes("sign in")) {
    syncLegacyHomepageDraft(session);
    return { ok: false, error: res.error, needsAuth: true };
  }

  return { ok: false, error: res.error };
}

/**
 * After login: auto-save recommendation and navigate into the trip flow.
 * @returns true if navigation was triggered
 */
export async function tryConsumePendingRecommendation(router: RouterLike): Promise<boolean> {
  const session = loadRecommendationSession();
  if (!session) return false;

  if (session.intent === "create-trip-only") {
    const slug = session.decision.destinationSlug;
    const q =
      session.decision.mode === "recommendation"
        ? session.decision.canonicalLocation || session.decision.destination
        : session.decision.destination;
    const params = new URLSearchParams();
    if (slug) params.set("place", slug);
    else if (q) params.set("q", q);
    params.set("days", String(session.preferences.days));
    clearRecommendationSession();
    router.push(`/app/create-trip?${params.toString()}`);
    router.refresh();
    return true;
  }

  const result = await continueRecommendationPlanning();
  if (result.ok) {
    router.push(result.redirectTo);
    router.refresh();
    return true;
  }

  return false;
}
