import { getStaticPhrasebook } from "@/lib/phrasebook-static";
import type { PhraseCategory } from "@/lib/phrasebook-static/types";
import { unstable_cache } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

async function fetchGeminiPhrasebook(language: string, destination: string): Promise<PhraseCategory[]> {
  const prompt = `Generate a comprehensive travel phrasebook for someone visiting ${destination} where people speak ${language}.

Return ONLY a JSON array. No markdown, no explanation. Format:
[
  {
    "category": "Greetings",
    "phrases": [
      {
        "english": "Hello",
        "translated": "local language text",
        "pronunciation": "how to pronounce in roman script",
        "tip": "cultural tip about using this phrase or null"
      }
    ]
  }
]

Include these categories with 4-6 phrases each:
1. Greetings
2. Getting Around (directions, transport)
3. Food & Ordering
4. Shopping & Bargaining
5. Emergency & Health
6. Accommodation
7. Numbers (1-10)
8. Polite Expressions

Make pronunciation guides very simple for a non-native speaker.`;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 3000 },
      }),
    },
  );

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw || typeof raw !== "string") {
    throw new Error("Empty Gemini response");
  }
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(cleaned) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("Invalid phrasebook shape");
  }
  return parsed as PhraseCategory[];
}

const cachedGeminiPhrasebook = unstable_cache(
  async (language: string, destination: string) => fetchGeminiPhrasebook(language, destination),
  ["travel-os-phrasebook-gemini"],
  { revalidate: 60 * 60 * 24 * 7 },
);

export async function POST(req: NextRequest) {
  let body: { language?: string; destination?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ categories: [], source: "error" as const }, { status: 400 });
  }

  const language = typeof body.language === "string" ? body.language.trim() : "English";
  const destination = typeof body.destination === "string" ? body.destination.trim() : "";

  const staticPb = getStaticPhrasebook(language);
  if (staticPb) {
    return NextResponse.json({ categories: staticPb, source: "static" as const });
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { categories: [], source: "error" as const, error: "Phrasebook unavailable (no AI key)." },
      { status: 503 },
    );
  }

  try {
    const categories = await cachedGeminiPhrasebook(language, destination || "your destination");
    return NextResponse.json({ categories, source: "generated_cached" as const });
  } catch {
    return NextResponse.json({ categories: [], source: "error" as const }, { status: 500 });
  }
}
