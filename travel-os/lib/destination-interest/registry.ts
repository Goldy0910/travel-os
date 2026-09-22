import { DESTINATION_CATALOG } from "@/lib/find-destination/catalog";
import { TRAVEL_PLACES_FALLBACK } from "@/app/app/create-trip/travel-places-fallback";
import type { ResolvedDestination } from "@/lib/destination-interest/types";

type RegistryEntry = {
  id: string;
  name: string;
  aliases: string[];
  source: ResolvedDestination["source"];
};

/** Curated travel_places labels (migrations + fallback). Not POIs. */
const TRAVEL_PLACE_DESTINATIONS: Array<{ slug: string; name: string; aliases?: string[] }> = [
  { slug: "dubai-uae", name: "Dubai", aliases: ["uae", "united arab emirates"] },
  { slug: "thailand", name: "Thailand" },
  { slug: "singapore", name: "Singapore" },
  { slug: "maldives", name: "Maldives" },
  { slug: "malaysia", name: "Malaysia" },
  { slug: "sri-lanka", name: "Sri Lanka" },
  { slug: "indonesia", name: "Indonesia" },
  { slug: "nepal", name: "Nepal" },
  { slug: "vietnam", name: "Vietnam" },
  { slug: "turkey", name: "Turkey" },
  { slug: "switzerland", name: "Switzerland" },
  { slug: "france", name: "France" },
  { slug: "italy", name: "Italy" },
  { slug: "united-kingdom", name: "United Kingdom", aliases: ["uk", "britain", "england"] },
  { slug: "australia", name: "Australia" },
  { slug: "japan", name: "Japan" },
  { slug: "united-states", name: "USA", aliases: ["united states", "america", "us"] },
  { slug: "canada", name: "Canada" },
  { slug: "new-zealand", name: "New Zealand" },
  { slug: "greece", name: "Greece" },
  { slug: "goa-india", name: "Goa" },
  { slug: "manali-india", name: "Manali" },
  { slug: "rajasthan-india", name: "Rajasthan" },
  { slug: "ladakh-india", name: "Ladakh", aliases: ["leh", "leh ladakh", "leh-ladakh"] },
  { slug: "kerala-india", name: "Kerala", aliases: ["kerala backwaters"] },
  { slug: "rishikesh-india", name: "Rishikesh" },
  { slug: "andaman-islands-india", name: "Andaman Islands", aliases: ["andaman", "andamans"] },
  { slug: "shimla-india", name: "Shimla" },
  { slug: "coorg-india", name: "Coorg", aliases: ["kodagu"] },
  { slug: "munnar-india", name: "Munnar" },
  { slug: "wayanad-india", name: "Wayanad" },
  { slug: "varanasi-india", name: "Varanasi" },
  { slug: "spiti-valley-india", name: "Spiti Valley", aliases: ["spiti"] },
  { slug: "hampi-india", name: "Hampi" },
  { slug: "mussoorie-india", name: "Mussoorie" },
  { slug: "pondicherry-india", name: "Pondicherry", aliases: ["puducherry"] },
  { slug: "meghalaya-india", name: "Meghalaya" },
  { slug: "ooty-india", name: "Ooty" },
  { slug: "agra-india", name: "Agra" },
  { slug: "mumbai-india", name: "Mumbai", aliases: ["bombay"] },
  { slug: "darjeeling-india", name: "Darjeeling" },
  { slug: "lakshadweep-india", name: "Lakshadweep" },
  { slug: "hyderabad-india", name: "Hyderabad" },
  { slug: "jaipur-india", name: "Jaipur" },
  { slug: "udaipur-india", name: "Udaipur" },
  { slug: "bali-indonesia", name: "Bali" },
  { slug: "bangkok-thailand", name: "Bangkok" },
  { slug: "paris-france", name: "Paris" },
  { slug: "tokyo-japan", name: "Tokyo" },
];

export function normalizeDestinationKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function slugifyDestination(value: string): string {
  return normalizeDestinationKey(value).replace(/\s+/g, "-").replace(/^-+|-+$/g, "");
}

function buildRegistry(): { byId: Map<string, RegistryEntry>; byAlias: Map<string, string> } {
  const byId = new Map<string, RegistryEntry>();
  const byAlias = new Map<string, string>();

  const upsert = (entry: RegistryEntry) => {
    const existing = byId.get(entry.id);
    if (existing) {
      const aliases = new Set([...existing.aliases, ...entry.aliases]);
      byId.set(entry.id, { ...existing, aliases: [...aliases] });
    } else {
      byId.set(entry.id, entry);
    }
    const keys = new Set([
      normalizeDestinationKey(entry.id.replace(/-/g, " ")),
      normalizeDestinationKey(entry.name),
      ...entry.aliases.map(normalizeDestinationKey),
    ]);
    for (const key of keys) {
      if (!key) continue;
      if (!byAlias.has(key)) byAlias.set(key, entry.id);
    }
  };

  for (const dest of DESTINATION_CATALOG) {
    upsert({
      id: dest.slug,
      name: dest.name,
      aliases: [dest.travelPlaceSlug ?? "", dest.slug.replace(/-/g, " ")].filter(Boolean),
      source: "catalog",
    });
  }

  for (const place of [...TRAVEL_PLACE_DESTINATIONS, ...TRAVEL_PLACES_FALLBACK.map((p) => ({
    slug: p.slug,
    name: p.primary_label,
    aliases: [p.canonical_location, p.subtitle ?? ""],
  }))]) {
    const catalogId =
      byAlias.get(normalizeDestinationKey(place.name)) ??
      byAlias.get(normalizeDestinationKey(place.slug.replace(/-/g, " ")));
    if (catalogId && catalogId !== place.slug) {
      const catalog = byId.get(catalogId);
      if (catalog) {
        upsert({
          ...catalog,
          aliases: [...catalog.aliases, place.slug, place.name, ...(place.aliases ?? [])],
        });
        byAlias.set(normalizeDestinationKey(place.slug.replace(/-/g, " ")), catalogId);
        continue;
      }
    }
    upsert({
      id: place.slug,
      name: place.name,
      aliases: place.aliases ?? [],
      source: "travel_place",
    });
  }

  return { byId, byAlias };
}

const REGISTRY = buildRegistry();

export function getRegisteredDestination(id: string): ResolvedDestination | null {
  const row = REGISTRY.byId.get(id.trim().toLowerCase());
  if (!row) return null;
  return { id: row.id, name: row.name, source: row.source };
}

export function isRegisteredDestinationId(id: string): boolean {
  return REGISTRY.byId.has(id.trim().toLowerCase());
}

export function resolveRegisteredDestination(nameOrSlug: string): ResolvedDestination | null {
  const raw = nameOrSlug.trim();
  if (!raw) return null;
  const asId = raw.toLowerCase();
  const direct = REGISTRY.byId.get(asId);
  if (direct) return { id: direct.id, name: direct.name, source: direct.source };

  const key = normalizeDestinationKey(raw);
  if (!key) return null;
  const aliased = REGISTRY.byAlias.get(key);
  if (!aliased) return null;
  const row = REGISTRY.byId.get(aliased);
  return row ? { id: row.id, name: row.name, source: row.source } : null;
}

export function listRegisteredDestinationIds(): string[] {
  return [...REGISTRY.byId.keys()];
}
