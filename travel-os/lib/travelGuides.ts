/**
 * Curated YouTube travel guides by destination (beta / hardcoded).
 * Keys are lowercase place slugs matched against trip location text.
 */

export type TravelGuideVideo = {
  title: string;
  youtubeId: string;
};

export type TravelGuidesBundle = {
  places: TravelGuideVideo[];
  food: TravelGuideVideo[];
  tips: TravelGuideVideo[];
};

export const travelGuides: Record<string, TravelGuidesBundle> = {
  goa: {
    places: [
      {
        title: "Top Places to Visit in Goa",
        youtubeId: "jSTNtS76U14",
      },
      {
        title: "North Goa vs South Goa explained",
        youtubeId: "ysz5S6PUM-U",
      },
    ],
    food: [
      {
        title: "Must-try Goan food",
        youtubeId: "rfscVS0vtbw",
      },
      {
        title: "Best seafood spots in Goa",
        youtubeId: "n3D-TlXMD-g",
      },
    ],
    tips: [
      {
        title: "Goa travel tips for first-timers",
        youtubeId: "jNQXAC9IVRw",
      },
    ],
  },
  tokyo: {
    places: [
      { title: "Top 10 Places to Visit in Tokyo", youtubeId: "RiJhQkvlCok" },
      { title: "How to Spend 3 Days in Tokyo", youtubeId: "Z2PVlWgJnjo" },
    ],
    food: [
      { title: "TOKYO Food Guide | 40 Places to Eat & Drink (With Prices!)", youtubeId: "RY1CAaGslyc" },
      { title: "10 Foods YOU MUST Try in Japan: Food and Travel Guide", youtubeId: "CcZaE8pn8nc" },
    ],
    tips: [
      { title: "TOKYO TRAVEL TIPS FOR FIRST TIMERS | 30+ Must-Knows Before Visiting Tokyo + What NOT to Do!", youtubeId: "zpC-nr5PTGU" },
    ],
  },
  delhi: {
    places: [
      { title: "Old Delhi heritage walk", youtubeId: "rfscVS0vtbw" },
      { title: "Monuments you should not miss", youtubeId: "ysz5S6PUM-U" },
    ],
    food: [
      { title: "Chandni Chowk food trail", youtubeId: "jSTNtS76U14" },
    ],
    tips: [
      { title: "Delhi metro & getting around", youtubeId: "n3D-TlXMD-g" },
      { title: "Seasonal travel tips", youtubeId: "jNQXAC9IVRw" },
    ],
  },
};

const GUIDE_KEYS = Object.keys(travelGuides);

/** Normalize user-facing place string for lookup (lowercase, alnum only). */
export function normalizePlaceKey(place: string): string {
  return place.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Match trip.place / location against curated guide keys.
 * Tries compact slug, substring match, and first word of the place name.
 */
export function resolvePlaceGuideKey(place: string): string | null {
  const raw = place.trim().toLowerCase();
  if (!raw) return null;

  const compact = normalizePlaceKey(place);
  if (compact && travelGuides[compact]) return compact;

  for (const key of GUIDE_KEYS) {
    if (compact.includes(key) || raw.includes(key)) return key;
  }

  const firstToken = raw.split(/[\s,|/]+/).find((t) => t.length >= 3);
  if (firstToken) {
    const tokenKey = firstToken.replace(/[^a-z0-9]/g, "");
    if (tokenKey && travelGuides[tokenKey]) return tokenKey;
    for (const key of GUIDE_KEYS) {
      if (tokenKey.includes(key) || key.includes(tokenKey)) return key;
    }
  }

  return null;
}

export function getTravelGuidesForPlace(place: string): TravelGuidesBundle | null {
  const key = resolvePlaceGuideKey(place);
  if (!key) return null;
  return travelGuides[key] ?? null;
}

export function bundleHasVideos(bundle: TravelGuidesBundle): boolean {
  return (
    bundle.places.length > 0 ||
    bundle.food.length > 0 ||
    bundle.tips.length > 0
  );
}

export const GUIDE_CATEGORIES = [
  { id: "places" as const, label: "Places" },
  { id: "food" as const, label: "Food" },
  { id: "tips" as const, label: "Tips" },
];

export type GuideCategoryId = (typeof GUIDE_CATEGORIES)[number]["id"];
