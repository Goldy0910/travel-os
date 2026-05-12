import { NextRequest, NextResponse } from "next/server";

const MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-1.5-flash"] as const;
const TRANSIENT_ERROR_TEXT =
  "Translation service is busy right now. Please try again in a few seconds.";

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

function parseTranslationJson(raw: string): {
  translated: string;
  pronunciation: string | null;
  back_translation: string;
} | null {
  const cleaned = raw.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return null;
    }
  }

  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;

  const translated = typeof o.translated === "string" ? o.translated.trim() : "";
  if (!translated) return null;

  let pronunciation: string | null = null;
  if (o.pronunciation === null || o.pronunciation === undefined) {
    pronunciation = null;
  } else if (typeof o.pronunciation === "string") {
    const p = o.pronunciation.trim();
    pronunciation = p.length === 0 ? null : p;
  }

  const backRaw =
    typeof o.back_translation === "string"
      ? o.back_translation.trim()
      : typeof o.backTranslation === "string"
        ? o.backTranslation.trim()
        : "";
  const back_translation = backRaw || translated;

  return { translated, pronunciation, back_translation };
}

export async function POST(req: NextRequest) {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured." }, { status: 503 });
  }

  let body: { text?: unknown; targetLanguage?: unknown; sourceLanguage?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const targetLanguage =
    typeof body.targetLanguage === "string" ? body.targetLanguage.trim() : "";
  if (!targetLanguage) {
    return NextResponse.json({ error: "targetLanguage is required" }, { status: 400 });
  }

  const sourceLanguage =
    typeof body.sourceLanguage === "string" && body.sourceLanguage.trim()
      ? body.sourceLanguage.trim()
      : "auto (infer from the text)";

  const prompt = `You are a professional translator.

Translate the following text.
- Source language: ${sourceLanguage}
- Target language: ${targetLanguage}

Return ONLY a single JSON object (no markdown fences, no commentary) with exactly these keys:
- "translated": string — the translation in the target language
- "pronunciation": string or null — if the translated text uses a non-Latin script, provide a clear romanization; if the target language is typically written in Latin script, use null
- "back_translation": string — translate your "translated" value back into English to help verify the meaning is preserved

Text to translate (as a JSON string for safety):
${JSON.stringify(text)}`;

  let sawBusyError = false;
  let lastHttpStatus = 502;
  let lastErrorMessage = "Translation failed";

  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1024,
            responseMimeType: "application/json",
          },
        }),
      });

      const data: unknown = await response.json().catch(() => null);
      const apiErr = geminiErrorMessage(data);
      const combinedErr = (apiErr || `HTTP ${response.status}`).toLowerCase();
      const isBusy = response.status === 429 || response.status >= 500 || combinedErr.includes("high demand");

      if (!response.ok || apiErr) {
        lastHttpStatus =
          response.status >= 400 && response.status < 600 ? response.status : 502;
        lastErrorMessage = apiErr || `HTTP ${response.status}`;
        if (isBusy) {
          sawBusyError = true;
          if (attempt === 0) {
            await new Promise((resolve) => setTimeout(resolve, 350));
            continue;
          }
          break;
        }
        break;
      }

      const rawText = extractText(data);
      if (!rawText) {
        lastHttpStatus = 502;
        lastErrorMessage = "Empty response from model";
        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 250));
          continue;
        }
        break;
      }

      const result = parseTranslationJson(rawText);
      if (!result) {
        lastHttpStatus = 502;
        lastErrorMessage = "Could not parse translation JSON from model";
        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 250));
          continue;
        }
        break;
      }

      return NextResponse.json(result);
    }
  }

  if (sawBusyError) {
    return NextResponse.json({ error: TRANSIENT_ERROR_TEXT }, { status: 503 });
  }

  return NextResponse.json(
    {
      error: lastErrorMessage,
    },
    { status: lastHttpStatus },
  );
}
