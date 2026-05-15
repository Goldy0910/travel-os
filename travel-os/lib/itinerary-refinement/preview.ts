import type { ItineraryOptimizationActivity } from "@/lib/ai/itinerary-optimization-engine";
import type { ItineraryItemPatchOp, ItineraryRefinementChange, ItineraryRefinementPatch } from "./types";

function labelFor(activity: ItineraryOptimizationActivity): string {
  return activity.title || "Activity";
}

function formatLine(title: string, time: string | null, location: string): string {
  const parts = [title];
  if (time) parts.push(time);
  if (location) parts.push(location);
  return parts.join(" · ");
}

export function buildChangePreview(
  activities: ItineraryOptimizationActivity[],
  patch: ItineraryRefinementPatch,
): ItineraryRefinementChange[] {
  const byId = new Map(activities.map((a) => [a.id, a]));
  const changes: ItineraryRefinementChange[] = [];

  for (const op of patch.ops) {
    if (op.op === "update") {
      const before = byId.get(op.id);
      if (!before) continue;
      const afterTitle = op.title ?? op.activity_name ?? before.title;
      const afterTime = op.time !== undefined ? op.time : before.time;
      const afterLoc = op.location ?? before.location;
      const beforeLine = formatLine(labelFor(before), before.time, before.location);
      const afterLine = formatLine(afterTitle, afterTime, afterLoc);
      if (beforeLine === afterLine) continue;
      changes.push({
        id: `upd-${op.id}`,
        type: "update",
        date: before.date,
        title: afterTitle,
        detail: "Updated",
        before: beforeLine,
        after: afterLine,
      });
    } else if (op.op === "add") {
      changes.push({
        id: `add-${op.date}-${op.title}`,
        type: "add",
        date: op.date,
        title: op.title,
        detail: "New stop",
        after: formatLine(op.title, op.time ?? "10:00", op.location),
      });
    } else if (op.op === "remove") {
      const before = byId.get(op.id);
      if (!before) continue;
      changes.push({
        id: `rm-${op.id}`,
        type: "remove",
        date: before.date,
        title: labelFor(before),
        detail: "Removed",
        before: formatLine(labelFor(before), before.time, before.location),
      });
    }
  }

  if (patch.preservedUserEdits > 0) {
    changes.push({
      id: "preserved",
      type: "skipped",
      date: "",
      title: "Your manual edits",
      detail: `${patch.preservedUserEdits} activit${patch.preservedUserEdits === 1 ? "y" : "ies"} left unchanged`,
    });
  }

  return changes;
}

/** Filter ops that would touch user-modified rows (updates/removes). */
export function sanitizePatchForUserEdits(
  patch: ItineraryRefinementPatch,
  activities: ItineraryOptimizationActivity[],
): ItineraryRefinementPatch {
  const locked = new Set(
    activities.filter((a) => a.user_modified).map((a) => a.id),
  );
  let preserved = patch.preservedUserEdits;

  const ops = patch.ops.filter((op) => {
    if (op.op === "update" || op.op === "remove") {
      if (locked.has(op.id)) {
        preserved += 1;
        return false;
      }
    }
    return true;
  });

  return { ...patch, ops, preservedUserEdits: preserved };
}
