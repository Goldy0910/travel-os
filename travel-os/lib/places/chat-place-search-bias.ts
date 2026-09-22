import { detectRegisteredDestinationsInText } from "@/lib/destination-interest/from-chat";
import { resolveTopLevelDestination } from "@/lib/destination-interest/resolve";

export type ChatPlaceSearchEntity = {
  name: string;
  type?: string | null;
};

export type ChatPlaceSearchBiasInput = {
  replyText: string;
  userMessage?: string | null;
  entities: ChatPlaceSearchEntity[];
  tripDestination?: string | null;
  preferredDestination?: string | null;
  candidateDestinations?: string[] | null;
  userCity?: string | null;
};

export type ChatPlaceSearchBias = {
  /** Destinations this turn is actually about (e.g. Munnar, Coorg, Wayanad). */
  replyDestinations: string[];
  /**
   * Suffix for Google text search when a venue isn't tied to one city.
   * Never the user's home city while other destinations are being discussed.
   */
  defaultBias: string | null;
  /** Drop cards whose address/name is this city when it isn't a discussed destination. */
  rejectAddressCity: string | null;
};

function norm(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function uniqueNames(names: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of names) {
    const name = raw?.trim() ?? "";
    if (name.length < 2) continue;
    const key = norm(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

function samePlace(a: string, b: string): boolean {
  const left = norm(a);
  const right = norm(b);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

function collectReplyDestinations(
  text: string,
  entities: ChatPlaceSearchEntity[],
): string[] {
  const fromText = detectRegisteredDestinationsInText(text).map((d) => d.name);
  const fromEntities = entities.flatMap((entity) => {
    const name = entity.name?.trim() ?? "";
    if (!name) return [];
    const type = (entity.type || "").trim().toLowerCase();
    const resolved = resolveTopLevelDestination({
      name,
      type: type === "city" || type === "country" || type === "region" ? type : entity.type,
    });
    if (resolved) return [resolved.name];
    // City-tagged names that aren't in the registry yet (e.g. a new hill station).
    if (type === "city" || type === "country" || type === "region") return [name];
    return [];
  });
  return uniqueNames([...fromText, ...fromEntities]);
}

function firstNonHome(
  candidates: Array<string | null | undefined>,
  userCity: string | null,
): string | null {
  for (const raw of candidates) {
    const name = raw?.trim() ?? "";
    if (!name) continue;
    if (userCity && samePlace(name, userCity)) continue;
    return name;
  }
  return null;
}

/**
 * Decide where Google place search should be grounded.
 *
 * User location is only a last resort for true "near me" answers.
 * A reply about Munnar / Coorg / Wayanad must never be searched as "…, Hyderabad".
 */
export function resolveChatPlaceSearchBias(
  input: ChatPlaceSearchBiasInput,
): ChatPlaceSearchBias {
  const userCity = input.userCity?.trim() || null;
  const contextText = [input.userMessage, input.replyText].filter(Boolean).join("\n");
  const replyDestinations = collectReplyDestinations(contextText, input.entities);
  const awayFromHome = userCity
    ? replyDestinations.filter((name) => !samePlace(name, userCity))
    : replyDestinations;

  let defaultBias: string | null = null;
  if (awayFromHome.length === 1) {
    defaultBias = awayFromHome[0] ?? null;
  } else if (awayFromHome.length > 1) {
    defaultBias = null;
  } else {
    defaultBias = firstNonHome(
      [
        input.tripDestination,
        input.preferredDestination,
        ...(input.candidateDestinations ?? []),
      ],
      userCity,
    );
    if (!defaultBias && awayFromHome.length === 0) {
      defaultBias = userCity;
    }
  }

  const groundedAwayFromHome = Boolean(
    awayFromHome.length > 0 || (defaultBias && userCity && !samePlace(defaultBias, userCity)),
  );
  const rejectAddressCity = userCity && groundedAwayFromHome ? userCity : null;

  return { replyDestinations, defaultBias, rejectAddressCity };
}

function destinationNearMention(
  text: string,
  placeName: string,
  destinations: string[],
): string | null {
  if (destinations.length === 0) return null;
  if (destinations.length === 1) return destinations[0] ?? null;

  const hay = text.toLowerCase();
  const needle = placeName.trim().toLowerCase();
  if (!needle) return null;
  const idx = hay.indexOf(needle);
  if (idx < 0) return null;

  const windowStart = Math.max(0, idx - 320);
  const window = hay.slice(windowStart, idx);
  let best: { name: string; pos: number } | null = null;
  for (const dest of destinations) {
    const pos = window.lastIndexOf(dest.toLowerCase());
    if (pos < 0) continue;
    if (!best || pos > best.pos) best = { name: dest, pos };
  }
  return best?.name ?? null;
}

/** Google text query for one entity — destination-aware, never "Place, HomeCity" on a trip rec. */
export function searchQueryForPlace(
  placeName: string,
  bias: ChatPlaceSearchBias,
  replyText: string,
): string {
  const name = placeName.trim();
  if (!name) return "";

  const destsForVenues = bias.rejectAddressCity
    ? bias.replyDestinations.filter((dest) => !samePlace(dest, bias.rejectAddressCity!))
    : bias.replyDestinations;

  const selfDest = destsForVenues.find((dest) => samePlace(name, dest));
  if (selfDest) return selfDest;

  const localBias =
    destinationNearMention(replyText, name, destsForVenues) ?? bias.defaultBias;
  if (!localBias) return name;
  if (samePlace(name, localBias)) return name;
  if (norm(name).includes(norm(localBias))) return name;
  return `${name}, ${localBias}`;
}

const CITY_WORD = (city: string) =>
  new RegExp(`\\b${city.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");

/** True when Google resolved a discussed destination to a venue in the user's home city. */
export function placeCardLooksLikeUserHomeLeak(
  card: { name: string; address: string },
  bias: ChatPlaceSearchBias,
): boolean {
  const city = bias.rejectAddressCity?.trim();
  if (!city) return false;
  const re = CITY_WORD(city);
  return re.test(card.address) || re.test(card.name);
}
