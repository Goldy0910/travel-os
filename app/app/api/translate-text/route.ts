import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { text, targetLanguage, sourceLanguage } = await req.json();

  const prompt = `Translate the following text from ${sourceLanguage || "English"} to ${targetLanguage}.
Return ONLY a JSON object. No explanation, no markdown. Format:
{
  "translated": "translated text here",
  "pronunciation": "romanized pronunciation if target is non-latin script, else null",
  "back_translation": "translate back to English to verify accuracy"
}

Text to translate: "${text}"`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 500 },
      }),
    }
  );

  const data = await response.json();
  try {
    const raw = data.candidates[0].content.parts[0].text;
    const cleaned = raw.replace(/```json|```/g, "").trim();
    return NextResponse.json(JSON.parse(cleaned));
  } catch {
    return NextResponse.json({ translated: "", pronunciation: null }, { status: 500 });
  }
}
