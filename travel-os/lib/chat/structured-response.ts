/**
 * Structured chat output: user-facing text + typed entities for rich UI.
 * Prefer model-emitted entities over post-hoc NLP/regex extraction.
 */

export const CHAT_ENTITY_TYPES = [
  "place",
  "attraction",
  "landmark",
  "restaurant",
  "cafe",
  "hotel",
  "museum",
  "temple",
  "park",
  "beach",
  "market",
  "city",
  "airport",
  "activity",
] as const;

export type ChatEntityType = (typeof CHAT_ENTITY_TYPES)[number] | string;

export type ChatEntity = {
  type: ChatEntityType;
  name: string;
};

export type StructuredChatResponse = {
  response: string;
  entities: ChatEntity[];
};

/** Gemini responseSchema for generateContent / streamGenerateContent. */
export const CHAT_STRUCTURED_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    response: {
      type: "STRING",
      description: "Markdown reply shown to the traveler. Do not include entity JSON here.",
    },
    entities: {
      type: "ARRAY",
      description:
        "Typed real-world entities mentioned as recommendations or destinations in the reply.",
      items: {
        type: "OBJECT",
        properties: {
          type: {
            type: "STRING",
            description:
              "One of: place, attraction, landmark, restaurant, cafe, hotel, museum, temple, park, beach, market, city, airport, activity",
          },
          name: {
            type: "STRING",
            description: "Concrete proper name, e.g. Tokyo Tower",
          },
        },
        required: ["type", "name"],
      },
    },
  },
  required: ["response", "entities"],
} as const;

export const STRUCTURED_CHAT_OUTPUT_INSTRUCTION = `When you recommend or name real-world places, return structured JSON so the app can show Google Maps place cards.

Required output shape (JSON only, no markdown fences):
{"response":"Your normal Markdown reply to the traveler.","entities":[{"type":"beach","name":"Palolem Beach"},{"type":"market","name":"Anjuna Flea Market"}]}

Rules:
- "response" is what the traveler reads (friendly Markdown only).
- NEVER wrap place names in XML/HTML tags such as <entity>, <place>, or similar. Write normal prose in "response".
- "entities" MUST list every concrete place you recommend (beaches, restaurants, cafes, hotels, markets, churches, landmarks, neighborhoods). Use precise proper names (e.g. "Palolem Beach", not "the beach").
- Prefer specific venues/areas over the whole destination city when recommending highlights.
- When the reply is about destinations other than the user's current city, entities MUST be places in those destinations. Do not list restaurants, cafes, or sights in the user's home city.
- Qualify venue names with the destination when comparing places, e.g. "Abbey Falls, Coorg" or "Edakkal Caves, Wayanad".
- When listing recommended places, use the EXACT same proper names in the Markdown as in "entities" so the app can link them. Write clear readable prose first; place preview cards are shown separately under the reply.
- If none, use "entities":[].
- Greetings, chitchat, capability intros, and replies with no concrete place recommendations MUST use "entities":[].
- NEVER put product, brand, or assistant role names in entities (e.g. "Travel Buddy", "Travel Till", "Travel Till 99", "Travel OS").
- If you cannot emit JSON, write a normal Markdown reply with NO <entity> tags.`;

const PLACE_LIKE = new Set([
  "place",
  "attraction",
  "landmark",
  "restaurant",
  "cafe",
  "hotel",
  "museum",
  "temple",
  "park",
  "beach",
  "market",
  "city",
  "airport",
  "activity",
  "national_park",
  "church",
  "neighborhood",
  "area",
]);

/** Product / assistant phrases the model sometimes mis-emits as place entities. */
const BLOCKED_CHAT_ENTITY_NAMES = new Set(
  [
    "travel buddy",
    "travel till",
    "travel till 99",
    "travel till99",
    "traveltill99",
    "travel os",
    "travelos",
    "ai travel buddy",
    "your travel buddy",
  ].map((s) => s.toLowerCase()),
);

const BLOCKED_CHAT_ENTITY_NAME_RE =
  /^(?:my |your |the )?(?:ai )?travel(?:\s|-)?(?:buddy|till(?:\s*99)?|os)\b/i;

export function isBlockedChatEntityName(name: string): boolean {
  const n = name.replace(/\s+/g, " ").trim().toLowerCase();
  if (!n) return true;
  if (BLOCKED_CHAT_ENTITY_NAMES.has(n)) return true;
  if (BLOCKED_CHAT_ENTITY_NAME_RE.test(n)) return true;
  return false;
}

/** Drop non-place / product names before Google place-card enrichment. */
export function filterEntitiesForPlaceCards(entities: ChatEntity[]): ChatEntity[] {
  return entities.filter((entity) => !isBlockedChatEntityName(entity.name));
}

export function isPlaceLikeEntityType(type: string): boolean {
  return PLACE_LIKE.has(type.trim().toLowerCase());
}

/**
 * Extract places from mistaken model markup like <entity>Palolem Beach</entity>.
 */
export function extractEntitiesFromMarkup(text: string): ChatEntity[] {
  if (!text) return [];
  const out: ChatEntity[] = [];
  const seen = new Set<string>();
  const patterns = [
    /<entity\b[^>]*>([^<]{2,80})<\/entity>/gi,
    /<place\b[^>]*>([^<]{2,80})<\/place>/gi,
  ];
  for (const re of patterns) {
    for (const match of text.matchAll(re)) {
      const name = (match[1] ?? "").replace(/\s+/g, " ").trim();
      if (name.length < 2) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ type: "place", name });
    }
  }
  return out;
}

/** Remove <entity>…</entity> (and similar) tags; keep the inner place name. */
export function stripEntityMarkup(text: string): string {
  if (!text) return text;
  return text
    .replace(/<\/?(?:entity|place)\b[^>]*>/gi, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function mergeChatEntities(...lists: ChatEntity[][]): ChatEntity[] {
  const out: ChatEntity[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    for (const entity of list) {
      const name = entity.name.trim();
      if (name.length < 2 || isBlockedChatEntityName(name)) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        type: entity.type || "place",
        name,
      });
    }
  }
  return out;
}

export function normalizeChatEntities(raw: unknown): ChatEntity[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatEntity[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as { type?: unknown; name?: unknown };
    const name = typeof row.name === "string" ? row.name.trim() : "";
    const type = typeof row.type === "string" ? row.type.trim().toLowerCase() : "place";
    if (name.length < 2 || name.length > 120 || isBlockedChatEntityName(name)) continue;
    const key = `${type}:${name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ type: type || "place", name });
  }
  return out;
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match?.[1]?.trim() || trimmed;
}

/** Extract a balanced `{ ... }` object starting at `start` (must point at `{`). */
function extractBalancedJsonObject(text: string, start: number): string | null {
  if (text[start] !== "{") return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const c = text[i]!;
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (c === "\\") {
        escaped = true;
        continue;
      }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "{") depth += 1;
    else if (c === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function isStructuredEnvelope(obj: unknown): obj is {
  response?: unknown;
  entities?: unknown;
  message?: unknown;
  text?: unknown;
} {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.response === "string" ||
    typeof o.message === "string" ||
    typeof o.text === "string" ||
    Array.isArray(o.entities)
  );
}

/**
 * Find a `{response, entities}` JSON payload even when the model prepends
 * plain prose or appends the envelope at the end of the reply.
 */
export function findStructuredChatJsonPayload(raw: string): string | null {
  const text = stripCodeFence(raw);
  if (!text) return null;

  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}") && /"response"\s*:/.test(trimmed)) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (isStructuredEnvelope(parsed)) return trimmed;
    } catch {
      /* fall through to scan */
    }
  }

  // Scan for "response" keys and walk back to the opening brace
  const marker = '"response"';
  let searchFrom = 0;
  let best: string | null = null;
  while (searchFrom < text.length) {
    const idx = text.indexOf(marker, searchFrom);
    if (idx < 0) break;
    let start = idx;
    while (start > 0 && text[start] !== "{") start -= 1;
    if (text[start] === "{") {
      const slice = extractBalancedJsonObject(text, start);
      if (slice) {
        try {
          const parsed: unknown = JSON.parse(slice);
          if (isStructuredEnvelope(parsed)) best = slice;
        } catch {
          /* keep scanning */
        }
      }
    }
    searchFrom = idx + marker.length;
  }
  return best;
}

/** Remove leftover structured JSON envelopes from mixed prose+JSON model output. */
export function stripStructuredJsonArtifacts(raw: string): string {
  if (!raw) return "";
  let text = raw;
  const payload = findStructuredChatJsonPayload(text);
  if (payload) {
    text = text.split(payload).join("");
  }
  // Catch truncated / pretty-printed leftovers that still show keys
  text = text.replace(
    /\{[\s\S]*?"response"\s*:\s*"[\s\S]*?"entities"\s*:\s*\[[\s\S]*\]\s*\}/g,
    "",
  );
  text = text.replace(/```(?:json)?\s*\{[\s\S]*?"entities"\s*:[\s\S]*?\}\s*```/gi, "");
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

/** True when text looks like our {response, entities} (or close) JSON payload. */
export function looksLikeStructuredChatJson(raw: string): boolean {
  const text = stripCodeFence(raw).trim();
  if (!text.startsWith("{")) return false;
  if (!/"response"\s*:/.test(text) && !/"entities"\s*:/.test(text)) return false;
  // Prefer complete objects; incomplete streams are handled by extractJsonStringFieldProgress
  if (text.endsWith("}")) return true;
  return text.includes('"response"');
}

function envelopeToStructured(parsed: {
  response?: unknown;
  entities?: unknown;
  message?: unknown;
  text?: unknown;
}): StructuredChatResponse | null {
  const responseRaw =
    (typeof parsed.response === "string" && parsed.response) ||
    (typeof parsed.message === "string" && parsed.message) ||
    (typeof parsed.text === "string" && parsed.text) ||
    "";
  if (!responseRaw && !Array.isArray(parsed.entities)) return null;
  const markupEntities = extractEntitiesFromMarkup(responseRaw);
  const jsonEntities = normalizeChatEntities(parsed.entities);
  return {
    response: stripEntityMarkup(responseRaw || ""),
    entities: mergeChatEntities(jsonEntities, markupEntities),
  };
}

/**
 * Parse model output into response + entities.
 * Accepts strict JSON, prose+JSON mixes, or plain text (entities empty).
 * Also recovers entities from mistaken <entity> markup and strips those tags from response.
 */
export function parseStructuredChatResponse(raw: string): StructuredChatResponse {
  const text = stripCodeFence(raw);
  if (!text) return { response: "", entities: [] };

  const payload = findStructuredChatJsonPayload(text);
  if (payload) {
    try {
      const parsed = JSON.parse(payload) as {
        response?: unknown;
        entities?: unknown;
        message?: unknown;
        text?: unknown;
      };
      const structured = envelopeToStructured(parsed);
      if (structured) return structured;
    } catch {
      const partial = extractJsonStringFieldProgress(payload, "response");
      if (partial) {
        return {
          response: stripEntityMarkup(partial),
          entities: extractEntitiesFromMarkup(partial),
        };
      }
    }
  }

  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    const partial = extractJsonStringFieldProgress(trimmed, "response");
    if (partial) {
      return {
        response: stripEntityMarkup(partial),
        entities: extractEntitiesFromMarkup(partial),
      };
    }
  }

  const cleaned = stripStructuredJsonArtifacts(trimmed);
  const markupEntities = extractEntitiesFromMarkup(cleaned);
  return {
    response: stripEntityMarkup(cleaned),
    entities: markupEntities,
  };
}

/**
 * Safe display text for assistant bubbles (strips accidental JSON envelopes).
 * Safe to call on the client for live + historical messages.
 * Also works mid-stream as the `response` field grows.
 */
export function unwrapAssistantContentForDisplay(raw: string): string {
  if (!raw) return "";
  const parsed = parseStructuredChatResponse(raw);
  if (parsed.response.trim()) {
    // Ensure no leftover envelope leaked into the response string itself
    return stripStructuredJsonArtifacts(stripEntityMarkup(parsed.response));
  }
  const partial = extractJsonStringFieldProgress(raw, "response");
  if (partial) return stripEntityMarkup(partial);
  return stripStructuredJsonArtifacts(stripEntityMarkup(raw));
}

/** Progressively extract a JSON string field value from a growing buffer. */
export function extractJsonStringFieldProgress(raw: string, field: string): string | null {
  const text = stripCodeFence(raw);
  const key = `"${field}"`;
  const idx = text.indexOf(key);
  if (idx < 0) return null;

  let i = idx + key.length;
  while (
    i < text.length &&
    (text[i] === " " ||
      text[i] === "\n" ||
      text[i] === "\r" ||
      text[i] === "\t" ||
      text[i] === ":")
  ) {
    i += 1;
  }
  if (i >= text.length) return null;
  if (text[i] !== '"') return null;
  i += 1;

  let out = "";
  while (i < text.length) {
    const c = text[i]!;
    if (c === "\\") {
      if (i + 1 >= text.length) break;
      const n = text[i + 1]!;
      if (n === "n") out += "\n";
      else if (n === "t") out += "\t";
      else if (n === "r") out += "\r";
      else if (n === '"') out += '"';
      else if (n === "\\") out += "\\";
      else if (n === "/") out += "/";
      else if (n === "u" && i + 5 < text.length) {
        const hex = text.slice(i + 2, i + 6);
        if (/^[0-9a-fA-F]{4}$/.test(hex)) {
          out += String.fromCharCode(parseInt(hex, 16));
          i += 6;
          continue;
        }
        break;
      } else {
        out += n;
      }
      i += 2;
      continue;
    }
    if (c === '"') break;
    out += c;
    i += 1;
  }
  return out;
}

/**
 * Unwraps structured JSON streams so SSE clients only receive `response` text.
 * Plain-text streams pass through until a `{ "response": ... }` envelope appears.
 */
export class StructuredChatStreamDecoder {
  private raw = "";
  private mode: "unknown" | "json" | "plain" = "unknown";
  /** How much of the *visible* response has already been emitted. */
  private emittedVisibleLen = 0;

  private detectMode(buffer: string): "json" | "plain" | "unknown" {
    const lead = buffer.trimStart();
    if (!lead) return "unknown";
    if (lead.startsWith("{")) return "json";
    if (/^```(?:json)?/i.test(lead)) {
      const afterFence = lead.replace(/^```(?:json)?\s*/i, "");
      if (!afterFence) return "unknown";
      return afterFence.trimStart().startsWith("{") ? "json" : "plain";
    }
    return "plain";
  }

  private jsonEnvelopeIndex(buffer: string): number {
    return buffer.search(/\{[\s\n\r]*"response"\s*:/);
  }

  /** Current user-visible text derived from the raw buffer. */
  private visibleText(): string {
    if (this.mode === "json") {
      return extractJsonStringFieldProgress(this.raw, "response") ?? "";
    }
    const jsonAt = this.jsonEnvelopeIndex(this.raw);
    if (jsonAt >= 0) {
      // Prose before envelope — once envelope exists, prefer its response field
      const fromField = extractJsonStringFieldProgress(this.raw, "response");
      if (fromField != null) return fromField;
      return this.raw.slice(0, jsonAt);
    }
    return this.raw;
  }

  /** Feed a model text delta; returns the user-visible delta to forward on SSE. */
  push(delta: string): string {
    if (!delta) return "";
    this.raw += delta;

    if (this.mode === "unknown") {
      this.mode = this.detectMode(this.raw);
      if (this.mode === "unknown") return "";
    }

    // Upgrade plain → json when an envelope appears (model appended JSON after prose)
    if (this.mode === "plain" && this.jsonEnvelopeIndex(this.raw) >= 0) {
      this.mode = "json";
    }

    // Full buffer is a JSON envelope
    if (this.mode === "plain" && looksLikeStructuredChatJson(this.raw.trim())) {
      this.mode = "json";
    }

    const visible = this.visibleText();
    if (visible.length <= this.emittedVisibleLen) return "";
    const out = visible.slice(this.emittedVisibleLen);
    this.emittedVisibleLen = visible.length;
    return out;
  }

  finish(): StructuredChatResponse {
    const parsed = parseStructuredChatResponse(this.raw);
    if (parsed.response || parsed.entities.length > 0) {
      return parsed;
    }
    if (this.mode === "json") {
      const partial = extractJsonStringFieldProgress(this.raw, "response");
      return { response: partial ?? "", entities: [] };
    }
    return {
      response: stripStructuredJsonArtifacts(this.raw),
      entities: [],
    };
  }

  getRaw(): string {
    return this.raw;
  }
}

/** generationConfig fragment for Gemini structured chat replies. */
export function chatStructuredGenerationConfig(extra?: Record<string, unknown>) {
  return {
    temperature: 0.7,
    maxOutputTokens: 2048,
    responseMimeType: "application/json",
    responseSchema: CHAT_STRUCTURED_RESPONSE_SCHEMA,
    ...extra,
  };
}
