import { unstable_cache } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

/** Maps UI language label (from Language tab) to Google Cloud TTS BCP-47 code. */
const LANGUAGE_CODES: Record<string, string> = {
  Japanese: "ja-JP",
  French: "fr-FR",
  Spanish: "es-ES",
  German: "de-DE",
  Italian: "it-IT",
  Portuguese: "pt-BR",
  Hindi: "hi-IN",
  Arabic: "ar-XA",
  Chinese: "zh-CN",
  Korean: "ko-KR",
  Thai: "th-TH",
  Turkish: "tr-TR",
  Russian: "ru-RU",
  Dutch: "nl-NL",
  Greek: "el-GR",
  Vietnamese: "vi-VN",
  Indonesian: "id-ID",
  Malay: "ms-MY",
  Tamil: "ta-IN",
  Telugu: "te-IN",
  Malayalam: "ml-IN",
  Odia: "or-IN",
  English: "en-US",
};

async function synthesizeWithGoogle(text: string, languageCode: string): Promise<string> {
  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GOOGLE_TTS_API_KEY");
  }

  const response = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode, ssmlGender: "NEUTRAL" },
        audioConfig: { audioEncoding: "MP3" },
      }),
    },
  );

  const data = (await response.json()) as { audioContent?: string; error?: { message?: string } };
  if (data.audioContent) {
    return data.audioContent;
  }
  throw new Error(data.error?.message || "TTS failed");
}

/** Long-lived cache: same phrase + language hits memory/data cache instead of Google TTS billing. */
const cachedSynthesize = unstable_cache(
  async (text: string, languageCode: string) => synthesizeWithGoogle(text, languageCode),
  ["travel-os-tts"],
  { revalidate: 60 * 60 * 24 * 365 },
);

export async function POST(req: NextRequest) {
  let body: { text?: string; language?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ audio: null }, { status: 400 });
  }

  const raw = typeof body.text === "string" ? body.text.trim() : "";
  const language = typeof body.language === "string" ? body.language.trim() : "English";
  if (!raw) {
    return NextResponse.json({ audio: null }, { status: 400 });
  }

  const text = raw.slice(0, 4500);
  const languageCode = LANGUAGE_CODES[language] || "en-US";

  if (!process.env.GOOGLE_TTS_API_KEY) {
    return NextResponse.json({ audio: null, error: "TTS not configured" }, { status: 503 });
  }

  try {
    const audio = await cachedSynthesize(text, languageCode);
    return NextResponse.json({ audio, cached: true as const });
  } catch {
    try {
      const audio = await synthesizeWithGoogle(text, languageCode);
      return NextResponse.json({ audio, cached: false as const });
    } catch {
      return NextResponse.json({ audio: null }, { status: 500 });
    }
  }
}
