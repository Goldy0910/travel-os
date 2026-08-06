import "server-only";

import type { ChatEntity } from "@/lib/chat/structured-response";
import { isBlockedChatEntityName } from "@/lib/chat/structured-response";
import { GoogleMapsService } from "@/lib/places/google-maps-service";
import type { ChatPlaceCard, ExtractedPlace } from "@/lib/places/types";

export type PlaceEnrichmentOptions = {
  /** Bias text search toward a trip destination (e.g. "Tokyo"). */
  locationBias?: string | null;
  limit?: number;
  signal?: AbortSignal;
};

function entitiesToExtractedPlaces(entities: ChatEntity[]): ExtractedPlace[] {
  const out: ExtractedPlace[] = [];
  const seen = new Set<string>();
  for (const entity of entities) {
    const name = entity.name.trim();
    if (name.length < 2 || isBlockedChatEntityName(name)) continue;
    const type = String(entity.type || "place").trim() || "place";
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      name,
      type,
      confidence: 1,
    });
  }
  return out;
}

/**
 * Enrich model-emitted entities via Places API (New).
 * Prefer this over post-hoc text extraction.
 */
export class PlaceEnrichmentService {
  static async enrichFromEntities(
    entities: ChatEntity[],
    options?: PlaceEnrichmentOptions,
  ): Promise<ChatPlaceCard[]> {
    try {
      if (!GoogleMapsService.hasKey()) return [];
      if (options?.signal?.aborted) return [];
      const places = entitiesToExtractedPlaces(entities);
      if (!places.length) return [];
      return this.enrichExtractedPlaces(places, options);
    } catch {
      return [];
    }
  }

  static async enrichExtractedPlaces(
    places: ExtractedPlace[],
    options?: PlaceEnrichmentOptions,
  ): Promise<ChatPlaceCard[]> {
    const limit = options?.limit ?? 6;
    const bias = options?.locationBias?.trim() || "";
    const biasKey = bias.toLowerCase();

    // Prefer specific venues over the destination itself when both appear.
    let candidates = places;
    if (biasKey && places.length > 1) {
      const withoutBias = places.filter((p) => p.name.trim().toLowerCase() !== biasKey);
      if (withoutBias.length) candidates = withoutBias;
    }

    const cards: ChatPlaceCard[] = [];
    const seen = new Set<string>();

    for (const place of candidates.slice(0, limit)) {
      if (options?.signal?.aborted) break;
      if (isBlockedChatEntityName(place.name)) continue;
      const query = bias ? `${place.name}, ${bias}` : place.name;
      const placeId = await GoogleMapsService.searchPlaceId(query);
      if (!placeId || seen.has(placeId)) continue;

      const card = await GoogleMapsService.getPlaceCard(placeId);
      if (!card) continue;

      seen.add(placeId);
      cards.push(card);
      if (cards.length >= limit) break;
    }

    return cards;
  }
}

/** Build place cards from structured chat entities. */
export async function buildChatPlaceCardsFromEntities(
  entities: ChatEntity[],
  options?: PlaceEnrichmentOptions,
): Promise<ChatPlaceCard[]> {
  return PlaceEnrichmentService.enrichFromEntities(entities, options);
}

/** @deprecated Prefer buildChatPlaceCardsFromEntities — kept for callers that only have free text. */
export async function buildChatPlaceCardsFromText(
  _assistantText: string,
  _options?: PlaceEnrichmentOptions,
): Promise<ChatPlaceCard[]> {
  return [];
}
