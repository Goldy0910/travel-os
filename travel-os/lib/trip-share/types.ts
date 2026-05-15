export const PUBLIC_TRIP_SHARE_SCHEMA_VERSION = 1 as const;

export type PublicItineraryPreviewDay = {
  dayNumber: number;
  title: string;
  summary: string;
};

export type PublicTripShareSnapshot = {
  schemaVersion: typeof PUBLIC_TRIP_SHARE_SCHEMA_VERSION;
  destination: {
    name: string;
    canonicalLocation: string;
    country?: string;
  };
  durationDays: number;
  whyItFits: string[];
  budgetEstimate: string;
  travelEffort: string;
  itineraryPreview: PublicItineraryPreviewDay[];
  heroImageUrl?: string;
  /** Absolute URL for Open Graph / WhatsApp crawlers */
  heroImageAbsolute?: string;
  sharedAt: string;
  brand: "TravelTill99";
};

export type TripShareRpcResult =
  | { found: false }
  | { found: true; snapshot: PublicTripShareSnapshot };
