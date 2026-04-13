export const TRIP_TAB_KEYS = [
  "itinerary",
  "connect",
  "checklist",
  "expenses",
  "language",
  "food",
  "guides",
] as const;

export type TripTabKey = (typeof TRIP_TAB_KEYS)[number];

/** Sub-views inside the unified Connect tab (chat, documents, members). */
export type ConnectSection = "chat" | "docs" | "members";

export const TRIP_TAB_LABELS: Record<TripTabKey, string> = {
  itinerary: "Itinerary",
  connect: "Connect",
  checklist: "Checklist",
  expenses: "Expenses",
  language: "Language",
  food: "Food",
  guides: "Guides",
};

export const CONNECT_SECTION_LABELS: Record<ConnectSection, string> = {
  chat: "Chat",
  docs: "Docs",
  members: "Members",
};

/**
 * Top-level trip tab from `?tab=`. Maps legacy `chat` / `docs` / `members` to `connect`
 * so old links and bookmarks keep working.
 */
export function parseTripTabParam(raw: string | undefined | null): TripTabKey {
  if (!raw || typeof raw !== "string") return "itinerary";
  const t = raw.trim().toLowerCase();
  if (t === "chat" || t === "docs" || t === "members") return "connect";
  return TRIP_TAB_KEYS.includes(t as TripTabKey) ? (t as TripTabKey) : "itinerary";
}

/**
 * Resolves Connect hub section from raw `tab` and optional `section` query.
 * Legacy: `?tab=docs` → docs; `?tab=connect&section=members` → members.
 */
export function parseConnectSectionFromSearch(
  tabRaw: string | null | undefined,
  sectionRaw: string | null | undefined,
): ConnectSection {
  const tab = (tabRaw ?? "").trim().toLowerCase();
  if (tab === "docs") return "docs";
  if (tab === "members") return "members";
  if (tab === "chat") return "chat";
  const sec = (sectionRaw ?? "").trim().toLowerCase();
  if (tab === "connect") {
    if (sec === "docs" || sec === "members") return sec;
    return "chat";
  }
  return "chat";
}
