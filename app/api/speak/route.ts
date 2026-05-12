import { NextRequest, NextResponse } from "next/server";

/** Language display name (any casing) → BCP-47 for Cloud Text-to-Speech */
const LANGUAGE_TO_BCP47: Record<string, string> = {
  japanese: "ja-JP",
  french: "fr-FR",
  spanish: "es-ES",
  german: "de-DE",
  italian: "it-IT",
  chinese: "zh-CN",
  korean: "ko-KR",
  thai: "th-TH",
  hindi: "hi-IN",
  arabic: "ar-XA",
  vietnamese: "vi-VN",
  indonesian: "id-ID",
  portuguese: "pt-BR",
  russian: "ru-RU",
  turkish: "tr-TR",
  greek: "el-GR",
  dutch: "nl-NL",
  tamil: "ta-IN",
  telugu: "te-IN",
};

const MAX_TEXT_LENGTH = 5000;

function resolveBcp47(language: string): string | null {
  const key = language.trim().toLowerCase();
  if (!key) return null;
  return LANGUAGE_TO_BCP47[key] ?? null;
}

function ttsErrorMessage(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const err = (data as { error?: { message?: string; status?: string } }).error;
  if (!err || typeof err !== "object") return null;
  const msg = err.message;
  return typeof msg === "string" && msg.trim() ? msg.trim() : null;
}

export async function POST(req: NextRequest) {
  const key = process.env.GOOGLE_TTS_API_KEY?.trim();
  if (!key) {
    return NextResponse.json({ error: "GOOGLE_TTS_API_KEY is not configured." }, { status: 503 });
  }

  let body: { text?: unknown; language?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json(
      { error: `text must be at most ${MAX_TEXT_LENGTH} characters` },
      { status: 400 },
    );
  }

  const languageRaw = typeof body.language === "string" ? body.language : "";
  const languageCode = resolveBcp47(languageRaw);
  if (!languageCode) {
    return NextResponse.json(
      {
        error: `Unsupported language: "${languageRaw}". Use one of: ${Object.keys(LANGUAGE_TO_BCP47)
          .map((k) => k.charAt(0).toUpperCase() + k.slice(1))
          .join(", ")}`,
      },
      { status: 400 },
    );
  }

  const url = "https://texttospeech.googleapis.com/v1/text:synthesize";
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key,
    },
    body: JSON.stringify({
      input: { text },
      voice: {
        languageCode,
        ssmlGender: "NEUTRAL",
      },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: 1.0,
      },
    }),
  });

  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const msg = ttsErrorMessage(data) || `HTTP ${response.status}`;
    return NextResponse.json(
      { error: msg },
      { status: response.status >= 400 && response.status < 600 ? response.status : 502 },
    );
  }

  const audioContent =
    data && typeof data === "object" && "audioContent" in data
      ? (data as { audioContent?: unknown }).audioContent
      : undefined;

  if (typeof audioContent !== "string" || !audioContent.length) {
    return NextResponse.json({ error: "No audio returned from Text-to-Speech" }, { status: 502 });
  }

  return NextResponse.json({ audio: audioContent });
}
