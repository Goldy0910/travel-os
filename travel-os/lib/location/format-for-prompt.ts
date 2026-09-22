import type { UserLocationPromptContext } from "@/lib/location/types";

/**
 * Formats location for the system prompt. Never includes lat/lng.
 * Returns empty string when unavailable so callers can omit gracefully.
 */
export function formatUserLocationForPrompt(
  location: UserLocationPromptContext | null | undefined,
): string {
  if (!location) return "";
  const city = location.city?.trim() || null;
  const state = location.state?.trim() || null;
  const country = location.country?.trim() || null;
  if (!city && !state && !country) return "";

  const where = [city, state, country].filter(Boolean).join(", ");

  const lines = [
    "Current User Location (AUTHORITATIVE — you already know where the user is):",
    city ? `City: ${city}` : null,
    state ? `State: ${state}` : null,
    country ? `Country: ${country}` : null,
    "",
    "Location usage rules (required):",
    `- The user is in/near ${where}. Treat this as known fact.`,
    `- For "around me", "near me", or "nearby" with no other destination named — recommend places for ${where}.`,
    "- NEVER say you cannot access, don't have, or still need their location when this block is present.",
    "- NEVER open with asking where they are if Current User Location is present.",
    "- If an earlier message in this chat claimed location was unavailable, ignore that — you have it now.",
    "- If the user explicitly names another city/region/country, that place overrides this location for the answer.",
    `- When comparing or recommending trip destinations (hill stations, beaches, cities to visit), recommend places IN those destinations — not cafes or sights in ${where}.`,
    "- Never reveal exact coordinates. Never invent a different home city.",
  ].filter((line): line is string => line != null);

  return lines.join("\n");
}

/**
 * Only used when location is truly absent.
 * Keep soft — do not make the model lead with "I can't access your location".
 */
export const MISSING_LOCATION_PROMPT_HINT = `Current User Location: (not provided)
If the user asks for nearby / "around me" suggestions without naming a place, ask once which city they mean, or give a short general tip that they can set location in Settings. Do not invent a city. Do not claim you "still can't access" location as an opener. Do not repeatedly ask.`;
