import "server-only";

import { GEMINI_GENERATE_MODELS } from "@/lib/ai/gemini-models";
import type { ExtractedPlace } from "@/lib/places/types";

const STOP_NAMES = new Set(
  [
    "you",
    "your",
    "the",
    "this",
    "that",
    "here",
    "there",
    "today",
    "tomorrow",
    "morning",
    "evening",
    "night",
    "breakfast",
    "lunch",
    "dinner",
    "hotel",
    "restaurant",
    "cafe",
    "museum",
    "park",
    "beach",
    "temple",
    "market",
    "attraction",
    "place",
    "city",
    "area",
    "spot",
    "option",
    "options",
    "recommendation",
    "recommendations",
    "definitely",
    "absolutely",
    "google maps",
    "travel os",
    "travel buddy",
    "travel till",
    "travel till 99",
    "travel till99",
  ].map((s) => s.toLowerCase()),
);

const TYPE_HINTS: Array<{ re: RegExp; type: string }> = [
  { re: /\b(restaurant|dining|eatery|bistro)\b/i, type: "restaurant" },
  { re: /\b(cafe|coffee|bakery)\b/i, type: "cafe" },
  { re: /\b(hotel|ryokan|resort|hostel)\b/i, type: "hotel" },
  { re: /\b(museum|gallery)\b/i, type: "museum" },
  { re: /\b(temple|shrine|church|mosque|cathedral)\b/i, type: "temple" },
  { re: /\b(park|garden)\b/i, type: "park" },
  { re: /\b(beach|lagoon|bay)\b/i, type: "beach" },
  { re: /\b(market|bazaar)\b/i, type: "market" },
  { re: /\b(mountain|peak|hill)\b/i, type: "mountain" },
  { re: /\b(lake|river|waterfall)\b/i, type: "lake" },
  { re: /\b(tower|monument|statue|landmark|palace|castle|fort)\b/i, type: "landmark" },
  { re: /\b(national park)\b/i, type: "national_park" },
];

function inferType(name: string, context: string): string {
  const hay = `${name} ${context}`;
  for (const hint of TYPE_HINTS) {
    if (hint.re.test(hay)) return hint.type;
  }
  return "place";
}

function normalizeName(name: string): string {
  return name
    .replace(/^[\s"'“”‘’*\-–—•]+|[\s"'“”‘’*\-–—•.,:;!?]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isPlausiblePlaceName(name: string): boolean {
  const n = normalizeName(name);
  if (n.length < 3 || n.length > 80) return false;
  if (STOP_NAMES.has(n.toLowerCase())) return false;
  if (/^https?:\/\//i.test(n)) return false;
  if (/^\d+$/.test(n)) return false;
  // Prefer multi-word or proper-noun looking tokens
  const words = n.split(" ");
  if (words.length === 1 && n.length < 5) return false;
  if (words.every((w) => w === w.toLowerCase()) && words.length < 2) return false;
  return true;
}

function pushUnique(out: ExtractedPlace[], place: ExtractedPlace) {
  const key = place.name.toLowerCase();
  if (out.some((p) => p.name.toLowerCase() === key)) return;
  if (!isPlausiblePlaceName(place.name)) return;
  out.push({
    name: normalizeName(place.name),
    type: place.type || "place",
    confidence: Math.max(0, Math.min(1, place.confidence)),
  });
}

/**
 * Lightweight heuristic extractor — no LLM required.
 */
export function extractPlacesHeuristic(text: string, limit = 6): ExtractedPlace[] {
  const out: ExtractedPlace[] = [];
  if (!text.trim()) return out;

  // Markdown bold / italic place names
  for (const match of text.matchAll(/\*\*([^*]{2,80})\*\*/g)) {
    const name = normalizeName(match[1] ?? "");
    pushUnique(out, {
      name,
      type: inferType(name, match[0] ?? ""),
      confidence: 0.72,
    });
  }
  for (const match of text.matchAll(/"([^"]{2,80})"|“([^”]{2,80})”/g)) {
    const name = normalizeName(match[1] || match[2] || "");
    pushUnique(out, {
      name,
      type: inferType(name, match[0] ?? ""),
      confidence: 0.7,
    });
  }

  // Phrases after recommend / visit / try / near / see / check out
  const cueRe =
    /\b(?:visit|try|see|tour|explore|check out|head to|go to|stay at|eat at|stop by|don't miss|do not miss|recommend(?:ing)?)\s+([A-Z][\w''&.-]*(?:\s+[A-Z][\w''&.-]*){0,5})/g;
  for (const match of text.matchAll(cueRe)) {
    const name = normalizeName(match[1] ?? "");
    pushUnique(out, {
      name,
      type: inferType(name, match[0] ?? ""),
      confidence: 0.78,
    });
  }

  // Title-case runs (e.g. Tokyo Tower, Marina Bay Sands)
  const titleRe =
    /\b([A-Z][a-zA-Z''&.-]{1,}(?:\s+(?:(?:of|the|and|de|da|di|del|la|le|van|von)\s+)?[A-Z][a-zA-Z''&.-]{1,}){0,5})\b/g;
  for (const match of text.matchAll(titleRe)) {
    const name = normalizeName(match[1] ?? "");
    // Skip sentence-leading single common words already filtered; require 2+ words or known landmark shape
    const words = name.split(" ");
    if (words.length < 2 && !/(tower|museum|park|temple|beach|market|palace|castle|fort|bridge|square|garden|lagoon|falls)$/i.test(name)) {
      continue;
    }
    pushUnique(out, {
      name,
      type: inferType(name, ""),
      confidence: words.length >= 2 ? 0.62 : 0.5,
    });
  }

  return out
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit);
}

async function extractPlacesWithGemini(
  text: string,
  limit: number,
  signal?: AbortSignal,
): Promise<ExtractedPlace[] | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;

  const prompt = `Extract real-world places (attractions, restaurants, cafes, hotels, landmarks, cities, beaches, museums, parks, markets, temples) mentioned as recommendations or destinations in the assistant message below.

Return ONLY JSON:
{"places":[{"name":"string","type":"restaurant|cafe|hotel|museum|temple|park|beach|market|landmark|city|attraction|place","confidence":0.0}]}

Rules:
- Max ${limit} places
- Only concrete named places (e.g. "Tokyo Tower"), not generic words
- confidence 0-1
- If none, {"places":[]}

Message:
"""
${text.slice(0, 6000)}
"""`;

  for (const model of GEMINI_GENERATE_MODELS.slice(0, 2)) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      const onAbort = () => controller.abort();
      signal?.addEventListener("abort", onAbort, { once: true });

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 512,
              responseMimeType: "application/json",
            },
          }),
          signal: controller.signal,
        },
      ).finally(() => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
      });

      if (!response.ok) continue;
      const data = (await response.json().catch(() => null)) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      } | null;
      const raw = data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      if (!raw.trim()) continue;
      const parsed = JSON.parse(raw) as { places?: unknown };
      if (!Array.isArray(parsed.places)) continue;

      const out: ExtractedPlace[] = [];
      for (const item of parsed.places) {
        if (!item || typeof item !== "object") continue;
        const row = item as { name?: unknown; type?: unknown; confidence?: unknown };
        if (typeof row.name !== "string") continue;
        pushUnique(out, {
          name: row.name,
          type: typeof row.type === "string" ? row.type : "place",
          confidence: typeof row.confidence === "number" ? row.confidence : 0.8,
        });
      }
      return out.slice(0, limit);
    } catch {
      // try next model / fall through
    }
  }
  return null;
}

/**
 * Place extraction for chat: prefer structured Gemini JSON, fall back to heuristics.
 */
export async function extractPlacesFromAssistantText(
  text: string,
  options?: { limit?: number; signal?: AbortSignal },
): Promise<ExtractedPlace[]> {
  const limit = options?.limit ?? 6;
  if (!text.trim()) return [];

  const structured = await extractPlacesWithGemini(text, limit, options?.signal);
  if (structured && structured.length > 0) return structured;

  return extractPlacesHeuristic(text, limit);
}
