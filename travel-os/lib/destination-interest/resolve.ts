import {
  ACTIVITY_NAME_HINT,
  POI_ENTITY_TYPES,
  POI_GOOGLE_TYPES,
  POI_NAME_HINT,
  TOP_LEVEL_ENTITY_TYPES,
  TOP_LEVEL_GOOGLE_TYPES,
} from "@/lib/destination-interest/constants";
import {
  isRegisteredDestinationId,
  resolveRegisteredDestination,
  slugifyDestination,
} from "@/lib/destination-interest/registry";
import type { ResolvedDestination } from "@/lib/destination-interest/types";

export type DestinationCandidate = {
  name: string;
  type?: string | null;
  googleTypes?: string[] | null;
};

function looksLikePoiName(name: string): boolean {
  return POI_NAME_HINT.test(name) || ACTIVITY_NAME_HINT.test(name);
}

export function isTopLevelGooglePlace(types: string[] | null | undefined): boolean {
  if (!types?.length) return false;
  const set = new Set(types.map((t) => t.trim().toLowerCase()).filter(Boolean));
  if ([...set].some((t) => POI_GOOGLE_TYPES.has(t))) return false;
  return [...set].some((t) => TOP_LEVEL_GOOGLE_TYPES.has(t));
}

export function isTopLevelEntityType(type: string | null | undefined): boolean {
  if (!type) return false;
  const t = type.trim().toLowerCase();
  if (POI_ENTITY_TYPES.has(t)) return false;
  return TOP_LEVEL_ENTITY_TYPES.has(t);
}

/**
 * Resolve a candidate to a canonical top-level destination id.
 * Attractions / hotels / restaurants / activities return null.
 */
export function resolveTopLevelDestination(
  candidate: DestinationCandidate,
): ResolvedDestination | null {
  const name = candidate.name?.trim() ?? "";
  if (name.length < 2 || name.length > 80) return null;

  const entityType = (candidate.type || "").trim().toLowerCase();
  if (entityType && POI_ENTITY_TYPES.has(entityType)) return null;

  const registered = resolveRegisteredDestination(name);
  if (registered) return registered;

  if (looksLikePoiName(name)) return null;

  if (isTopLevelGooglePlace(candidate.googleTypes) || isTopLevelEntityType(candidate.type)) {
    const id = slugifyDestination(name);
    if (!id) return null;
    return { id, name, source: "generated" };
  }

  return null;
}

export function resolveTopLevelDestinations(
  candidates: DestinationCandidate[],
): ResolvedDestination[] {
  const out: ResolvedDestination[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const resolved = resolveTopLevelDestination(candidate);
    if (!resolved || seen.has(resolved.id)) continue;
    seen.add(resolved.id);
    out.push(resolved);
  }
  return out;
}

export function resolveDestinationIdForTrack(destinationId: string): string | null {
  const id = destinationId.trim().toLowerCase();
  if (!id) return null;
  if (isRegisteredDestinationId(id)) return id;
  return resolveRegisteredDestination(id)?.id
    ?? resolveRegisteredDestination(id.replace(/-/g, " "))?.id
    ?? null;
}

/**
 * Registry ids plus generated city/country slugs that already passed the resolver.
 */
export function isAcceptableDestinationId(destinationId: string): boolean {
  const id = destinationId.trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,94}[a-z0-9])?$/.test(id) || id.length < 2) {
    return false;
  }
  if (resolveDestinationIdForTrack(id)) return true;
  return !looksLikePoiName(id.replace(/-/g, " "));
}
