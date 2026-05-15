import type { MasterTripFile } from "@/lib/master-trip-file/types";
import type { RefinementEngineInput, RefinementEngineResult, TripRefinementPatch } from "./types";
import { runRulesRefinement } from "./rules-engine";

const GEMINI_MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-1.5-flash"] as const;

const PATCH_SCHEMA = `{
  "affectedSections": ["preferences"|"itinerary"|"practical"|"whyItFits"|"recommendation"],
  "assistantMessage": "string — friendly summary of what you changed (2-3 sentences)",
  "preferences": { "days"?: number, "budget"?: "budget"|"moderate"|"premium", "priorities"?: string[] } | optional,
  "itineraryOps": [
    { "op": "update", "dayId": "existing-id", "summary"?: "string" },
    { "op": "add", "dayNumber": number, "summary": "string" },
    { "op": "remove", "dayId": "existing-id" },
    { "op": "truncate", "maxDays": number },
    { "op": "replace_summaries", "days": [{ "dayNumber": number, "summary": "string" }] }
  ] | optional,
  "practical": { "travelEffort"?: string, "budgetEstimate"?: string } | optional,
  "whyItFits": ["string"] | optional,
  "recommendationNote": "string | optional"
}`;

function buildPrompt(input: RefinementEngineInput): string {
  const { file, message } = input;
  const itineraryJson = file.itinerary.map((d) => ({
    id: d.id,
    dayNumber: d.dayNumber,
    title: d.title,
    summary: d.summary,
  }));

  return `You are TravelTill99 trip refinement assistant.

CRITICAL RULES:
- Do NOT regenerate the entire trip or replace the destination.
- Return ONLY a JSON patch object (no markdown).
- Change ONLY sections affected by the user request.
- Preserve itinerary day "id" fields for update/remove ops.
- Prefer replace_summaries or update ops over removing all days.
- If shortening duration, use truncate with maxDays.
- Keep the same destination: ${file.destination.name}.

Current plan:
- Destination: ${file.destination.canonicalLocation}
- Days: ${file.preferences.days}
- Budget: ${file.preferences.budget ?? "not set"}
- Priorities: ${file.preferences.priorities.join(", ")}
- Why it fits: ${file.recommendation.whyItFits.join(" | ")}
- Practical: effort=${file.practical.travelEffort}, budget=${file.practical.budgetEstimate}
- Itinerary days: ${JSON.stringify(itineraryJson)}

User request: "${message}"

Schema:
${PATCH_SCHEMA}`;
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1].trim() : trimmed;
  return JSON.parse(raw);
}

function validatePatch(raw: unknown, file: MasterTripFile): TripRefinementPatch | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const msg = typeof p.assistantMessage === "string" ? p.assistantMessage.trim() : "";
  if (!msg) return null;

  const ALLOWED: TripRefinementPatch["affectedSections"][number][] = [
    "preferences",
    "itinerary",
    "practical",
    "whyItFits",
    "recommendation",
  ];
  const sections = Array.isArray(p.affectedSections)
    ? p.affectedSections.filter(
        (s): s is TripRefinementPatch["affectedSections"][number] =>
          typeof s === "string" && (ALLOWED as string[]).includes(s),
      )
    : ["itinerary"];

  const patch: TripRefinementPatch = {
    affectedSections: (sections.length ? sections : ["itinerary"]) as TripRefinementPatch["affectedSections"],
    assistantMessage: msg,
  };

  if (p.preferences && typeof p.preferences === "object") {
    patch.preferences = p.preferences as TripRefinementPatch["preferences"];
  }
  if (Array.isArray(p.itineraryOps)) {
    patch.itineraryOps = p.itineraryOps as TripRefinementPatch["itineraryOps"];
  }
  if (p.practical && typeof p.practical === "object") {
    patch.practical = p.practical as TripRefinementPatch["practical"];
  }
  if (Array.isArray(p.whyItFits)) {
    patch.whyItFits = p.whyItFits.filter((x): x is string => typeof x === "string");
  }
  if (typeof p.recommendationNote === "string") {
    patch.recommendationNote = p.recommendationNote;
  }

  const validIds = new Set(file.itinerary.map((d) => d.id));
  patch.itineraryOps = patch.itineraryOps?.filter((op) => {
    if (op.op === "update" || op.op === "remove") return validIds.has(op.dayId);
    return true;
  });

  return patch;
}

export async function runAiRefinement(
  input: RefinementEngineInput,
): Promise<RefinementEngineResult | null> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return null;

  const prompt = buildPrompt(input);
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
            generationConfig: { temperature: 0.35, maxOutputTokens: 1800 },
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
      const parsed = extractJson(text);
      const patch = validatePatch(parsed, input.file);
      if (patch) return { patch, source: "ai" };
    } catch (e) {
      lastError = e instanceof Error ? e.message : "parse error";
    }
  }
  void lastError;
  return null;
}

export async function runRefinementEngine(
  input: RefinementEngineInput,
): Promise<RefinementEngineResult> {
  const rules = runRulesRefinement(input);
  if (rules) return rules;

  const ai = await runAiRefinement(input);
  if (ai) return ai;

  const fallbackRules = runRulesRefinement({
    ...input,
    quickActionId: "more-relaxing",
    message: input.message,
  });

  if (fallbackRules) {
    fallbackRules.patch.assistantMessage =
      "I applied a light refinement based on your request. For deeper changes, try a quick action chip.";
    return fallbackRules;
  }

  return {
    source: "rules",
    patch: {
      affectedSections: ["whyItFits"],
      assistantMessage:
        "I couldn't parse specific changes — try a quick chip like “More Relaxing” or “Reduce Budget”, or rephrase your request.",
      whyItFits: input.file.recommendation.whyItFits,
    },
  };
}
