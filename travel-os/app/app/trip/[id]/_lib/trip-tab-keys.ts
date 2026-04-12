export const TRIP_TAB_KEYS = [
  "itinerary",
  "expenses",
  "chat",
  "docs",
  "guides",
  "members",
  "checklist",
  "food",
  "language",
] as const;

export type TripTabKey = (typeof TRIP_TAB_KEYS)[number];

export const TRIP_TAB_LABELS: Record<TripTabKey, string> = {
  itinerary: "Itinerary",
  expenses: "Expenses",
  chat: "Chat",
  docs: "Docs",
  guides: "Guides",
  members: "Members",
  checklist: "Checklist",
  food: "Food",
  language: "Language",
};

export function parseTripTabParam(raw: string | undefined | null): TripTabKey {
  if (!raw || typeof raw !== "string") return "itinerary";
  const t = raw.trim().toLowerCase();
  return TRIP_TAB_KEYS.includes(t as TripTabKey) ? (t as TripTabKey) : "itinerary";
}
