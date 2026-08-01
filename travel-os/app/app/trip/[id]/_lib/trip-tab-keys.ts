/** Tabs shown in the trip detail sticky bar (order matters). */
export const TRIP_TAB_BAR_KEYS = [
  "chat",
  "overview",
  "itinerary",
  "expenses",
  "members",
  "docs",
  "guides",
  "language",
] as const;

/** Still routable via `?tab=` but not shown in the sticky bar. */
export const TRIP_UTILITY_TAB_KEYS = ["checklist", "food", "tools"] as const;

export const TRIP_TAB_KEYS = [
  ...TRIP_TAB_BAR_KEYS,
  ...TRIP_UTILITY_TAB_KEYS,
] as const;

export type TripTabKey = (typeof TRIP_TAB_KEYS)[number];
export type TripTabBarKey = (typeof TRIP_TAB_BAR_KEYS)[number];

/** @deprecated Connect hub removed; kept for legacy URL helpers. */
export type ConnectSection = "chat" | "docs" | "members";

export const TRIP_TAB_LABELS: Record<TripTabKey, string> = {
  chat: "Chat",
  overview: "Overview",
  itinerary: "Itinerary",
  expenses: "Expenses",
  members: "Members",
  docs: "Documents",
  guides: "Guide",
  language: "Language",
  checklist: "Checklist",
  food: "Food",
  tools: "Tools",
};

export const CONNECT_SECTION_LABELS: Record<ConnectSection, string> = {
  chat: "Chat",
  docs: "Docs",
  members: "Members",
};

const TAB_KEY_SET = new Set<string>(TRIP_TAB_KEYS);

/**
 * Top-level trip tab from `?tab=`.
 * Default (missing/unknown) is Chat.
 * Legacy `?tab=connect` (+ optional `section`) maps to chat / docs / members.
 */
export function parseTripTabParam(
  raw: string | undefined | null,
  sectionRaw?: string | null,
): TripTabKey {
  if (!raw || typeof raw !== "string") return "chat";
  const t = raw.trim().toLowerCase();

  if (t === "connect") {
    const sec = (sectionRaw ?? "").trim().toLowerCase();
    if (sec === "docs" || sec === "members") return sec;
    return "chat";
  }
  if (t === "explore") return "guides";
  if (t === "documents" || t === "document") return "docs";
  if (t === "guide") return "guides";

  return TAB_KEY_SET.has(t) ? (t as TripTabKey) : "chat";
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

/** Bare trip URL (no `?tab=`) opens Chat. */
export function isDefaultTripTab(key: TripTabKey): boolean {
  return key === "chat";
}
