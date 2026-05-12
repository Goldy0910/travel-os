import { NextRequest, NextResponse } from "next/server";

const GEMINI_MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-1.5-flash",
] as const;

function extractText(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const root = data as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = root?.candidates?.[0]?.content?.parts?.[0]?.text;
  return typeof text === "string" && text.trim() ? text : null;
}

function geminiErrorMessage(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const err = (data as { error?: { message?: string } }).error;
  const msg = err && typeof err.message === "string" ? err.message.trim() : "";
  return msg || null;
}

export async function POST(req: NextRequest) {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured.", items: [] },
      { status: 503 },
    );
  }

  let body: { imageBase64?: string; targetLanguage?: string; mimeType?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON", items: [] }, { status: 400 });
  }

  const imageBase64 = typeof body.imageBase64 === "string" ? body.imageBase64.trim() : "";
  if (!imageBase64) {
    return NextResponse.json({ error: "imageBase64 is required", items: [] }, { status: 400 });
  }

  const targetLanguage = typeof body.targetLanguage === "string" ? body.targetLanguage : "English";
  const mimeType =
    typeof body.mimeType === "string" && body.mimeType.includes("/")
      ? body.mimeType
      : "image/jpeg";

  const prompt = `This is a photo of a restaurant menu.
Please:
1. Extract all the menu items you can read
2. Translate them to ${targetLanguage}
3. Include the price if visible

Return ONLY a JSON array. No markdown, no explanation. Format:
[
  { "original": "original text", "translated": "translated text", "price": "price or null", "category": "food category" }
]`;

  for (const model of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: mimeType,
                  data: imageBase64,
                },
              },
              { text: prompt },
            ],
          },
        ],
        generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
      }),
    });

    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      continue;
    }
    if (geminiErrorMessage(data)) {
      continue;
    }

    const text = extractText(data);
    if (!text) continue;

    try {
      const cleaned = text.replace(/```json|```/g, "").trim();
      const items = JSON.parse(cleaned) as unknown;
      if (!Array.isArray(items)) continue;
      return NextResponse.json({ items });
    } catch {
      continue;
    }
  }

  return NextResponse.json(
    { error: "Could not translate menu with any Gemini model.", items: [] },
    { status: 502 },
  );
}
