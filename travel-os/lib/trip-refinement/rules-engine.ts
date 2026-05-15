import type { MasterTripFile } from "@/lib/master-trip-file/types";
import type { TripPriority } from "@/lib/homepage-decision/types";
import { getQuickAction } from "./quick-actions";
import type { RefinementEngineInput, RefinementEngineResult, TripRefinementPatch } from "./types";

function softenSummary(summary: string): string {
  if (/relax|slow|leisure|spa|cafe|café|beach/i.test(summary)) return summary;
  return `${summary.replace(/\.$/, "")} — unhurried pace, extra downtime`;
}

function budgetizeSummary(summary: string): string {
  if (/budget|local|street|free|walk/i.test(summary)) return summary;
  return `${summary.replace(/\.$/, "")} — budget-friendly picks`;
}

function addFoodHint(summary: string): string {
  if (/food|cafe|café|restaurant|market|dining/i.test(summary)) return summary;
  return `${summary.replace(/\.$/, "")} + local café or food stop`;
}

function detectDaysFromMessage(message: string): number | null {
  const m = /\b(\d+)\s*days?\b/i.exec(message);
  if (m) return Math.min(30, Math.max(1, Number.parseInt(m[1], 10)));
  const w = /\bweekend\b/i.test(message);
  if (w) return 2;
  return null;
}

function buildQuickActionPatch(
  actionId: string,
  file: MasterTripFile,
): TripRefinementPatch | null {
  const action = getQuickAction(actionId);
  if (!action) return null;

  const dest = file.destination.name;

  switch (actionId) {
    case "more-relaxing": {
      const summaries = file.itinerary.map((d) => ({
        dayNumber: d.dayNumber,
        summary: softenSummary(d.summary),
      }));
      return {
        affectedSections: ["itinerary", "preferences", "whyItFits", "practical"],
        assistantMessage: `Slowed the pace for ${dest} — more rest windows and lighter days.`,
        preferences: {
          priorities: mergePrioritiesUnique(file.preferences.priorities, ["relaxing"]),
        },
        itineraryOps: [{ op: "replace_summaries", days: summaries }],
        whyItFits: [
          ...file.recommendation.whyItFits.slice(0, 2),
          "Adjusted for a more relaxing, low-stress pace.",
        ],
        practical: {
          travelEffort: "Light travel · extra rest time built in",
        },
      };
    }
    case "more-adventurous": {
      const last = file.itinerary[file.itinerary.length - 1];
      return {
        affectedSections: ["itinerary", "preferences", "whyItFits"],
        assistantMessage: `Added an adventure-focused touch to your ${dest} plan.`,
        preferences: {
          priorities: mergePrioritiesUnique(file.preferences.priorities, ["adventure"]),
        },
        itineraryOps: last
          ? [
              {
                op: "update",
                dayId: last.id,
                summary: `${last.summary.replace(/\.$/, "")} — highlight adventure activity (trek, sport, or safari)`,
              },
            ]
          : [],
        whyItFits: [
          ...file.recommendation.whyItFits.slice(0, 2),
          "Tuned for more active, adventure-oriented experiences.",
        ],
      };
    }
    case "reduce-budget": {
      const summaries = file.itinerary.map((d) => ({
        dayNumber: d.dayNumber,
        summary: budgetizeSummary(d.summary),
      }));
      return {
        affectedSections: ["practical", "preferences", "itinerary", "whyItFits"],
        assistantMessage: `Shifted ${dest} toward budget-friendly choices — same route, lighter spend.`,
        preferences: { budget: "budget", priorities: mergePrioritiesUnique(file.preferences.priorities, ["budget-friendly"]) },
        itineraryOps: [{ op: "replace_summaries", days: summaries }],
        practical: {
          budgetEstimate: "~₹3k–6k/day · street food, local transport, guesthouses",
        },
        whyItFits: [
          ...file.recommendation.whyItFits.slice(0, 2),
          "Optimized for a tighter budget without changing the destination.",
        ],
      };
    }
    case "add-food-stops": {
      const summaries = file.itinerary.map((d) => ({
        dayNumber: d.dayNumber,
        summary: addFoodHint(d.summary),
      }));
      return {
        affectedSections: ["itinerary", "preferences"],
        assistantMessage: `Wove café and food stops into each day in ${dest}.`,
        preferences: {
          priorities: mergePrioritiesUnique(file.preferences.priorities, ["food-culture"]),
        },
        itineraryOps: [{ op: "replace_summaries", days: summaries }],
      };
    }
    case "couple-friendly": {
      return {
        affectedSections: ["whyItFits", "itinerary"],
        assistantMessage: `Tuned the plan for a couple — romantic pacing and shared experiences.`,
        whyItFits: [
          `Great for couples visiting ${dest}.`,
          "Unhurried schedule with space for dinners and scenic moments.",
          ...file.recommendation.whyItFits.slice(0, 1),
        ],
        itineraryOps: file.itinerary[0]
          ? [
              {
                op: "update",
                dayId: file.itinerary[0].id,
                summary: `${file.itinerary[0].summary.replace(/\.$/, "")} — sunset viewpoint or cozy dinner`,
              },
            ]
          : [],
      };
    }
    case "family-friendly": {
      const summaries = file.itinerary.map((d) => ({
        dayNumber: d.dayNumber,
        summary: d.summary.includes("family") || d.summary.includes("kid")
          ? d.summary
          : `${d.summary.replace(/\.$/, "")} — family-friendly, flexible timing`,
      }));
      return {
        affectedSections: ["whyItFits", "itinerary", "practical"],
        assistantMessage: `Adjusted for families — shorter transfers and kid-safe activities.`,
        whyItFits: [
          `Works well for families in ${dest}.`,
          "Manageable daily pace with breaks and easy logistics.",
        ],
        itineraryOps: [{ op: "replace_summaries", days: summaries }],
        practical: {
          travelEffort: "Moderate effort · family-paced days",
        },
      };
    }
    default:
      return null;
  }
}

function mergePrioritiesUnique(current: TripPriority[], add: TripPriority[]): TripPriority[] {
  const set = new Set<TripPriority>(current);
  for (const p of add) set.add(p);
  return [...set];
}

function patchFromFreeText(message: string, file: MasterTripFile): TripRefinementPatch | null {
  const lower = message.toLowerCase();

  if (/\bcheaper|budget|affordable|reduce\s+cost/i.test(lower)) {
    return buildQuickActionPatch("reduce-budget", file);
  }
  if (/\brelax|slower|chill|easy\s+pace/i.test(lower)) {
    return buildQuickActionPatch("more-relaxing", file);
  }
  if (/\bcaf[eé]|food|restaurant|culinary/i.test(lower)) {
    return buildQuickActionPatch("add-food-stops", file);
  }
  if (/\btrek|hike|adventure|thrill/i.test(lower) && /\bskip|remove|no\b/i.test(lower)) {
    const trekDay = file.itinerary.find((d) => /trek|hike|raft|adventure/i.test(d.summary));
    if (trekDay) {
      return {
        affectedSections: ["itinerary"],
        assistantMessage: "Removed trekking-heavy activity — swapped to a lighter alternative.",
        itineraryOps: [
          {
            op: "update",
            dayId: trekDay.id,
            summary: trekDay.summary
              .replace(/trek|hike|rafting|adventure/gi, "scenic walk")
              .replace(/\s+—.*$/, "") + " — easy scenic walk and local sights",
          },
        ],
      };
    }
  }
  if (/\b(\d+)\s*days?\b/i.test(lower) || /\bweekend\b/i.test(lower) || /\breduce\s+to\b/i.test(lower)) {
    const days = detectDaysFromMessage(message);
    if (days && days < file.itinerary.length) {
      return {
        affectedSections: ["itinerary", "preferences"],
        assistantMessage: `Shortened the trip to ${days} days — kept the best highlights at the start.`,
        preferences: { days },
        itineraryOps: [{ op: "truncate", maxDays: days }],
      };
    }
  }

  return null;
}

export function runRulesRefinement(input: RefinementEngineInput): RefinementEngineResult | null {
  if (input.quickActionId) {
    const patch = buildQuickActionPatch(input.quickActionId, input.file);
    if (patch) return { patch, source: "rules" };
  }
  const patch = patchFromFreeText(input.message, input.file);
  if (patch) return { patch, source: "rules" };
  return null;
}
