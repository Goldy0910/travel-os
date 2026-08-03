import type { ConversationMemoryFields } from "@/lib/chat/memory-types";

export type ConversationLabel = {
  /** Primary sidebar name — destination / place. */
  title: string;
  /** Secondary line — trip theme / summary from captured prefs. */
  subtitle: string;
};

function uniqueNonEmpty(parts: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const v = part?.trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

/**
 * Build sidebar title + subtitle from conversation memory only (no LLM).
 * Title = place/destination. Subtitle = theme / trip summary from prefs.
 */
export function buildConversationLabel(
  memory: ConversationMemoryFields | null | undefined,
): ConversationLabel {
  if (!memory) {
    return { title: "New chat", subtitle: "Start planning" };
  }

  const place =
    memory.preferred_destination?.trim() ||
    memory.candidate_destinations.find((d) => d.trim())?.trim() ||
    "";

  const themeParts = uniqueNonEmpty([
    memory.interests.slice(0, 2).join(" · ") || null,
    memory.travel_duration,
    memory.travel_dates,
    memory.group_size,
    memory.weather_preference,
    memory.budget
      ? /₹|inr|rs\.?/i.test(memory.budget)
        ? memory.budget
        : `${memory.budget}`
      : null,
    memory.food_preferences.slice(0, 1).join(", ") || null,
    memory.visa_preference,
  ]).slice(0, 3);

  let title = place;
  if (!title) {
    if (memory.discovery_active) title = "Destination discovery";
    else if (themeParts.length > 0) title = "Trip planning";
    else title = "New chat";
  }

  let subtitle = themeParts.join(" · ");
  if (!subtitle) {
    if (memory.candidate_destinations.length > 1) {
      subtitle = `Considering ${memory.candidate_destinations.slice(0, 3).join(", ")}`;
    } else if (memory.discovery_active) {
      subtitle = "Finding the right destination";
    } else if (place) {
      subtitle = "Travel plans";
    } else {
      subtitle = "Start planning";
    }
  }

  return {
    title: title.slice(0, 80),
    subtitle: subtitle.slice(0, 140),
  };
}

/** True when the label is more specific than a blank / default chat. */
export function conversationLabelIsReady(label: ConversationLabel): boolean {
  const t = label.title.trim().toLowerCase();
  return Boolean(t) && t !== "new chat";
}
