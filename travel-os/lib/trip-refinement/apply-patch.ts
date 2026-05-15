import {
  addRefinementEntry,
  touchMasterTripFile,
} from "@/lib/master-trip-file/build";
import type { MasterItineraryDay, MasterTripFile, MasterTripPreferences } from "@/lib/master-trip-file/types";
import type { TripPriority } from "@/lib/homepage-decision/types";
import { mergePriorities, reindexItineraryDays } from "./continuity";
import type { ApplyPatchResult, ItineraryPatchOp, TripRefinementPatch } from "./types";

function newId(): string {
  return crypto.randomUUID();
}

function applyItineraryOps(
  days: MasterItineraryDay[],
  ops: ItineraryPatchOp[],
): MasterItineraryDay[] {
  let next = days.slice();

  for (const op of ops) {
    if (op.op === "update") {
      next = next.map((d) =>
        d.id === op.dayId
          ? {
              ...d,
              ...(op.summary !== undefined ? { summary: op.summary } : {}),
              ...(op.title !== undefined ? { title: op.title } : {}),
            }
          : d,
      );
    } else if (op.op === "remove") {
      next = next.filter((d) => d.id !== op.dayId);
    } else if (op.op === "add") {
      const exists = next.some((d) => d.dayNumber === op.dayNumber);
      if (!exists) {
        next.push({
          id: newId(),
          dayNumber: op.dayNumber,
          title: op.title ?? `Day ${op.dayNumber}`,
          summary: op.summary,
        });
      }
    } else if (op.op === "truncate") {
      next = reindexItineraryDays(
        next.filter((d) => d.dayNumber <= op.maxDays).slice(0, op.maxDays),
      );
    } else if (op.op === "replace_summaries") {
      const byDay = new Map(op.days.map((d) => [d.dayNumber, d.summary]));
      next = next.map((d) =>
        byDay.has(d.dayNumber) ? { ...d, summary: byDay.get(d.dayNumber)! } : d,
      );
    }
  }

  return reindexItineraryDays(next);
}

/**
 * Applies a partial patch — never replaces the full MasterTripFile.
 * Preserves destination, metadata.createdAt, and stable itinerary day ids where possible.
 */
export function applyRefinementPatch(
  file: MasterTripFile,
  patch: TripRefinementPatch,
  userMessage: string,
): ApplyPatchResult {
  let next: MasterTripFile = { ...file };
  const changed = new Set(patch.affectedSections);

  if (patch.preferences) {
    const mergedPrefs: MasterTripPreferences = {
      ...file.preferences,
      ...patch.preferences,
      priorities: patch.preferences.priorities
        ? mergePriorities(
            file.preferences.priorities,
            patch.preferences.priorities as TripPriority[],
          )
        : file.preferences.priorities,
    };
    if (patch.itineraryOps?.some((o) => o.op === "truncate")) {
      const truncate = patch.itineraryOps.find((o) => o.op === "truncate");
      if (truncate && truncate.op === "truncate") {
        mergedPrefs.days = truncate.maxDays;
      }
    }
    next = { ...next, preferences: mergedPrefs };
  }

  if (patch.itineraryOps?.length) {
    next = {
      ...next,
      itinerary: applyItineraryOps(file.itinerary, patch.itineraryOps),
    };
    if (!patch.preferences?.days) {
      next = {
        ...next,
        preferences: { ...next.preferences, days: next.itinerary.length },
      };
    }
    changed.add("itinerary");
  }

  if (patch.practical) {
    next = {
      ...next,
      practical: { ...file.practical, ...patch.practical },
    };
  }

  if (patch.whyItFits?.length) {
    next = {
      ...next,
      recommendation: {
        ...file.recommendation,
        whyItFits: patch.whyItFits,
        explanation: patch.recommendationNote ?? file.recommendation.explanation,
      },
    };
  } else if (patch.recommendationNote) {
    next = {
      ...next,
      recommendation: {
        ...file.recommendation,
        explanation: patch.recommendationNote,
      },
    };
  }

  next = touchMasterTripFile(next, {
    section: "itinerary",
    summary: `Refinement: ${userMessage.slice(0, 80)}`,
  });

  next = addRefinementEntry(next, userMessage.slice(0, 200), next.preferences);

  return {
    file: next,
    patch,
    changedSections: [...changed],
  };
}
