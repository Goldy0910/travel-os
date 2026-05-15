import { DESTINATION_SEED } from "../data/destinations.seed";
import { DEFAULT_ORIGIN_SLUG, ORIGIN_CITIES } from "../data/origin-cities.seed";
import type { DestinationMetadata } from "../models/destination";

function normalize(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s,-]/gu, " ")
    .replace(/\s+/g, " ");
}

export function findDestinationByInput(input: string): DestinationMetadata | null {
  const n = normalize(input);
  if (!n) return null;
  for (const dest of DESTINATION_SEED) {
    if (
      normalize(dest.name) === n ||
      normalize(dest.canonicalLocation).includes(n) ||
      dest.slug.replace(/-/g, " ").includes(n) ||
      dest.aliases.some((a) => n.includes(normalize(a)) || normalize(a).includes(n))
    ) {
      return dest;
    }
  }
  return null;
}

export function findOriginCitySlug(input?: string): string {
  if (!input?.trim()) return DEFAULT_ORIGIN_SLUG;
  const n = normalize(input);
  for (const city of ORIGIN_CITIES) {
    if (normalize(city.name) === n || city.slug === n) return city.slug;
    if (city.aliases.some((a) => n.includes(normalize(a)))) return city.slug;
  }
  return DEFAULT_ORIGIN_SLUG;
}

export function getDestinationBySlug(slug: string): DestinationMetadata | null {
  return DESTINATION_SEED.find((d) => d.slug === slug) ?? null;
}

export function listAllDestinations(): DestinationMetadata[] {
  return [...DESTINATION_SEED];
}
