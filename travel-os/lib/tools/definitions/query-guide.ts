import { detectTripLanguage } from "@/app/app/_lib/detect-trip-language";
import { getEmergencyLines } from "@/app/app/_lib/emergency-lines";
import { resolveDestination } from "@/app/app/_lib/destination-intel";
import { currencyForPlace } from "@/app/app/forex/_lib/geo-currency";
import {
  DESTINATION_CATALOG,
  getDestinationBySlug,
} from "@/lib/find-destination/catalog";
import { resolveDestinationSlugs } from "@/lib/destination-knowledge/retrieve";
import { topicKnowledgeBySlug } from "@/lib/destination-knowledge/topics";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { ToolContext, ToolDefinition, ToolResult } from "@/lib/tools/types";
import { isTripMember } from "@/lib/trip-membership";
import type { TravelGuidesBundle } from "@/lib/travelGuides";
import { getTravelGuidesForPlaceScalable } from "@/lib/travelGuides-sheet";

export const GUIDE_CATEGORIES = [
  "restaurants",
  "places",
  "emergency",
  "transport",
  "shopping",
  "weather",
  "currency",
] as const;

export type GuideCategory = (typeof GUIDE_CATEGORIES)[number];

export type QueryGuideInput = {
  category: GuideCategory;
  /** Destination / place name. Optional when tripId (or ctx.tripId) is set. */
  place?: string;
  /** Trip UUID — resolves destination from the trip when authorized. */
  tripId?: string;
  /** Optional free-text focus (e.g. "vegetarian", "night markets"). */
  query?: string;
  /** ISO currency code for live rate lookup (currency category). */
  currencyCode?: string;
};

export type GuideVideoItem = {
  title: string;
  youtubeId: string;
  url: string;
};

export type GuideLinkItem = {
  title: string;
  url: string;
};

export type QueryGuideOutput = {
  category: GuideCategory;
  place: string;
  country: string;
  language: string;
  currencyCode: string;
  /** Concise, AI-ready prose summarizing the guide slice. */
  summary: string;
  /** Structured fields the model can cite. */
  data: Record<string, unknown>;
  sources: string[];
};

const FALLBACK_INR: Record<string, number> = {
  USD: 83.5,
  EUR: 90.5,
  GBP: 106.5,
  INR: 1,
  AED: 22.75,
  SGD: 61.5,
  JPY: 0.55,
  THB: 2.3,
  IDR: 0.0052,
  MYR: 18.5,
  LKR: 0.27,
  NPR: 0.62,
  VND: 0.0033,
  TRY: 2.4,
  CHF: 95,
  AUD: 54,
  CAD: 60,
  NZD: 50,
  MVR: 5.4,
};

const SHOPPING_ATTRACTION_RE = /market|bazaar|mall|souk|shop|chatuchak|flea|craft/i;

function youtubeUrl(youtubeId: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(youtubeId)}`;
}

function toVideoItems(
  videos: Array<{ title: string; youtubeId: string }> | undefined,
): GuideVideoItem[] {
  if (!Array.isArray(videos)) return [];
  return videos
    .filter((v) => v?.title && v?.youtubeId)
    .map((v) => ({
      title: v.title,
      youtubeId: v.youtubeId,
      url: youtubeUrl(v.youtubeId),
    }));
}

function normalizePlaceKey(place: string): string {
  return place.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function findCatalogMatch(place: string) {
  const slugs = resolveDestinationSlugs([place]);
  if (slugs[0]) {
    const bySlug = getDestinationBySlug(slugs[0]);
    if (bySlug) return bySlug;
  }
  const key = normalizePlaceKey(place);
  if (!key) return null;
  return (
    DESTINATION_CATALOG.find((d) => {
      const name = normalizePlaceKey(d.name);
      const slug = normalizePlaceKey(d.slug.replace(/-/g, " "));
      const country = normalizePlaceKey(d.country);
      return (
        key === name ||
        key === slug ||
        key.includes(name) ||
        name.includes(key) ||
        (key.includes(country) && key.includes(name.split(" ")[0] ?? name))
      );
    }) ?? null
  );
}

async function resolvePlaceFromTrip(
  tripId: string,
  ctx: ToolContext,
): Promise<{ ok: true; place: string } | { ok: false; error: string; code: string }> {
  const userId = ctx.userId?.trim();
  if (!userId) {
    return {
      ok: false,
      error: "Authentication required to load guide data from a trip",
      code: "UNAUTHORIZED",
    };
  }

  const supabase = await createSupabaseServerClient();
  const member = await isTripMember(supabase, tripId, userId);
  if (!member) {
    return {
      ok: false,
      error: "Not authorized for this trip",
      code: "UNAUTHORIZED",
    };
  }

  const { data: trip, error } = await supabase
    .from("trips")
    .select("place, location, destination, city, title")
    .eq("id", tripId)
    .maybeSingle();

  if (error || !trip) {
    return { ok: false, error: "Trip not found", code: "HANDLER_ERROR" };
  }

  const row = trip as Record<string, unknown>;
  const place =
    [row.place, row.location, row.destination, row.city, row.title]
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .find((v) => v.length > 0) ?? "";

  if (!place) {
    return {
      ok: false,
      error: "Trip has no destination/location set",
      code: "INVALID_INPUT",
    };
  }

  return { ok: true, place };
}

async function fetchRateToInr(
  currencyCode: string,
  signal?: AbortSignal,
): Promise<{
  base: string;
  rateToInr: number;
  lastUpdatedIso: string;
  source: "live" | "fallback";
}> {
  const base = currencyCode.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(base)) {
    return {
      base: "USD",
      rateToInr: FALLBACK_INR.USD!,
      lastUpdatedIso: new Date().toISOString(),
      source: "fallback",
    };
  }
  if (base === "INR") {
    return {
      base,
      rateToInr: 1,
      lastUpdatedIso: new Date().toISOString(),
      source: "fallback",
    };
  }

  try {
    const response = await fetch(
      `https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`,
      { cache: "no-store", signal },
    );
    const data = (await response.json()) as {
      result?: string;
      rates?: Record<string, number>;
      time_last_update_unix?: number;
      time_last_update_utc?: string;
    };
    if (!response.ok || data.result !== "success" || data.rates?.INR == null) {
      throw new Error("Live rates unavailable");
    }
    const lastUpdatedIso = data.time_last_update_unix
      ? new Date(data.time_last_update_unix * 1000).toISOString()
      : new Date(data.time_last_update_utc ?? Date.now()).toISOString();
    return {
      base,
      rateToInr: data.rates.INR,
      lastUpdatedIso,
      source: "live",
    };
  } catch {
    return {
      base,
      rateToInr: FALLBACK_INR[base] ?? FALLBACK_INR.USD!,
      lastUpdatedIso: new Date().toISOString(),
      source: "fallback",
    };
  }
}

function emptyBundle(): TravelGuidesBundle {
  return {
    places: [],
    food: [],
    essentials: { weather: "", language: "", currency: "", fashion: "", tips: [] },
    transport: [],
    money: { atm: "", exchange: "", tips: [] },
    links: [],
  };
}

function buildCategoryPayload(input: {
  category: GuideCategory;
  place: string;
  bundle: TravelGuidesBundle;
  query?: string;
  rate?: {
    base: string;
    rateToInr: number;
    lastUpdatedIso: string;
    source: "live" | "fallback";
  };
}): { summary: string; data: Record<string, unknown>; sources: string[] } {
  const { category, place, bundle, query, rate } = input;
  const catalog = findCatalogMatch(place);
  const topicMap = topicKnowledgeBySlug();
  const topic = catalog ? topicMap.get(catalog.slug) : undefined;
  const intel = resolveDestination(place);
  const language = detectTripLanguage(place);
  const focus = query?.trim().toLowerCase() ?? "";

  const sources = new Set<string>(["travel_guides"]);
  if (catalog) sources.add("destination_catalog");
  if (topic) sources.add("destination_knowledge");

  switch (category) {
    case "restaurants": {
      const videos = toVideoItems(bundle.food);
      const filtered = focus
        ? videos.filter((v) => v.title.toLowerCase().includes(focus))
        : videos;
      const foodHighlights = catalog?.foodHighlights ?? [];
      const knowledgeFood = topic?.food ?? "";
      const parts: string[] = [];
      if (foodHighlights.length) {
        parts.push(`Food highlights for ${place}: ${foodHighlights.join("; ")}.`);
      }
      if (knowledgeFood) parts.push(knowledgeFood);
      if (filtered.length) {
        parts.push(
          `Guide food videos (${filtered.length}): ${filtered
            .slice(0, 8)
            .map((v) => v.title)
            .join("; ")}.`,
        );
      }
      if (!parts.length) {
        parts.push(`No curated restaurant/food guide content found yet for ${place}.`);
      }
      return {
        summary: parts.join(" "),
        data: {
          videos: filtered,
          foodHighlights,
          knowledge: knowledgeFood || null,
        },
        sources: [...sources],
      };
    }
    case "places": {
      const videos = toVideoItems(bundle.places);
      const filtered = focus
        ? videos.filter((v) => v.title.toLowerCase().includes(focus))
        : videos;
      const attractions = catalog?.topAttractions ?? [];
      const parts: string[] = [];
      if (attractions.length) {
        parts.push(`Top places in ${place}: ${attractions.join("; ")}.`);
      }
      if (catalog?.overview) parts.push(catalog.overview);
      if (filtered.length) {
        parts.push(
          `Guide place videos (${filtered.length}): ${filtered
            .slice(0, 8)
            .map((v) => v.title)
            .join("; ")}.`,
        );
      }
      if (!parts.length) {
        parts.push(`No curated places guide content found yet for ${place}.`);
      }
      return {
        summary: parts.join(" "),
        data: {
          videos: filtered,
          topAttractions: attractions,
          overview: catalog?.overview ?? null,
          links: bundle.links as GuideLinkItem[],
        },
        sources: [...sources],
      };
    }
    case "emergency": {
      sources.delete("travel_guides");
      sources.add("emergency_lines");
      const lines = getEmergencyLines(language);
      const safetyNotes = catalog?.safetyNotes ?? "";
      if (safetyNotes) sources.add("destination_catalog");
      if (topic?.solo) sources.add("destination_knowledge");
      const parts = [
        `Emergency & safety for ${place} (language key: ${language}):`,
        ...lines.map((l) => `• ${l}`),
      ];
      if (safetyNotes) parts.push(`Safety notes: ${safetyNotes}`);
      if (topic?.solo) parts.push(`Solo/safety context: ${topic.solo}`);
      return {
        summary: parts.join("\n"),
        data: {
          language,
          lines,
          safetyNotes: safetyNotes || null,
          soloContext: topic?.solo ?? null,
          disclaimer:
            "Numbers vary by country — verify with your hotel or official tourism site.",
        },
        sources: [...sources],
      };
    }
    case "transport": {
      const tips = Array.isArray(bundle.transport) ? bundle.transport : [];
      const catalogNotes = catalog?.transportNotes ?? "";
      const knowledgeTransport = topic?.transport ?? "";
      const parts: string[] = [];
      if (tips.length) parts.push(`Transport tips: ${tips.join(" ")}`);
      if (catalogNotes) parts.push(catalogNotes);
      if (knowledgeTransport) parts.push(knowledgeTransport);
      if (!parts.length) {
        parts.push(`No curated transport guide content found yet for ${place}.`);
      }
      return {
        summary: parts.join(" "),
        data: {
          tips,
          catalogNotes: catalogNotes || null,
          knowledge: knowledgeTransport || null,
        },
        sources: [...sources],
      };
    }
    case "shopping": {
      const fashion = bundle.essentials?.fashion?.trim() ?? "";
      const moneyTips = Array.isArray(bundle.money?.tips) ? bundle.money.tips : [];
      const packingTips = catalog?.packingTips ?? [];
      const shoppingAttractions = (catalog?.topAttractions ?? []).filter((a) =>
        SHOPPING_ATTRACTION_RE.test(a),
      );
      const marketMoneyTips = moneyTips.filter((t) =>
        /market|cash|shop|mall|vendor|bargain|card/i.test(t),
      );
      const parts: string[] = [];
      if (shoppingAttractions.length) {
        parts.push(`Shopping-related spots: ${shoppingAttractions.join("; ")}.`);
      }
      if (fashion) parts.push(`What to wear / buy vibe: ${fashion}`);
      if (packingTips.length) parts.push(`Packing/shopping prep: ${packingTips.join("; ")}.`);
      if (marketMoneyTips.length) {
        parts.push(`Market & spend tips: ${marketMoneyTips.join(" ")}`);
      } else if (moneyTips.length) {
        parts.push(`Money tips useful while shopping: ${moneyTips.join(" ")}`);
      }
      if (!parts.length) {
        parts.push(
          `No dedicated shopping guide found for ${place}. Use local markets and malls; carry small cash for stalls.`,
        );
      }
      return {
        summary: parts.join(" "),
        data: {
          fashion: fashion || null,
          packingTips,
          shoppingAttractions,
          moneyTips: marketMoneyTips.length ? marketMoneyTips : moneyTips,
          currencyNote: bundle.essentials?.currency ?? null,
        },
        sources: [...sources],
      };
    }
    case "weather": {
      const weather = bundle.essentials?.weather?.trim() ?? "";
      const catalogWeather = catalog?.weatherSummary ?? "";
      const bestMonths = catalog?.bestMonths ?? [];
      const parts: string[] = [];
      if (weather) parts.push(weather);
      if (catalogWeather && catalogWeather !== weather) parts.push(catalogWeather);
      if (bestMonths.length) parts.push(`Best months: ${bestMonths.join(", ")}.`);
      if (!parts.length) {
        parts.push(`No curated weather guide found yet for ${place}. Check a local forecast before travel days.`);
      }
      return {
        summary: parts.join(" "),
        data: {
          weather: weather || catalogWeather || null,
          catalogWeather: catalogWeather || null,
          bestMonths,
          tips: bundle.essentials?.tips ?? [],
        },
        sources: [...sources],
      };
    }
    case "currency": {
      sources.add("forex");
      const currencyNote = bundle.essentials?.currency?.trim() ?? "";
      const money = {
        atm: bundle.money?.atm ?? "",
        exchange: bundle.money?.exchange ?? "",
        tips: Array.isArray(bundle.money?.tips) ? bundle.money.tips : [],
      };
      const code = rate?.base || currencyForPlace(place) || intel.currency || "USD";
      const parts: string[] = [];
      parts.push(`Local currency for ${place}: ${code}.`);
      if (currencyNote) parts.push(currencyNote);
      if (money.atm) parts.push(`ATMs: ${money.atm}`);
      if (money.exchange) parts.push(`Exchange: ${money.exchange}`);
      if (money.tips.length) parts.push(`Tips: ${money.tips.join(" ")}`);
      if (rate) {
        parts.push(
          `Approx. 1 ${rate.base} ≈ ${rate.rateToInr} INR (${rate.source}, updated ${rate.lastUpdatedIso}).`,
        );
      }
      return {
        summary: parts.join(" "),
        data: {
          currencyCode: code,
          currencyNote: currencyNote || null,
          money,
          rate: rate ?? null,
          language: bundle.essentials?.language || intel.language,
        },
        sources: [...sources],
      };
    }
    default: {
      return {
        summary: `Unknown guide category.`,
        data: {},
        sources: [],
      };
    }
  }
}

/**
 * Query curated Guide / Explore data (restaurants, places, emergency, transport,
 * shopping, weather, currency) for a destination or authorized trip.
 */
export const queryGuideTool: ToolDefinition<QueryGuideInput, QueryGuideOutput> = {
  name: "query_guide",
  description:
    "Look up Travel Till 99 Guide/Explore data for a destination: restaurants (food videos & highlights), places (sightseeing videos & attractions), emergency numbers, transport tips, shopping/fashion & markets, weather, or currency/ATM/exchange (with optional live FX vs INR). Prefer this over inventing local logistics. Provide place and/or tripId.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["category"],
    properties: {
      category: {
        type: "string",
        description: "Guide category to retrieve",
        enum: [...GUIDE_CATEGORIES],
      },
      place: {
        type: "string",
        description: "Destination or place name (e.g. Goa, Tokyo, Bangkok)",
        minLength: 1,
      },
      tripId: {
        type: "string",
        description: "Optional trip UUID; when set, destination is loaded from the trip (requires auth)",
        minLength: 1,
      },
      query: {
        type: "string",
        description: "Optional focus filter (e.g. vegetarian, night market, monsoon)",
      },
      currencyCode: {
        type: "string",
        description:
          "Optional ISO 4217 code for live FX vs INR (currency category). Defaults from destination.",
        minLength: 3,
        maxLength: 3,
      },
    },
  },
  async handler(input, ctx): Promise<ToolResult<QueryGuideOutput>> {
    const tripId = (input.tripId || ctx.tripId || "").trim();
    let place = input.place?.trim() ?? "";

    if (tripId) {
      const resolved = await resolvePlaceFromTrip(tripId, ctx);
      if (!resolved.ok) {
        return { ok: false, error: resolved.error, code: resolved.code };
      }
      // Explicit place wins; otherwise use the trip destination.
      if (!place) place = resolved.place;
    }

    if (!place) {
      return {
        ok: false,
        error: "Provide place or tripId so guide data can be resolved",
        code: "INVALID_INPUT",
      };
    }

    const intel = resolveDestination(place);
    const language = detectTripLanguage(place);
    const inferredCurrency = (
      input.currencyCode?.trim() ||
      currencyForPlace(place) ||
      intel.currency ||
      "USD"
    ).toUpperCase();

    let bundle: TravelGuidesBundle;
    try {
      bundle = (await getTravelGuidesForPlaceScalable(place)) ?? emptyBundle();
    } catch {
      bundle = emptyBundle();
    }

    let rate:
      | {
          base: string;
          rateToInr: number;
          lastUpdatedIso: string;
          source: "live" | "fallback";
        }
      | undefined;

    if (input.category === "currency") {
      rate = await fetchRateToInr(inferredCurrency, ctx.signal);
    }

    const payload = buildCategoryPayload({
      category: input.category,
      place,
      bundle,
      query: input.query,
      rate,
    });

    return {
      ok: true,
      data: {
        category: input.category,
        place,
        country: intel.country,
        language,
        currencyCode: inferredCurrency,
        summary: payload.summary,
        data: payload.data,
        sources: payload.sources,
      },
    };
  },
};
