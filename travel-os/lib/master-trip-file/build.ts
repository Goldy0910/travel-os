import type { HomepageDecisionResponse } from "@/lib/homepage-decision/types";
import {
  MASTER_TRIP_FILE_SCHEMA_VERSION,
  type EditHistoryEntry,
  type MasterItineraryDay,
  type MasterTripFile,
  type MasterTripPreferences,
  type SaveMasterTripInput,
} from "./types";

function newId(): string {
  return crypto.randomUUID();
}

function parseItineraryLine(line: string, index: number): MasterItineraryDay {
  const dayMatch = /^Day\s*(\d+)\s*:\s*(.*)$/i.exec(line.trim());
  const dayNumber = dayMatch ? Number.parseInt(dayMatch[1], 10) : index + 1;
  const summary = dayMatch?.[2]?.trim() || line.trim();
  return {
    id: newId(),
    dayNumber,
    title: `Day ${dayNumber}`,
    summary,
  };
}

export function itineraryFromStrings(lines: string[]): MasterItineraryDay[] {
  return lines.filter(Boolean).map((line, i) => parseItineraryLine(line, i));
}

export function buildMasterTripFile(input: SaveMasterTripInput): MasterTripFile {
  const { decision, preferences } = input;
  const now = new Date().toISOString();

  const destination =
    decision.mode === "recommendation"
      ? {
          name: decision.destination,
          slug: decision.destinationSlug,
          canonicalLocation: decision.canonicalLocation,
        }
      : {
          name: decision.destination,
          slug: decision.destinationSlug,
          canonicalLocation: decision.destination,
        };

  const whyItFits =
    decision.mode === "recommendation"
      ? decision.whyItFits
      : [decision.summary, decision.timeFit].filter(Boolean);

  const itinerary =
    decision.mode === "recommendation"
      ? itineraryFromStrings(decision.itinerary)
      : itineraryFromStrings([
          `Day 1: Arrive in ${decision.destination}`,
          `Day 2: Explore highlights`,
          ...(preferences.days >= 3 ? [`Day 3: Local experiences`] : []),
        ]);

  const recommendation =
    decision.mode === "recommendation"
      ? {
          mode: "recommendation" as const,
          fitScore: undefined,
          whyItFits: decision.whyItFits,
          explanation: decision.whyItFits[0] ?? `Recommended for ${preferences.days} days.`,
          travelEffort: decision.travelEffort,
          budgetEstimate: decision.budgetEstimate,
          alternatives: decision.alternatives.map((a) => ({
            name: a.name,
            slug: a.slug,
            reason: a.reason,
          })),
        }
      : {
          mode: "validation" as const,
          fit: decision.fit,
          whyItFits,
          explanation: decision.summary,
          summary: decision.summary,
          travelEffort: decision.travelEffort,
          budgetEstimate: decision.budgetRealism,
          practicality: decision.practicality,
          timeFit: decision.timeFit,
          budgetRealism: decision.budgetRealism,
          alternatives: decision.alternatives.map((a) => ({
            name: a.name,
            slug: a.slug,
            reason: a.reason,
          })),
        };

  const practical =
    decision.mode === "recommendation"
      ? {
          travelEffort: decision.travelEffort,
          budgetEstimate: decision.budgetEstimate,
        }
      : {
          travelEffort: decision.travelEffort,
          budgetEstimate: decision.budgetRealism,
          timeFit: decision.timeFit,
          practicality: decision.practicality,
          budgetRealism: decision.budgetRealism,
        };

  return {
    schemaVersion: MASTER_TRIP_FILE_SCHEMA_VERSION,
    preferences,
    destination,
    recommendation,
    itinerary,
    practical,
    refinementHistory: [],
    edits: [],
    metadata: {
      createdAt: now,
      updatedAt: now,
      source: input.source ?? "homepage",
    },
  };
}

export function touchMasterTripFile(
  file: MasterTripFile,
  edit?: { section: EditHistoryEntry["section"]; summary: string },
): MasterTripFile {
  const now = new Date().toISOString();
  const edits = edit
    ? [
        ...file.edits,
        { id: newId(), at: now, section: edit.section, summary: edit.summary },
      ]
    : file.edits;
  return {
    ...file,
    edits: edits.slice(-50),
    metadata: { ...file.metadata, updatedAt: now },
  };
}

export function addRefinementEntry(
  file: MasterTripFile,
  note: string,
  preferences: MasterTripPreferences,
): MasterTripFile {
  const now = new Date().toISOString();
  return touchMasterTripFile({
    ...file,
    preferences,
    refinementHistory: [
      ...file.refinementHistory,
      { id: newId(), at: now, note, preferences: { ...preferences } },
    ].slice(-30),
  });
}

export function mergeDecisionIntoFile(
  file: MasterTripFile,
  decision: HomepageDecisionResponse,
): MasterTripFile {
  const rebuilt = buildMasterTripFile({
    decision,
    preferences: file.preferences,
    source: file.metadata.source,
  });
  return touchMasterTripFile(
    {
      ...file,
      destination: rebuilt.destination,
      recommendation: rebuilt.recommendation,
      itinerary: rebuilt.itinerary,
      practical: rebuilt.practical,
    },
    { section: "destination", summary: "Refined recommendation" },
  );
}
