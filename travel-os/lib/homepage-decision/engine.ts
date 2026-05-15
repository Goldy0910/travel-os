import { engineResultToHomepagePayload } from "@/lib/recommendation-engine/adapters/homepage";
import { decideFromHomepageRequest } from "@/lib/recommendation-engine/integration/hooks";
import { presetToDays } from "./catalog";
import type { HomepageDecisionRequest, HomepageDecisionResponse } from "./types";

export function runRulesDecision(input: HomepageDecisionRequest): HomepageDecisionResponse {
  return engineResultToHomepagePayload(decideFromHomepageRequest(input));
}

export function parseDecisionRequest(body: unknown): HomepageDecisionRequest | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const durationPreset =
    typeof b.durationPreset === "string" ? b.durationPreset : "5-days";
  const customDays = typeof b.customDays === "number" ? b.customDays : undefined;
  const days =
    typeof b.days === "number" && Number.isFinite(b.days)
      ? Math.min(30, Math.max(1, Math.floor(b.days)))
      : undefined;
  const priorities = Array.isArray(b.priorities)
    ? b.priorities.filter((p): p is HomepageDecisionRequest["priorities"][number] => typeof p === "string")
    : [];
  const destination = typeof b.destination === "string" ? b.destination : undefined;
  const originCity = typeof b.originCity === "string" ? b.originCity : undefined;
  const budget =
    b.budget === "budget" || b.budget === "moderate" || b.budget === "premium"
      ? b.budget
      : undefined;
  const travelMonth =
    typeof b.travelMonth === "number" && b.travelMonth >= 1 && b.travelMonth <= 12
      ? Math.floor(b.travelMonth)
      : undefined;

  const resolvedDays = days ?? presetToDays(durationPreset, customDays);

  return {
    days: resolvedDays,
    durationPreset: durationPreset as HomepageDecisionRequest["durationPreset"],
    priorities,
    destination: destination?.trim() || undefined,
    originCity: originCity?.trim() || undefined,
    budget,
    customDays,
    travelMonth,
  };
}
