import {
  MASTER_TRIP_FILE_SCHEMA_VERSION,
  type MasterTripFile,
} from "./types";

export function parseMasterTripFile(raw: unknown): MasterTripFile | null {
  if (!raw || typeof raw !== "object") return null;
  const doc = raw as Record<string, unknown>;
  if (doc.schemaVersion !== MASTER_TRIP_FILE_SCHEMA_VERSION) return null;
  if (!doc.preferences || !doc.destination || !doc.recommendation) return null;

  return raw as MasterTripFile;
}

export function emptyMasterTripFileFallback(): MasterTripFile {
  const now = new Date().toISOString();
  return {
    schemaVersion: MASTER_TRIP_FILE_SCHEMA_VERSION,
    preferences: { days: 3, priorities: ["scenic"] },
    destination: {
      name: "Unknown",
      slug: null,
      canonicalLocation: "Unknown",
    },
    recommendation: {
      mode: "recommendation",
      whyItFits: [],
      explanation: "",
      travelEffort: "",
      budgetEstimate: "",
      alternatives: [],
    },
    itinerary: [],
    practical: { travelEffort: "", budgetEstimate: "" },
    refinementHistory: [],
    edits: [],
    metadata: { createdAt: now, updatedAt: now, source: "manual" },
  };
}
