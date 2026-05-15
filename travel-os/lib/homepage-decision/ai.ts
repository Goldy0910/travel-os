import { engineResultToHomepagePayload } from "@/lib/recommendation-engine/adapters/homepage";
import { decideFromHomepageRequest } from "@/lib/recommendation-engine/integration/hooks";
import type { HomepageDecisionRequest, HomepageDecisionResponse } from "./types";

const GEMINI_MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-1.5-flash"] as const;

/** Matches homepage/engine clamp (parseDecisionRequest). */
function clampRequestedDays(days: number): number {
  return Math.min(30, Math.max(1, Math.floor(days)));
}

/**
 * Ensures recommendation itinerary has exactly one entry per requested trip day
 * (model output sometimes omits days despite instructions).
 */
function normalizeRecommendationItinerary(
  raw: unknown,
  requestedDays: number,
  destination: string,
): string[] {
  const n = clampRequestedDays(requestedDays);
  const dest = destination.trim() || "your destination";
  const lines = Array.isArray(raw)
    ? raw.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean)
    : [];
  const capped = lines.slice(0, n);
  while (capped.length < n) {
    const idx = capped.length;
    capped.push(
      `Day ${idx + 1}: Explore ${dest} — flexible sightseeing and downtime`,
    );
  }
  return capped;
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1].trim() : trimmed;
  return JSON.parse(raw);
}

export async function runAiDecision(
  input: HomepageDecisionRequest,
): Promise<HomepageDecisionResponse | null> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return null;

  const fallback = engineResultToHomepagePayload(decideFromHomepageRequest(input));
  const mode = input.destination?.trim() ? "validation" : "recommendation";
  const itineraryDays = clampRequestedDays(input.days);

  const prompt = `You are TravelTill99, a decision-first travel advisor for Indian travelers.
Return ONLY valid JSON (no markdown) matching this schema:
${mode === "recommendation" ? RECOMMEND_SCHEMA : VALIDATION_SCHEMA}

User input:
- Days available: ${input.days}
- Priorities: ${input.priorities.join(", ") || "general"}
- Budget tier: ${input.budget ?? "not specified"}
- Destination (if checking): ${input.destination ?? "none — recommend one"}

Use realistic destinations. Prefer India & South/Southeast Asia for short trips.
${
    mode === "recommendation"
      ? `The "itinerary" array MUST contain exactly ${itineraryDays} strings, one per day of the trip, in order (Day 1 through Day ${itineraryDays}). Each string starts with "Day N: " describing highlights for that day only — no combining multiple calendar days into one string.`
      : ""
}
For validation fit use "strong" | "okay" | "weak".`;

  let lastError = "AI unavailable";
  for (const model of GEMINI_MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.35,
              maxOutputTokens: Math.min(8192, 900 + itineraryDays * 140),
            },
          }),
        },
      );
      const data = (await response.json().catch(() => null)) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        error?: { message?: string };
      } | null;
      if (!response.ok) {
        lastError = data?.error?.message ?? `HTTP ${response.status}`;
        continue;
      }
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!text) continue;
      const parsed = extractJson(text) as HomepageDecisionResponse;
      if (parsed?.mode === "recommendation" || parsed?.mode === "validation") {
        return normalizeAiResponse(parsed, fallback, itineraryDays);
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message : "parse error";
    }
  }
  void lastError;
  return null;
}

function normalizeAiResponse(
  ai: HomepageDecisionResponse,
  fallback: HomepageDecisionResponse,
  requestedItineraryDays: number,
): HomepageDecisionResponse {
  if (ai.mode === "recommendation" && fallback.mode === "recommendation") {
    return {
      ...ai,
      destinationSlug: ai.destinationSlug ?? fallback.destinationSlug,
      canonicalLocation: ai.canonicalLocation || fallback.canonicalLocation,
      alternatives: ai.alternatives?.length ? ai.alternatives : fallback.alternatives,
      itinerary: normalizeRecommendationItinerary(
        ai.itinerary,
        requestedItineraryDays,
        ai.destination,
      ),
    };
  }
  if (ai.mode === "validation" && fallback.mode === "validation") {
    return {
      ...ai,
      destinationSlug: ai.destinationSlug ?? fallback.destinationSlug,
      alternatives: ai.alternatives?.length ? ai.alternatives : fallback.alternatives,
    };
  }
  return ai;
}

const RECOMMEND_SCHEMA = `{
  "mode": "recommendation",
  "destination": "string",
  "destinationSlug": "string|null",
  "canonicalLocation": "string",
  "whyItFits": ["string"],
  "travelEffort": "string",
  "budgetEstimate": "string",
  "itinerary": ["string"],
  "alternatives": [{"name":"string","slug":"string|null","reason":"string"}]
}`;

const VALIDATION_SCHEMA = `{
  "mode": "validation",
  "destination": "string",
  "destinationSlug": "string|null",
  "fit": "strong"|"okay"|"weak",
  "summary": "string",
  "travelEffort": "string",
  "practicality": "string",
  "timeFit": "string",
  "budgetRealism": "string",
  "alternatives": [{"name":"string","slug":"string|null","reason":"string"}]
}`;
