import { NextRequest, NextResponse } from "next/server";

const MODEL = "gemini-2.5-flash";

const CATEGORY_ORDER = [
  "Greetings",
  "Getting Around",
  "Food & Ordering",
  "Shopping",
  "Emergency & Health",
  "Accommodation",
  "Numbers",
  "Polite Expressions",
] as const;

type PhrasebookPhrase = {
  english: string;
  translated: string;
  pronunciation: string;
  tip: string | null;
};

type PhrasebookCategory = {
  category: string;
  phrases: PhrasebookPhrase[];
};

const CATEGORY_LABELS: readonly string[] = CATEGORY_ORDER;

function geminiErrorMessage(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const err = (data as { error?: { message?: string } }).error;
  const msg = err && typeof err.message === "string" ? err.message.trim() : "";
  return msg || null;
}

function extractText(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const root = data as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    promptFeedback?: { blockReason?: string };
  };
  if (root.promptFeedback?.blockReason) return null;
  const text = root?.candidates?.[0]?.content?.parts?.[0]?.text;
  return typeof text === "string" && text.trim() ? text.trim() : null;
}

function stripJsonFences(raw: string): string {
  return raw.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
}

function normalizeTip(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

function normalizePhrase(raw: unknown): PhrasebookPhrase | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const english = typeof o.english === "string" ? o.english.trim() : "";
  const translated = typeof o.translated === "string" ? o.translated.trim() : "";
  const pronunciation =
    typeof o.pronunciation === "string"
      ? o.pronunciation.trim()
      : o.pronunciation === null || o.pronunciation === undefined
        ? ""
        : "";
  if (!english || !translated) return null;
  return {
    english,
    translated,
    pronunciation: pronunciation || "—",
    tip: normalizeTip(o.tip),
  };
}

function normalizeCategoryName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  return s.length ? s : null;
}

function parsePhrasebookJson(raw: string): PhrasebookCategory[] | null {
  const cleaned = stripJsonFences(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) return null;
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return null;
    }
  }

  if (!Array.isArray(parsed)) return null;

  const byName = new Map<string, PhrasebookCategory>();

  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const category =
      normalizeCategoryName(o.category) ??
      normalizeCategoryName(o.categoryName) ??
      normalizeCategoryName(o.name);
    if (!category) continue;

    const phrasesRaw = o.phrases;
    if (!Array.isArray(phrasesRaw)) continue;

    const phrases: PhrasebookPhrase[] = [];
    for (const p of phrasesRaw) {
      const ph = normalizePhrase(p);
      if (ph) phrases.push(ph);
    }

    if (phrases.length === 0) continue;

    const existing = byName.get(category);
    if (existing) {
      existing.phrases.push(...phrases);
    } else {
      byName.set(category, { category, phrases });
    }
  }

  const ordered: PhrasebookCategory[] = [];
  for (const name of CATEGORY_ORDER) {
    const row = byName.get(name);
    if (row) ordered.push(row);
  }
  for (const [, row] of byName) {
    if (!CATEGORY_LABELS.includes(row.category)) {
      ordered.push(row);
    }
  }

  return ordered.length > 0 ? ordered : null;
}

export async function POST(req: NextRequest) {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured." }, { status: 503 });
  }

  let body: { language?: unknown; destination?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const language = typeof body.language === "string" ? body.language.trim() : "";
  const destination = typeof body.destination === "string" ? body.destination.trim() : "";

  if (!language) {
    return NextResponse.json({ error: "language is required" }, { status: 400 });
  }
  if (!destination) {
    return NextResponse.json({ error: "destination is required" }, { status: 400 });
  }

  const categoryList = CATEGORY_ORDER.map((c, i) => `${i + 1}. ${c}`).join("\n");

  const prompt = `You are a travel language coach. Generate a practical phrasebook for a traveler.

Context:
- Destination / region: ${destination}
- Language to learn (how locals communicate): ${language}

Return ONLY a JSON array (no markdown, no commentary). Root value must be an array of objects. Each object has:
- "category": string — must be EXACTLY one of these labels (match spelling and punctuation):
${categoryList}
- "phrases": array of objects, each with:
  - "english": string (the English phrase)
  - "translated": string (natural translation in the target language)
  - "pronunciation": string (simple romanization; if the language uses Latin script, approximate syllable stress or use the same as "translated")
  - "tip": string or null (short cultural or usage note, or null)

Rules:
- Include every category listed above exactly once, in that order in the array.
- Provide 4–6 useful phrases per category except "Numbers", which should cover 1–10 (and optionally "how much?", "half") as appropriate.
- Phrases should be specific to visiting ${destination} where relevant (transport, food, etiquette).
- Keep tips concise (one line).`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.35,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      },
    }),
  });

  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const msg = geminiErrorMessage(data) || `HTTP ${response.status}`;
    return NextResponse.json(
      { error: msg },
      { status: response.status >= 400 && response.status < 600 ? response.status : 502 },
    );
  }

  const apiErr = geminiErrorMessage(data);
  if (apiErr) {
    return NextResponse.json({ error: apiErr }, { status: 502 });
  }

  const rawText = extractText(data);
  if (!rawText) {
    return NextResponse.json({ error: "Empty response from model" }, { status: 502 });
  }

  const categories = parsePhrasebookJson(rawText);
  if (!categories) {
    return NextResponse.json(
      {
        error: "Could not parse phrasebook JSON from model",
        ...(process.env.NODE_ENV === "development" ? { raw: rawText } : {}),
      },
      { status: 502 },
    );
  }

  return NextResponse.json(categories);
}
