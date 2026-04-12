import { NextRequest, NextResponse } from "next/server";

// Maps destination language to Google TTS language code
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
};

export async function POST(req: NextRequest) {
  const { text, language } = await req.json();
  const languageCode = LANGUAGE_CODES[language] || "en-US";

  const response = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${process.env.GOOGLE_TTS_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode, ssmlGender: "NEUTRAL" },
        audioConfig: { audioEncoding: "MP3" },
      }),
    }
  );

  const data = await response.json();
  if (data.audioContent) {
    return NextResponse.json({ audio: data.audioContent });
  }
  return NextResponse.json({ audio: null }, { status: 500 });
}
