/** Intents the itinerary editor AI can propose. */
export const ITINERARY_EDIT_INTENTS = [
  "move_activity",
  "delete_activity",
  "add_activity",
  "optimize_route",
  "reduce_cost",
  "increase_relaxation",
] as const;

export type ItineraryEditIntent = (typeof ITINERARY_EDIT_INTENTS)[number];

export const ITINERARY_EDIT_OPS = ["add", "update", "delete", "move"] as const;
export type ItineraryEditOp = (typeof ITINERARY_EDIT_OPS)[number];

export type ItineraryProposedEdit = {
  op: ItineraryEditOp;
  /** YYYY-MM-DD — source day (or target day for add). */
  day: string;
  /** Required for update / delete / move. */
  activityId?: string;
  title?: string;
  location?: string | null;
  /** HH:mm */
  time?: string | null;
  /** Target day for move (YYYY-MM-DD). */
  toDay?: string;
  notes?: string | null;
  /** Short human label for confirmation UI. */
  label?: string;
};

export type ItineraryEditProposalStatus = "pending" | "applied" | "dismissed";

export type ItineraryEditProposal = {
  proposalId: string;
  tripId: string;
  intent: ItineraryEditIntent;
  summary: string;
  rationale?: string;
  edits: ItineraryProposedEdit[];
  status: ItineraryEditProposalStatus;
  createdAt: string;
};

export function isItineraryEditIntent(value: unknown): value is ItineraryEditIntent {
  return (
    typeof value === "string" &&
    (ITINERARY_EDIT_INTENTS as readonly string[]).includes(value)
  );
}

export function isItineraryEditOp(value: unknown): value is ItineraryEditOp {
  return typeof value === "string" && (ITINERARY_EDIT_OPS as readonly string[]).includes(value);
}

/** Read a pending/applied proposal from assistant message metadata. */
export function proposalFromMessageMetadata(
  metadata: Record<string, unknown> | undefined,
): ItineraryEditProposal | null {
  if (!metadata || typeof metadata !== "object") return null;
  const raw = metadata.itineraryProposal;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const p = raw as Partial<ItineraryEditProposal>;
  if (
    typeof p.proposalId !== "string" ||
    typeof p.tripId !== "string" ||
    !isItineraryEditIntent(p.intent) ||
    typeof p.summary !== "string" ||
    !Array.isArray(p.edits)
  ) {
    return null;
  }
  const edits = p.edits.filter((e): e is ItineraryProposedEdit => {
    if (!e || typeof e !== "object") return false;
    return isItineraryEditOp(e.op) && typeof e.day === "string";
  });
  if (edits.length === 0) return null;
  const status: ItineraryEditProposalStatus =
    p.status === "applied" || p.status === "dismissed" ? p.status : "pending";
  return {
    proposalId: p.proposalId,
    tripId: p.tripId,
    intent: p.intent,
    summary: p.summary,
    rationale: typeof p.rationale === "string" ? p.rationale : undefined,
    edits,
    status,
    createdAt:
      typeof p.createdAt === "string" ? p.createdAt : new Date().toISOString(),
  };
}
