import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { language, destination } = await req.json();

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

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 3000 },
      }),
    }
  );

  const data = await response.json();
  try {
    const raw = data.candidates[0].content.parts[0].text;
    const cleaned = raw.replace(/```json|```/g, "").trim();
    return NextResponse.json({ categories: JSON.parse(cleaned) });
  } catch {
    return NextResponse.json({ categories: [] }, { status: 500 });
  }
}
