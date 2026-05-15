import {
  PUBLIC_TRIP_SHARE_SCHEMA_VERSION,
  type PublicTripShareSnapshot,
  type TripShareRpcResult,
} from "@/lib/trip-share/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function parseItineraryPreview(
  value: unknown,
): PublicTripShareSnapshot["itineraryPreview"] {
  if (!Array.isArray(value)) return [];
  const out: PublicTripShareSnapshot["itineraryPreview"] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const dayNumber = Number(item.dayNumber);
    const title = asString(item.title);
    const summary = asString(item.summary) ?? title;
    if (!Number.isFinite(dayNumber) || dayNumber < 1 || !summary) continue;
    out.push({
      dayNumber,
      title: title ?? `Day ${dayNumber}`,
      summary,
    });
  }
  return out;
}

export function parsePublicTripShareSnapshot(
  value: unknown,
): PublicTripShareSnapshot | null {
  if (!isRecord(value)) return null;
  if (value.schemaVersion !== PUBLIC_TRIP_SHARE_SCHEMA_VERSION) return null;

  const dest = value.destination;
  if (!isRecord(dest)) return null;
  const name = asString(dest.name);
  const canonicalLocation = asString(dest.canonicalLocation);
  if (!name || !canonicalLocation) return null;

  const durationDays = Number(value.durationDays);
  if (!Number.isFinite(durationDays) || durationDays < 1) return null;

  const whyItFits = Array.isArray(value.whyItFits)
    ? value.whyItFits.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    : [];
  const budgetEstimate = asString(value.budgetEstimate);
  const travelEffort = asString(value.travelEffort);
  const sharedAt = asString(value.sharedAt);
  if (!budgetEstimate || !travelEffort || !sharedAt || whyItFits.length === 0) {
    return null;
  }

  return {
    schemaVersion: PUBLIC_TRIP_SHARE_SCHEMA_VERSION,
    destination: {
      name,
      canonicalLocation,
      ...(asString(dest.country) ? { country: asString(dest.country) } : {}),
    },
    durationDays,
    whyItFits,
    budgetEstimate,
    travelEffort,
    itineraryPreview: parseItineraryPreview(value.itineraryPreview),
    ...(asString(value.heroImageUrl) ? { heroImageUrl: asString(value.heroImageUrl) } : {}),
    ...(asString(value.heroImageAbsolute)
      ? { heroImageAbsolute: asString(value.heroImageAbsolute) }
      : {}),
    sharedAt,
    brand: "TravelTill99",
  };
}

export function parseTripShareRpcResult(data: unknown): TripShareRpcResult {
  if (!isRecord(data) || data.found !== true) return { found: false };
  const snapshot = parsePublicTripShareSnapshot(data.snapshot);
  if (!snapshot) return { found: false };
  return { found: true, snapshot };
}
