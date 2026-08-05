import {
  ACTOR_ID_MAX_LEN,
  DESTINATION_ID_MAX_LEN,
  DESTINATION_INTEREST_EVENT_TYPES,
  type DestinationInterestEventType,
} from "@/lib/destination-interest/constants";
import { isAcceptableDestinationId } from "@/lib/destination-interest/resolve";

export type ParsedTrackPayload =
  | { ok: true; destinationId: string; eventType: DestinationInterestEventType }
  | { ok: false; error: string };

export type ParsedInterestIds =
  | { ok: true; destinationIds: string[] }
  | { ok: false; error: string };

function isEventType(value: string): value is DestinationInterestEventType {
  return (DESTINATION_INTEREST_EVENT_TYPES as readonly string[]).includes(value);
}

export function parseTrackPayload(body: unknown): ParsedTrackPayload {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Invalid JSON body." };
  }
  const record = body as Record<string, unknown>;
  const destinationId =
    typeof record.destinationId === "string" ? record.destinationId.trim().toLowerCase() : "";
  const eventTypeRaw =
    typeof record.eventType === "string" ? record.eventType.trim().toUpperCase() : "";

  if (!destinationId || destinationId.length > DESTINATION_ID_MAX_LEN) {
    return { ok: false, error: "destinationId is required." };
  }
  if (!isAcceptableDestinationId(destinationId)) {
    return { ok: false, error: "destinationId is not a top-level destination." };
  }
  if (!isEventType(eventTypeRaw)) {
    return { ok: false, error: "eventType is invalid." };
  }
  return { ok: true, destinationId, eventType: eventTypeRaw };
}

export function parseDestinationIdParam(raw: string | undefined): string | null {
  const id = (raw ?? "").trim().toLowerCase();
  if (!id || id.length > DESTINATION_ID_MAX_LEN) return null;
  if (!isAcceptableDestinationId(id)) return null;
  return id;
}

export function parseInterestIdList(raw: unknown): ParsedInterestIds {
  const values: string[] = [];
  if (typeof raw === "string") {
    values.push(...raw.split(","));
  } else if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === "string") values.push(item);
    }
  } else {
    return { ok: false, error: "ids is required." };
  }

  const destinationIds: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const id = value.trim().toLowerCase();
    if (!id || seen.has(id)) continue;
    if (!isAcceptableDestinationId(id)) continue;
    seen.add(id);
    destinationIds.push(id);
    if (destinationIds.length >= 40) break;
  }
  if (!destinationIds.length) return { ok: false, error: "No valid destination ids." };
  return { ok: true, destinationIds };
}

export function isValidActorId(actorId: string): boolean {
  const id = actorId.trim();
  return id.length > 0 && id.length <= ACTOR_ID_MAX_LEN;
}
