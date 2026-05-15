import type { ItineraryOptimizationActivity } from "@/lib/ai/itinerary-optimization-engine";
import { getQuickAction } from "@/lib/trip-refinement/quick-actions";
import type { ItineraryItemPatchOp, RefinementEngineInput, RefinementEngineResult } from "./types";
import { activitiesByDate } from "./snapshot";

function patchable(activity: ItineraryOptimizationActivity): boolean {
  return !activity.user_modified;
}

function defaultLocation(activities: ItineraryOptimizationActivity[], destination: string): string {
  const withLoc = activities.find((a) => a.location?.trim());
  return withLoc?.location?.trim() || destination || "Location TBD";
}

function addCafeOp(
  date: string,
  location: string,
  time = "15:30",
): ItineraryItemPatchOp {
  return {
    op: "add",
    date,
    title: "Local café break",
    activity_name: "Local café — slow down and people-watch",
    time,
    location,
  };
}

function addNightlifeOp(date: string, location: string): ItineraryItemPatchOp {
  return {
    op: "add",
    date,
    title: "Evening out",
    activity_name: "Evening stroll or live music spot",
    time: "20:00",
    location,
  };
}

function buildQuickActionPatch(input: RefinementEngineInput): RefinementEngineResult | null {
  const actionId = input.quickActionId;
  if (!actionId) return null;
  const action = getQuickAction(actionId);
  if (!action) return null;

  const dest = input.destination;
  const loc = defaultLocation(input.activities, dest);
  const byDate = activitiesByDate(input.activities);
  const dates = [...byDate.keys()].sort();
  const ops: ItineraryItemPatchOp[] = [];

  const patchableOnDate = (date: string) =>
    (byDate.get(date) ?? []).filter(patchable);

  switch (actionId) {
    case "more-relaxing": {
      for (const date of dates) {
        for (const item of patchableOnDate(date)) {
          const time = item.time && /^\d{2}:\d{2}$/.test(item.time) ? shiftLater(item.time, 30) : "10:30";
          ops.push({
            op: "update",
            id: item.id,
            time,
            activity_name: softenText(item.title),
          });
        }
      }
      return result("more-relaxing", ops, dates, `Slowed pacing for ${dest} — more breathing room between stops.`, input.activities);
    }
    case "add-food-stops":
    case "add-cafes": {
      for (const date of dates) {
        if (!patchableOnDate(date).some((a) => /cafe|café|coffee|food/i.test(a.title))) {
          ops.push(addCafeOp(date, loc));
        }
      }
      return result(actionId, ops, dates, `Added café breaks on ${ops.length} day(s).`, input.activities);
    }
    case "reduce-budget": {
      for (const date of dates) {
        for (const item of patchableOnDate(date)) {
          ops.push({
            op: "update",
            id: item.id,
            activity_name: budgetizeText(item.title),
            location: item.location || loc,
          });
        }
      }
      return result(actionId, ops, dates, `Tuned activities toward budget-friendly options.`, input.activities);
    }
    case "more-adventurous": {
      const lastDate = dates[dates.length - 1];
      if (lastDate) {
        const items = patchableOnDate(lastDate);
        const target = items[items.length - 1];
        if (target) {
          ops.push({
            op: "update",
            id: target.id,
            activity_name: `${target.title.replace(/\.$/, "")} — add an active or outdoor highlight`,
          });
        }
      }
      return result(actionId, ops, dates, `Added an adventure angle to your plan.`, input.activities);
    }
    case "add-nightlife": {
      for (const date of dates) {
        if (!patchableOnDate(date).some((a) => /night|bar|club|evening/i.test(a.title))) {
          ops.push(addNightlifeOp(date, loc));
        }
      }
      return result(actionId, ops, dates, `Added evening options for nightlife-friendly stops.`, input.activities);
    }
    case "hidden-gems": {
      for (const date of dates) {
        const items = patchableOnDate(date);
        const target = items[Math.min(1, items.length - 1)];
        if (target) {
          ops.push({
            op: "update",
            id: target.id,
            activity_name: `${target.title.replace(/\.$/, "")} — swap for a lesser-known local spot`,
          });
        }
      }
      return result(actionId, ops, dates, `Swapped busy stops for hidden-gem style picks.`, input.activities);
    }
    case "reduce-travel-fatigue": {
      for (const date of dates) {
        const items = patchableOnDate(date);
        if (items.length > 3) {
          const remove = items.slice(3);
          for (const r of remove) {
            ops.push({ op: "remove", id: r.id });
          }
        }
        for (const item of items.slice(0, 3)) {
          ops.push({
            op: "update",
            id: item.id,
            activity_name: clusterText(item.title, loc),
            location: loc,
          });
        }
      }
      return result(actionId, ops, dates, `Reduced hop count and clustered stops by area.`, input.activities);
    }
    case "family-friendly": {
      for (const date of dates) {
        for (const item of patchableOnDate(date)) {
          ops.push({
            op: "update",
            id: item.id,
            activity_name: `${item.title.replace(/\.$/, "")} — family-friendly pacing`,
          });
        }
      }
      return result(actionId, ops, dates, `Adjusted for family-friendly pacing and stops.`, input.activities);
    }
    case "couple-friendly": {
      for (const date of dates) {
        const items = patchableOnDate(date);
        const target = items[items.length - 1];
        if (target) {
          ops.push({
            op: "update",
            id: target.id,
            activity_name: `${target.title.replace(/\.$/, "")} — romantic, unhurried option`,
            time: "17:30",
          });
        }
      }
      return result(actionId, ops, dates, `Tuned for a couple — slower, more intimate rhythm.`, input.activities);
    }
    default:
      return null;
  }
}

function result(
  quickActionId: string,
  ops: ItineraryItemPatchOp[],
  dates: string[],
  message: string,
  activities: ItineraryOptimizationActivity[],
): RefinementEngineResult {
  const byId = new Map(activities.map((a) => [a.id, a]));
  const touched = new Set<string>();

  for (const op of ops) {
    if (op.op === "add") touched.add(op.date);
    else if (op.op === "update" || op.op === "remove") {
      const row = byId.get(op.id);
      if (row?.date) touched.add(row.date);
    }
  }

  return {
    patch: {
      assistantMessage: message,
      quickActionId,
      affectedDates: touched.size > 0 ? [...touched].sort() : dates,
      ops,
      preservedUserEdits: 0,
    },
    source: "rules",
  };
}

function softenText(s: string): string {
  if (/relax|slow|leisure|spa|cafe|café/i.test(s)) return s;
  return `${s.replace(/\.$/, "")} — relaxed pace`;
}

function budgetizeText(s: string): string {
  if (/budget|local|street|free|walk/i.test(s)) return s;
  return `${s.replace(/\.$/, "")} — budget-friendly`;
}

function clusterText(s: string, loc: string): string {
  return `${s.replace(/\.$/, "")} — nearby in ${loc}`;
}

function shiftLater(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return time;
  const total = h * 60 + m + minutes;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

export function runItineraryRulesRefinement(input: RefinementEngineInput): RefinementEngineResult {
  const quick = input.quickActionId ? buildQuickActionPatch(input) : null;
  if (quick) return quick;

  const msg = input.message.toLowerCase();
  const syntheticId = msg.includes("café") || msg.includes("cafe") ? "add-cafes" : msg.includes("night") ? "add-nightlife" : msg.includes("relax") ? "more-relaxing" : msg.includes("budget") ? "reduce-budget" : msg.includes("family") ? "family-friendly" : msg.includes("couple") ? "couple-friendly" : msg.includes("hidden") ? "hidden-gems" : msg.includes("fatigue") || msg.includes("travel") ? "reduce-travel-fatigue" : "";

  if (syntheticId) {
    return buildQuickActionPatch({ ...input, quickActionId: syntheticId }) ?? fallbackPatch(input);
  }

  return fallbackPatch(input);
}

function fallbackPatch(input: RefinementEngineInput): RefinementEngineResult {
  const byDate = activitiesByDate(input.activities);
  const dates = [...byDate.keys()].sort();
  const loc = defaultLocation(input.activities, input.destination);
  const ops: ItineraryItemPatchOp[] = [];
  const first = dates[0];
  if (first) {
    const target = (byDate.get(first) ?? []).find(patchable);
    if (target) {
      ops.push({
        op: "update",
        id: target.id,
        activity_name: `${target.title} — adjusted per your note`,
      });
    } else {
      ops.push(addCafeOp(first, loc));
    }
  }
  return {
    patch: {
      assistantMessage: "Applied a light tweak to matching stops. Your manual edits were kept as-is.",
      affectedDates: dates.slice(0, 1),
      ops,
      preservedUserEdits: 0,
    },
    source: "rules",
  };
}
