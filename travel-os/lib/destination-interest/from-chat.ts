import {
  getRegisteredDestination,
  listRegisteredDestinationIds,
} from "@/lib/destination-interest/registry";
import {
  resolveTopLevelDestination,
  resolveTopLevelDestinations,
} from "@/lib/destination-interest/resolve";
import type { ResolvedDestination } from "@/lib/destination-interest/types";

export type ChatDestinationInterestTarget = {
  destinationId: string;
  name: string;
  uniqueTravelers?: number;
  totalInterest?: number;
  month?: number;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function detectRegisteredDestinationsInText(text: string): ResolvedDestination[] {
  const hay = text.trim();
  if (!hay) return [];
  const out: ResolvedDestination[] = [];
  const seen = new Set<string>();
  for (const id of listRegisteredDestinationIds()) {
    const dest = getRegisteredDestination(id);
    if (!dest || dest.name.length < 3) continue;
    const re = new RegExp(`\\b${escapeRegExp(dest.name)}\\b`, "i");
    if (!re.test(hay) || seen.has(dest.id)) continue;
    seen.add(dest.id);
    out.push(dest);
  }
  return out;
}

function pushUnique(
  out: ChatDestinationInterestTarget[],
  seen: Set<string>,
  target: ChatDestinationInterestTarget | null | undefined,
) {
  if (!target?.destinationId || !target.name || seen.has(target.destinationId)) return;
  seen.add(target.destinationId);
  out.push(target);
}

/** Collect top-level destinations mentioned in a chat message for badge display. */
export function destinationInterestTargetsFromChat(input: {
  entities?: Array<{ name?: unknown; type?: unknown }> | null;
  placeNames?: string[] | null;
  recommendationNames?: Array<{ id?: string; slug?: string; name?: string }> | null;
  stored?: ChatDestinationInterestTarget[] | null;
  text?: string | null;
  memoryDestinations?: string[] | null;
}): ChatDestinationInterestTarget[] {
  const seen = new Set<string>();
  const out: ChatDestinationInterestTarget[] = [];

  for (const row of input.stored ?? []) {
    if (!row || typeof row.destinationId !== "string" || typeof row.name !== "string") continue;
    pushUnique(out, seen, {
      destinationId: row.destinationId,
      name: row.name,
      uniqueTravelers:
        typeof row.uniqueTravelers === "number" ? row.uniqueTravelers : undefined,
      totalInterest: typeof row.totalInterest === "number" ? row.totalInterest : undefined,
      month: typeof row.month === "number" ? row.month : undefined,
    });
  }

  for (const dest of resolveTopLevelDestinations(
    (input.entities ?? []).flatMap((entity) => {
      const name = typeof entity?.name === "string" ? entity.name : "";
      if (!name) return [];
      return [{ name, type: typeof entity?.type === "string" ? entity.type : "place" }];
    }),
  )) {
    pushUnique(out, seen, { destinationId: dest.id, name: dest.name });
  }

  for (const card of input.recommendationNames ?? []) {
    const id = (card.slug || card.id || "").trim();
    const name = (card.name || "").trim();
    if (id && name) pushUnique(out, seen, { destinationId: id, name });
  }

  for (const placeName of input.placeNames ?? []) {
    const dest = resolveTopLevelDestination({ name: placeName, type: "place" });
    if (dest) pushUnique(out, seen, { destinationId: dest.id, name: dest.name });
  }

  for (const dest of detectRegisteredDestinationsInText(input.text ?? "")) {
    pushUnique(out, seen, { destinationId: dest.id, name: dest.name });
  }

  if (out.length > 0) return out;

  for (const raw of input.memoryDestinations ?? []) {
    const dest = resolveTopLevelDestination({ name: raw, type: "city" });
    if (!dest) continue;
    pushUnique(out, seen, { destinationId: dest.id, name: dest.name });
    break;
  }

  return out;
}
