import type { ChatPlaceCard } from "@/lib/places/types";

/** Read place cards from assistant message metadata when present. */
export function placeCardsFromMessageMetadata(
  metadata: Record<string, unknown> | undefined,
): ChatPlaceCard[] {
  if (!metadata || typeof metadata !== "object") return [];
  const raw = metadata.placeCards;
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is ChatPlaceCard => {
    if (!item || typeof item !== "object") return false;
    const c = item as Partial<ChatPlaceCard>;
    return typeof c.placeId === "string" && typeof c.name === "string";
  });
}

export function isChatPlaceCard(value: unknown): value is ChatPlaceCard {
  if (!value || typeof value !== "object") return false;
  const c = value as Partial<ChatPlaceCard>;
  return typeof c.placeId === "string" && typeof c.name === "string";
}
