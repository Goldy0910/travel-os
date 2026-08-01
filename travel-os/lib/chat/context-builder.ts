/**
 * Context Builder — retrieval-filtered prompt context for every AI chat request.
 *
 * Design:
 * - Compose existing loaders (conversation memory formatters, trip companion,
 *   trip memory, destination-knowledge RAG, travel guides) — do not duplicate
 *   business logic.
 * - Select relevant slices via keyword/heuristic scoring against the user message
 *   (same spirit as `lib/destination-knowledge` lexical retrieval).
 * - Never dump full tables: expenses → totals + top recent; itinerary → today +
 *   message-matched activities; documents → matching filenames; guide → matching
 *   categories; members → compact list.
 *
 * Char budget (approx. 4 chars ≈ 1 token):
 * - TOTAL_CHAR_BUDGET = 6_000  (~1.5k tokens) for the assembled retrieval block
 * - Soft per-section caps below; surplus sections are truncated / dropped by priority
 * - Knowledge RAG (when passed in) is capped separately then folded into the budget
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  formatMemoryForPrompt,
  type ConversationMemoryFields,
} from "@/lib/chat/memory-types";
import {
  formatCompanionContextForPrompt,
  loadTripCompanionContext,
  type TripCompanionContext,
} from "@/lib/chat/trip-companion";
import {
  formatTripMemoryForPrompt,
  loadTripMemory,
  tripMemoryHasValues,
  type TripMemoryFields,
} from "@/lib/trip-memory";
import { memberDisplayLabel } from "@/lib/trip-entity-comments";
import { getTravelGuidesForPlace, type TravelGuidesBundle } from "@/lib/travelGuides";

/** Soft ceiling for the full retrieval block injected into the system prompt. */
export const CONTEXT_TOTAL_CHAR_BUDGET = 6_000;

/** Soft per-section caps (chars). */
export const CONTEXT_SECTION_CAPS = {
  conversationMemory: 800,
  companion: 2_200,
  tripMemory: 700,
  expenses: 600,
  documents: 500,
  members: 400,
  guide: 900,
  itineraryMatch: 700,
  knowledge: 1_800,
} as const;

const EXPENSE_RECENT_LIMIT = 5;
const DOCUMENT_MATCH_LIMIT = 8;
const MEMBER_LIST_LIMIT = 12;
const ITINERARY_MATCH_LIMIT = 8;
const GUIDE_ITEM_LIMIT = 4;

export type ContextSectionId =
  | "conversation_memory"
  | "companion"
  | "trip_memory"
  | "expenses"
  | "documents"
  | "members"
  | "guide"
  | "itinerary_match"
  | "knowledge";

export type ContextSection = {
  id: ContextSectionId;
  title: string;
  text: string;
  chars: number;
  included: boolean;
  reason: string;
};

export type BuildChatContextInput = {
  supabase: SupabaseClient;
  userId: string;
  userMessage: string;
  tripId?: string | null;
  conversationId?: string | null;
  /** Route-updated conversation memory (avoids a second fetch). */
  conversationMemory?: ConversationMemoryFields | null;
  /** Destination-knowledge RAG text already retrieved by the route. */
  knowledgeContext?: string | null;
  /** Optional preloaded companion snapshot. */
  companion?: TripCompanionContext | null;
  /** Optional preloaded trip memory. */
  tripMemory?: TripMemoryFields | null;
  /**
   * Skip loading the live companion snapshot (assistant-chat already has itinerary).
   * Guide matching still works when `destinationHint` is set.
   */
  skipCompanion?: boolean;
  /** Destination used for guide retrieval when companion is skipped/unavailable. */
  destinationHint?: string | null;
  signal?: AbortSignal;
};

export type BuiltChatContext = {
  /** Compact multi-section block for system-prompt injection (may be empty). */
  promptBlock: string;
  sections: ContextSection[];
  charsUsed: number;
  tripScoped: boolean;
  companion: TripCompanionContext | null;
  tripMemory: TripMemoryFields | null;
};

type IntentFlags = {
  expenses: boolean;
  documents: boolean;
  members: boolean;
  itinerary: boolean;
  guide: boolean;
  packing: boolean;
  emergency: boolean;
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
}

function lexicalScore(query: string, haystack: string): number {
  const q = query.toLowerCase();
  const tokens = tokenize(query);
  const hay = haystack.toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (hay.includes(token)) score += 1;
  }
  // Phrase bonus for multi-word overlaps
  if (tokens.length >= 2 && hay.includes(q.slice(0, Math.min(q.length, 40)))) {
    score += 2;
  }
  return score;
}

function detectIntents(message: string): IntentFlags {
  const q = message.toLowerCase();
  return {
    expenses:
      /\b(expense|expenses|spend|spent|cost|costs|budget|paid|payer|split|bill|bills|total|money|receipt)\b/i.test(
        q,
      ),
    documents:
      /\b(document|documents|doc|docs|passport|visa|ticket|tickets|booking|pdf|file|files|upload|insurance)\b/i.test(
        q,
      ),
    members:
      /\b(member|members|who.?s coming|group|invite|invited|traveler|travellers|roommate|companions?)\b/i.test(
        q,
      ),
    itinerary:
      /\b(today|tomorrow|tonight|schedule|itinerary|activity|activities|plan|morning|afternoon|evening|when|where.?next)\b/i.test(
        q,
      ),
    guide:
      /\b(food|restaurant|eat|weather|transport|atm|currency|exchange|tip|language|fashion|wear|guide|wifi|sim)\b/i.test(
        q,
      ),
    packing: /\b(pack|packing|luggage|suitcase|bag|bring)\b/i.test(q),
    emergency: /\b(emergency|hospital|police|embassy|contact|sos|help)\b/i.test(q),
  };
}

function clip(text: string, maxChars: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

function pickNumber(row: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const n = Number(value);
      if (Number.isFinite(n)) return n;
    }
  }
  return 0;
}

function pickString(row: Record<string, unknown>, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return fallback;
}

function formatCurrencyApprox(amount: number): string {
  if (!Number.isFinite(amount)) return "0";
  return amount.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

async function loadExpensesSlice(
  supabase: SupabaseClient,
  tripId: string,
  userMessage: string,
  forceDetail: boolean,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("expenses")
    .select("id, title, name, amount, total_amount, date, expense_date, created_at, paid_by, payer")
    .eq("trip_id", tripId)
    .order("date", { ascending: false })
    .limit(40);

  if (error || !data?.length) {
    return forceDetail ? "Expenses: none recorded yet." : null;
  }

  const rows = data as Array<Record<string, unknown>>;
  const total = rows.reduce(
    (sum, row) => sum + pickNumber(row, ["amount", "total_amount"]),
    0,
  );

  const scored = rows
    .map((row) => {
      const title = pickString(row, ["title", "name"], "Expense");
      const paidBy = pickString(row, ["paid_by", "payer"], "");
      const date = pickString(row, ["date", "expense_date", "created_at"], "");
      const amount = pickNumber(row, ["amount", "total_amount"]);
      const hay = `${title} ${paidBy} ${date}`;
      return {
        title,
        paidBy,
        date: date.slice(0, 10),
        amount,
        score: lexicalScore(userMessage, hay),
      };
    })
    .sort((a, b) => b.score - a.score || b.date.localeCompare(a.date));

  const matched = scored.filter((r) => r.score > 0);
  // Totals-only when the message does not ask about expenses and nothing matched.
  if (!forceDetail && matched.length === 0) {
    return `Expenses summary: ${rows.length} items · total ≈ ${formatCurrencyApprox(total)}`;
  }

  const top = (matched.length ? matched : scored).slice(0, EXPENSE_RECENT_LIMIT);
  const lines = top.map(
    (r) =>
      `- ${r.title}: ${formatCurrencyApprox(r.amount)}${r.paidBy ? ` (paid by ${r.paidBy})` : ""}${r.date ? ` · ${r.date}` : ""}`,
  );

  return [
    `Expenses summary: ${rows.length} items · total ≈ ${formatCurrencyApprox(total)}`,
    "Recent / matching:",
    ...lines,
  ].join("\n");
}

async function loadDocumentsSlice(
  supabase: SupabaseClient,
  tripId: string,
  userMessage: string,
  force: boolean,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("documents")
    .select("id, file_name, file_url, created_at")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false })
    .limit(40);

  if (error || !data?.length) {
    return force ? "Documents: none uploaded yet." : null;
  }

  const rows = (data as Array<Record<string, unknown>>)
    .map((row) => {
      const name = pickString(row, ["file_name"], "document");
      const created = pickString(row, ["created_at"], "").slice(0, 10);
      const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
      const score = lexicalScore(userMessage, `${name} ${ext}`);
      return { name, created, ext, score };
    })
    .sort((a, b) => b.score - a.score);

  const matched = rows.filter((r) => r.score > 0);
  const selected = (matched.length ? matched : force ? rows : []).slice(
    0,
    DOCUMENT_MATCH_LIMIT,
  );
  if (!selected.length) return null;

  const lines = selected.map(
    (r) => `- ${r.name}${r.ext ? ` [${r.ext}]` : ""}${r.created ? ` · ${r.created}` : ""}`,
  );
  return [`Documents metadata (${selected.length} of ${rows.length}):`, ...lines].join("\n");
}

async function loadMembersSlice(
  supabase: SupabaseClient,
  tripId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("members")
    .select("user_id, name, email, role")
    .eq("trip_id", tripId)
    .limit(MEMBER_LIST_LIMIT);

  if (error || !data?.length) return "Members: (none listed)";

  const lines = (data as Array<Record<string, unknown>>).map((row) => {
    const label = memberDisplayLabel({
      user_id: typeof row.user_id === "string" ? row.user_id : null,
      name: typeof row.name === "string" ? row.name : null,
      email: typeof row.email === "string" ? row.email : null,
    });
    const role = typeof row.role === "string" && row.role.trim() ? row.role.trim() : "member";
    return `- ${label} (${role})`;
  });

  return [`Members (${lines.length}):`, ...lines].join("\n");
}

function selectGuideSlice(destination: string, userMessage: string, intents: IntentFlags): string | null {
  const guide = getTravelGuidesForPlace(destination);
  if (!guide) return null;

  const q = userMessage.toLowerCase();
  const wantFood = intents.guide && /\b(food|restaurant|eat|cuisine|seafood)\b/i.test(q);
  const wantMoney = intents.guide && /\b(money|atm|currency|exchange|cash|upi)\b/i.test(q);
  const wantTransport = intents.guide && /\b(transport|taxi|scooter|bus|train|metro|cab)\b/i.test(q);
  const wantEssentials =
    (intents.guide &&
      /\b(weather|language|fashion|wear|tip|tips|essential|wifi|sim)\b/i.test(q)) ||
    intents.packing ||
    intents.emergency;
  const wantPlaces = intents.guide && /\b(place|places|see|visit|attraction|sight)\b/i.test(q);

  // If guide intent is vague, pick the highest-scoring categories.
  const categories: Array<{ id: string; score: number; render: () => string[] }> = [
    {
      id: "essentials",
      score: wantEssentials ? 5 : lexicalScore(userMessage, guideEssentialsHay(guide)),
      render: () => {
        const lines: string[] = [];
        if (guide.essentials.weather) lines.push(`Weather: ${guide.essentials.weather}`);
        if (guide.essentials.language) lines.push(`Language: ${guide.essentials.language}`);
        if (guide.essentials.currency) lines.push(`Currency: ${guide.essentials.currency}`);
        if (guide.essentials.fashion) lines.push(`Fashion: ${guide.essentials.fashion}`);
        for (const tip of guide.essentials.tips.slice(0, GUIDE_ITEM_LIMIT)) {
          lines.push(`Tip: ${tip}`);
        }
        return lines;
      },
    },
    {
      id: "food",
      score: wantFood
        ? 5
        : lexicalScore(
            userMessage,
            guide.food.map((v) => v.title).join(" "),
          ),
      render: () =>
        guide.food.slice(0, GUIDE_ITEM_LIMIT).map((v) => `Food video: ${v.title}`),
    },
    {
      id: "money",
      score: wantMoney ? 5 : lexicalScore(userMessage, `${guide.money.atm} ${guide.money.exchange}`),
      render: () => {
        const lines: string[] = [];
        if (guide.money.atm) lines.push(`ATM: ${guide.money.atm}`);
        if (guide.money.exchange) lines.push(`Exchange: ${guide.money.exchange}`);
        for (const tip of guide.money.tips.slice(0, 2)) lines.push(`Money tip: ${tip}`);
        return lines;
      },
    },
    {
      id: "transport",
      score: wantTransport ? 5 : lexicalScore(userMessage, guide.transport.join(" ")),
      render: () => guide.transport.slice(0, GUIDE_ITEM_LIMIT).map((t) => `Transport: ${t}`),
    },
    {
      id: "places",
      score: wantPlaces
        ? 5
        : lexicalScore(
            userMessage,
            guide.places.map((v) => v.title).join(" "),
          ),
      render: () =>
        guide.places.slice(0, GUIDE_ITEM_LIMIT).map((v) => `Place video: ${v.title}`),
    },
  ];

  const ranked = categories
    .filter((c) => c.score > 0 || intents.guide)
    .sort((a, b) => b.score - a.score);

  const picked = (ranked.length ? ranked : intents.guide ? categories.slice(0, 2) : []).slice(
    0,
    intents.guide ? 3 : 2,
  );
  if (!picked.length) return null;

  const lines = picked.flatMap((c) => c.render()).filter(Boolean);
  if (!lines.length) return null;
  return [`Guide data (${destination}) — matching categories:`, ...lines].join("\n");
}

function guideEssentialsHay(guide: TravelGuidesBundle): string {
  return [
    guide.essentials.weather,
    guide.essentials.language,
    guide.essentials.currency,
    guide.essentials.fashion,
    ...guide.essentials.tips,
  ].join(" ");
}

function selectMatchedItinerary(
  companion: TripCompanionContext,
  userMessage: string,
  intents: IntentFlags,
): string | null {
  // Companion already ships today's itinerary. Add message-matched nearby/other items
  // when the user asks about schedule or names a place/activity.
  const candidates = companion.nearbyActivities.filter((n) => n.source === "itinerary");
  if (!candidates.length) return null;

  const scored = candidates
    .map((n) => ({
      ...n,
      score: lexicalScore(userMessage, `${n.title} ${n.detail ?? ""}`),
    }))
    .filter((n) => n.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, ITINERARY_MATCH_LIMIT);

  if (!scored.length) {
    if (!intents.itinerary) return null;
    return null;
  }

  const lines = scored.map((n) => {
    const detail = n.detail ? ` — ${n.detail}` : "";
    return `- ${n.title}${detail}`;
  });
  return [`Itinerary matches (beyond today):`, ...lines].join("\n");
}

function assembleSections(
  sections: Array<Omit<ContextSection, "chars" | "included"> & { priority: number; cap: number }>,
  budget: number,
): ContextSection[] {
  const sorted = [...sections].sort((a, b) => a.priority - b.priority);
  let remaining = budget;
  const out: ContextSection[] = [];

  for (const section of sorted) {
    const clipped = clip(section.text, section.cap);
    if (!clipped) {
      out.push({
        id: section.id,
        title: section.title,
        text: "",
        chars: 0,
        included: false,
        reason: section.reason,
      });
      continue;
    }
    if (clipped.length > remaining && remaining < 120) {
      out.push({
        id: section.id,
        title: section.title,
        text: "",
        chars: 0,
        included: false,
        reason: `${section.reason} (dropped: over budget)`,
      });
      continue;
    }
    const text = clipped.length <= remaining ? clipped : clip(clipped, remaining);
    remaining -= text.length;
    out.push({
      id: section.id,
      title: section.title,
      text,
      chars: text.length,
      included: true,
      reason: section.reason,
    });
  }

  return out;
}

/**
 * Build optimized chat context for a single AI completion.
 * Soft-fails individual trip slices so chat still works when a table is missing.
 */
export async function buildChatContext(
  input: BuildChatContextInput,
): Promise<BuiltChatContext> {
  const userMessage = input.userMessage?.trim() ?? "";
  const tripId = typeof input.tripId === "string" ? input.tripId.trim() : "";
  const intents = detectIntents(userMessage);
  const tripScoped = Boolean(tripId);

  let companion: TripCompanionContext | null = input.companion ?? null;
  let tripMemory: TripMemoryFields | null = input.tripMemory ?? null;

  if (tripScoped && !companion && !input.skipCompanion) {
    try {
      companion = await loadTripCompanionContext(input.supabase, tripId, {
        nearbyLimit: intents.itinerary || intents.guide ? 8 : 5,
      });
    } catch {
      companion = null;
    }
  }

  if (tripScoped && !tripMemory) {
    try {
      // Prefer companion's trip memory when already loaded.
      if (companion?.tripMemory && tripMemoryHasValues(companion.tripMemory)) {
        tripMemory = companion.tripMemory;
      } else {
        const loaded = await loadTripMemory(input.supabase, tripId);
        tripMemory = tripMemoryHasValues(loaded) ? loaded : null;
      }
    } catch {
      tripMemory = null;
    }
  }

  const draft: Array<
    Omit<ContextSection, "chars" | "included"> & { priority: number; cap: number }
  > = [];

  // Conversation memory — always when provided (standalone + trip).
  if (input.conversationMemory) {
    draft.push({
      id: "conversation_memory",
      title: "Conversation memory",
      text: formatMemoryForPrompt(input.conversationMemory),
      reason: "always (provided by route)",
      priority: 10,
      cap: CONTEXT_SECTION_CAPS.conversationMemory,
    });
  }

  if (companion) {
    // Avoid duplicating trip memory inside companion when we emit a dedicated section.
    const companionForPrompt: TripCompanionContext = tripMemory
      ? { ...companion, tripMemory: null }
      : companion;
    draft.push({
      id: "companion",
      title: "Trip companion",
      text: formatCompanionContextForPrompt(companionForPrompt),
      reason: "trip-scoped live snapshot",
      priority: 20,
      cap: CONTEXT_SECTION_CAPS.companion,
    });
  }

  if (tripMemory && tripMemoryHasValues(tripMemory)) {
    draft.push({
      id: "trip_memory",
      title: "Trip memory",
      text: formatTripMemoryForPrompt(tripMemory),
      reason: "trip preferences (compact)",
      priority: 25,
      cap: CONTEXT_SECTION_CAPS.tripMemory,
    });
  }

  if (tripScoped) {
    // Members — compact list always (small).
    try {
      const membersText = await loadMembersSlice(input.supabase, tripId);
      if (membersText) {
        draft.push({
          id: "members",
          title: "Members",
          text: membersText,
          reason: intents.members ? "members intent" : "compact always-on",
          priority: intents.members ? 30 : 55,
          cap: CONTEXT_SECTION_CAPS.members,
        });
      }
    } catch {
      // ignore
    }

    // Expenses — totals always; detail when intent / lexical match.
    try {
      const expensesText = await loadExpensesSlice(
        input.supabase,
        tripId,
        userMessage,
        intents.expenses,
      );
      if (expensesText) {
        draft.push({
          id: "expenses",
          title: "Expenses",
          text: expensesText,
          reason: intents.expenses ? "expenses intent" : "totals / matched",
          priority: intents.expenses ? 35 : 60,
          cap: CONTEXT_SECTION_CAPS.expenses,
        });
      }
    } catch {
      // ignore
    }

    // Documents — only when intent or filename match.
    try {
      const docsText = await loadDocumentsSlice(
        input.supabase,
        tripId,
        userMessage,
        intents.documents,
      );
      if (docsText) {
        draft.push({
          id: "documents",
          title: "Documents",
          text: docsText,
          reason: intents.documents ? "documents intent" : "filename match",
          priority: 40,
          cap: CONTEXT_SECTION_CAPS.documents,
        });
      }
    } catch {
      // ignore
    }

    // Guide — matching categories only.
    const guideDestination =
      companion?.destination ||
      (typeof input.destinationHint === "string" ? input.destinationHint.trim() : "");
    if (guideDestination) {
      const guideText = selectGuideSlice(guideDestination, userMessage, intents);
      if (guideText) {
        draft.push({
          id: "guide",
          title: "Guide",
          text: guideText,
          reason: intents.guide ? "guide intent" : "category lexical match",
          priority: intents.guide ? 45 : 65,
          cap: CONTEXT_SECTION_CAPS.guide,
        });
      }
    }

    // Extra itinerary matches beyond today's companion slice.
    if (companion) {
      const matchText = selectMatchedItinerary(companion, userMessage, intents);
      if (matchText) {
        draft.push({
          id: "itinerary_match",
          title: "Itinerary matches",
          text: matchText,
          reason: "message-matched activities",
          priority: 50,
          cap: CONTEXT_SECTION_CAPS.itineraryMatch,
        });
      }
    }
  }

  const knowledge = input.knowledgeContext?.trim() ?? "";
  if (knowledge) {
    draft.push({
      id: "knowledge",
      title: "Destination knowledge",
      text: knowledge,
      reason: "RAG retrieve (route)",
      priority: 70,
      cap: CONTEXT_SECTION_CAPS.knowledge,
    });
  }

  const sections = assembleSections(draft, CONTEXT_TOTAL_CHAR_BUDGET);
  const included = sections.filter((s) => s.included && s.text);
  const promptBlock = included
    .map((s) => `${s.title}:\n${s.text}`)
    .join("\n\n");

  return {
    promptBlock,
    sections,
    charsUsed: promptBlock.length,
    tripScoped,
    companion,
    tripMemory,
  };
}

export type ChatRetrievalMode = "full" | "trip_slices";

/**
 * `/api/chat` helper: conversation memory + companion formatting + knowledge RAG
 * stay in `buildChatSystemPrompt`. This returns trip retrieval slices only
 * (expenses / docs / members / guide / itinerary matches / trip memory), plus the
 * loaded companion for the prompt layer.
 *
 * Use `mode: "full"` for assistant-chat (self-contained compact block).
 */
export async function buildChatRetrievalContext(
  input: BuildChatContextInput & { mode?: ChatRetrievalMode },
): Promise<BuiltChatContext> {
  const mode = input.mode ?? "trip_slices";
  const built = await buildChatContext({
    ...input,
    conversationMemory: mode === "full" ? input.conversationMemory : null,
    // Knowledge stays in buildChatSystemPrompt for streaming chat.
    knowledgeContext: mode === "full" ? input.knowledgeContext : null,
  });

  if (mode === "full") return built;

  // Trip-slices mode: drop sections already rendered by buildChatSystemPrompt.
  const skip = new Set<ContextSectionId>([
    "conversation_memory",
    "companion",
    "knowledge",
    // Trip memory is injected via memory layers in buildChatSystemPrompt.
    "trip_memory",
  ]);

  const kept = built.sections.filter((s) => s.included && s.text && !skip.has(s.id));
  const promptBlock = kept.map((s) => `${s.title}:\n${s.text}`).join("\n\n");

  return {
    ...built,
    promptBlock,
    sections: built.sections.map((s) =>
      skip.has(s.id) ? { ...s, included: false, text: "", chars: 0, reason: `${s.reason} (owned by prompt layers)` } : s,
    ),
    charsUsed: promptBlock.length,
  };
}
