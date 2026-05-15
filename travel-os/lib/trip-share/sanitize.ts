import type { MasterTripFile } from "@/lib/master-trip-file/types";
import {
  PUBLIC_TRIP_SHARE_SCHEMA_VERSION,
  type PublicTripShareSnapshot,
} from "@/lib/trip-share/types";

const EMAIL_LIKE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const PHONE_LIKE = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;

function scrubText(value: string): string {
  return value
    .replace(EMAIL_LIKE, "")
    .replace(PHONE_LIKE, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function scrubLines(lines: string[], max: number): string[] {
  return lines
    .map(scrubText)
    .filter((line) => line.length > 0)
    .slice(0, max);
}

const MAX_WHY = 6;
const MAX_ITINERARY_DAYS = 7;

export function buildPublicTripShareSnapshot(
  file: MasterTripFile,
  options?: {
    heroImageUrl?: string;
    heroImageAbsolute?: string;
    sharedAt?: string;
  },
): PublicTripShareSnapshot {
  const sharedAt = options?.sharedAt ?? new Date().toISOString();

  const itineraryPreview = file.itinerary.slice(0, MAX_ITINERARY_DAYS).map((day) => ({
    dayNumber: day.dayNumber,
    title: scrubText(day.title),
    summary: scrubText(day.summary || day.title),
  }));

  const snapshot: PublicTripShareSnapshot = {
    schemaVersion: PUBLIC_TRIP_SHARE_SCHEMA_VERSION,
    destination: {
      name: scrubText(file.destination.name),
      canonicalLocation: scrubText(file.destination.canonicalLocation),
      ...(file.destination.country
        ? { country: scrubText(file.destination.country) }
        : {}),
    },
    durationDays: Math.max(1, file.preferences.days),
    whyItFits: scrubLines(file.recommendation.whyItFits, MAX_WHY),
    budgetEstimate: scrubText(file.practical.budgetEstimate),
    travelEffort: scrubText(file.practical.travelEffort),
    itineraryPreview,
    sharedAt,
    brand: "TravelTill99",
  };

  if (options?.heroImageUrl) {
    snapshot.heroImageUrl = options.heroImageUrl;
  }
  if (options?.heroImageAbsolute) {
    snapshot.heroImageAbsolute = options.heroImageAbsolute;
  }

  return snapshot;
}
