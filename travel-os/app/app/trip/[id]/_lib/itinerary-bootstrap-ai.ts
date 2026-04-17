type AiActivity = {
  date: string;
  title: string;
  location: string;
  time: string | null;
  notes: string | null;
};

type ExtractedPdfActivity = {
  date?: string;
  day?: string;
  title?: string;
  time?: string | null;
  location?: string | null;
  notes?: string | null;
};

type ExtractedPdfSectionShape = {
  days?: Array<{
    day?: string;
    date?: string;
    title?: string;
    sections?: Array<{
      period?: string;
      activities?: Array<{
        title?: string;
        time?: string | null;
        location?: string | null;
        notes?: string | null;
      }>;
    }>;
  }>;
};

function extractYmd(raw: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(raw.trim());
  return m?.[1] ?? null;
}

function parseLooseJson<T>(raw: string): T {
  const cleaned = raw.trim().replace(/```json|```/gi, "").trim();
  const attempt = (input: string) => JSON.parse(input) as T;
  const normalize = (input: string) =>
    input
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/,\s*([}\]])/g, "$1")
      .replace(/}\s*{/g, "},{");

  try {
    return attempt(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const sliced = cleaned.slice(start, end + 1);
      try {
        return attempt(sliced);
      } catch {
        const repaired = normalize(sliced);
        return attempt(repaired);
      }
    }
    throw new Error("Invalid JSON");
  }
}

export function enumerateTripDates(startDate: string, endDate: string): string[] {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];
  const out: string[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function trimText(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function normalizeTime(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (/^\d{2}:\d{2}$/.test(v)) return v;
  const m = /^(\d{1,2}):(\d{2})\s*(am|pm)$/i.exec(v);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2];
  const ap = m[3].toLowerCase();
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  if (h < 0 || h > 23) return null;
  return `${String(h).padStart(2, "0")}:${min}`;
}

function normalizeDateFlexible(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  const ymd = extractYmd(v);
  if (ymd) return ymd;

  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(v);
  if (dmy) {
    const dd = Number(dmy[1]);
    const mm = Number(dmy[2]);
    const yy = Number(dmy[3]);
    if (yy >= 1900 && mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    }
  }

  const parsed = new Date(v);
  if (Number.isNaN(parsed.getTime())) return null;
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseMonthDayFromText(raw: string): { month: number; day: number } | null {
  const text = raw.trim().toLowerCase();
  if (!text) return null;
  const months: Record<string, number> = {
    jan: 1,
    january: 1,
    feb: 2,
    february: 2,
    mar: 3,
    march: 3,
    apr: 4,
    april: 4,
    may: 5,
    jun: 6,
    june: 6,
    jul: 7,
    july: 7,
    aug: 8,
    august: 8,
    sep: 9,
    sept: 9,
    september: 9,
    oct: 10,
    october: 10,
    nov: 11,
    november: 11,
    dec: 12,
    december: 12,
  };
  const m = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b[,\s-]+(\d{1,2})\b/.exec(
    text,
  );
  if (!m) return null;
  const month = months[m[1]];
  const day = Number(m[2]);
  if (!month || day < 1 || day > 31) return null;
  return { month, day };
}

function monthDayFromYmd(ymd: string): { month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  return { month: Number(m[2]), day: Number(m[3]) };
}

async function callGeminiText(prompt: string, inlinePdfBase64?: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key?.trim()) throw new Error("Missing GEMINI_API_KEY");

  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [{ text: prompt }];
  if (inlinePdfBase64) {
    parts.push({
      inlineData: {
        mimeType: "application/pdf",
        data: inlinePdfBase64,
      },
    });
  }

  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key.trim(),
    },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 3000 },
    }),
  });
  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!response.ok || !raw) throw new Error("Gemini response unavailable");
  return raw.replace(/```json|```/g, "").trim();
}

export async function generateAiItineraryDraft(input: {
  destination: string;
  tripDates: string[];
  interests?: string;
  budget?: string;
}): Promise<AiActivity[]> {
  const prompt = `You are a trip itinerary planner.
Return ONLY valid JSON. No markdown.

Create a day-by-day itinerary for destination "${input.destination}".
Trip dates: ${input.tripDates.join(", ")}.
Interests: ${input.interests?.trim() || "General sightseeing"}.
Budget: ${input.budget?.trim() || "Not specified"}.

Strict format:
{
  "days": [
    {
      "date": "YYYY-MM-DD",
      "activities": [
        { "title": "string", "time": "HH:MM or null", "location": "string", "notes": "string or null" }
      ]
    }
  ]
}

Rules:
- 3 to 5 activities per day.
- Include only dates from the provided trip dates.
- Keep activities practical and concise.
- If unsure, still provide reasonable options for the destination.`;

  const raw = await callGeminiText(prompt);
  const parsed = parseLooseJson<{
    days?: Array<{
      date?: string;
      activities?: Array<{ title?: string; time?: string | null; location?: string; notes?: string | null }>;
    }>;
  }>(raw);

  const allowed = new Set(input.tripDates);
  const out: AiActivity[] = [];
  for (const day of parsed.days ?? []) {
    const date = extractYmd(trimText(day.date ?? ""));
    if (!date || !allowed.has(date)) continue;
    const activities = Array.isArray(day.activities) ? day.activities : [];
    for (const act of activities.slice(0, 5)) {
      const title = trimText(act.title ?? "");
      if (!title) continue;
      out.push({
        date,
        title,
        time: normalizeTime(trimText(act.time ?? "")),
        location: trimText(act.location ?? "") || input.destination,
        notes: trimText(act.notes ?? "") || null,
      });
    }
  }
  return out;
}

function resolvePdfActivityDate(raw: ExtractedPdfActivity, tripDates: string[]): string | null {
  const rawDate = trimText(raw.date ?? "");
  const rawDay = trimText(raw.day ?? "");
  const explicit = normalizeDateFlexible(rawDate);
  if (explicit && tripDates.includes(explicit)) return explicit;
  const dayLabel = rawDay.toLowerCase();
  const m = /day\s*(\d{1,2})/.exec(dayLabel);
  if (!m) return null;
  const idx = Number(m[1]) - 1;
  if (idx < 0 || idx >= tripDates.length) return null;
  const byDayIndex = tripDates[idx]!;

  const monthDay = parseMonthDayFromText(rawDate) ?? parseMonthDayFromText(rawDay);
  if (!monthDay) return byDayIndex;
  const matched = tripDates.find((d) => {
    const md = monthDayFromYmd(d);
    return md?.month === monthDay.month && md.day === monthDay.day;
  });
  return matched ?? byDayIndex;
}

export async function extractPdfItineraryDraft(input: {
  pdfBase64: string;
  tripDates: string[];
}): Promise<AiActivity[]> {
  const prompt = `Extract itinerary items from the attached PDF.
Return ONLY valid JSON. No markdown.

Strict rules:
- Extract only what is explicitly present.
- Do not infer or hallucinate missing data.
- If a date/day is missing for an activity, keep it out.

Format:
{
  "activities": [
    {
      "date": "YYYY-MM-DD or null",
      "day": "Day X or null",
      "title": "string",
      "time": "HH:MM or null",
      "location": "string or null",
      "notes": "string or null"
    }
  ]
}`;

  const fallbackPrompt = `Read the attached itinerary PDF and extract ONLY explicitly present activity rows.
Return ONLY JSON in this shape:
{"activities":[{"date":"YYYY-MM-DD or null","day":"Day X or null","title":"string","time":"HH:MM or null","location":"string or null","notes":"string or null"}]}
Rules:
- No guessed activities.
- No guessed dates/times.
- If date/day is missing for a row, leave null.
- If uncertain, include fewer rows rather than guessing.`;

  const sectionPrompt = `Extract itinerary from the attached PDF when it is organized like:
Day X: <date> - <theme>
Morning / Afternoon / Evening sections with bullet points.

Return ONLY JSON:
{
  "days": [
    {
      "day": "Day X or null",
      "date": "YYYY-MM-DD or month/day text or null",
      "title": "day heading text or null",
      "sections": [
        {
          "period": "Morning|Afternoon|Evening|Other",
          "activities": [
            {
              "title": "activity text exactly from PDF",
              "time": "HH:MM or null",
              "location": "explicit location if present else null",
              "notes": "additional explicit text if present else null"
            }
          ]
        }
      ]
    }
  ]
}
Rules:
- Extract only explicit content.
- Do not invent missing fields.
- Keep activity titles concise and literal.`;

  const lineFallbackPrompt = `Read the attached itinerary PDF and output plain text lines only.
Each line must be pipe-separated as:
day|date|period|activity|time|location|notes

Rules:
- One activity per line.
- Use explicit PDF text only; no guessing.
- If a field is missing, keep it empty.
- No markdown, no bullets, no explanations.
- Example:
Day 2|April 19|Morning|Visit Notre-Dame Cathedral|||`;

  let parsed: { activities?: ExtractedPdfActivity[] } = {};
  try {
    const raw = await callGeminiText(prompt, input.pdfBase64);
    parsed = parseLooseJson<{ activities?: ExtractedPdfActivity[] }>(raw);
  } catch {
    try {
      const raw = await callGeminiText(fallbackPrompt, input.pdfBase64);
      parsed = parseLooseJson<{ activities?: ExtractedPdfActivity[] }>(raw);
    } catch {
      parsed = {};
    }
  }

  const rows = Array.isArray(parsed.activities) ? parsed.activities : [];
  const out: AiActivity[] = [];

  const addActivityRow = (row: ExtractedPdfActivity) => {
    const date = resolvePdfActivityDate(row, input.tripDates);
    if (!date) return;
    const title = trimText(row.title ?? "");
    if (!title) return;
    out.push({
      date,
      title,
      time: normalizeTime(trimText(row.time ?? "")),
      location: trimText(row.location ?? ""),
      notes: trimText(row.notes ?? "") || null,
    });
  };

  for (const row of rows) {
    addActivityRow(row);
  }

  if (out.length === 0) {
    try {
      const raw = await callGeminiText(sectionPrompt, input.pdfBase64);
      const sectionParsed = parseLooseJson<ExtractedPdfSectionShape>(raw);
      for (const day of sectionParsed.days ?? []) {
        const dayLabel = trimText(day.day ?? "");
        const dateLabel = trimText(day.date ?? "");
        const dayTitle = trimText(day.title ?? "");
        for (const section of day.sections ?? []) {
          const period = trimText(section.period ?? "");
          for (const act of section.activities ?? []) {
            const baseTitle = trimText(act.title ?? "");
            if (!baseTitle) continue;
            const composedTitle = period ? `${period}: ${baseTitle}` : baseTitle;
            const notesBits = [dayTitle].filter(Boolean);
            addActivityRow({
              day: dayLabel || null,
              date: dateLabel || null,
              title: composedTitle,
              time: trimText(act.time ?? "") || null,
              location: trimText(act.location ?? "") || null,
              notes: [trimText(act.notes ?? ""), ...notesBits].filter(Boolean).join(" | ") || null,
            });
          }
        }
      }
    } catch {
      // no-op; out remains empty and caller handles failure
    }
  }

  if (out.length === 0) {
    try {
      const rawLines = await callGeminiText(lineFallbackPrompt, input.pdfBase64);
      for (const line of rawLines.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.includes("|")) continue;
        const [day, date, period, activity, time, location, notes] = trimmed.split("|");
        const title = [trimText(period), trimText(activity)].filter(Boolean).join(": ");
        if (!title) continue;
        addActivityRow({
          day: trimText(day) || null,
          date: trimText(date) || null,
          title,
          time: trimText(time) || null,
          location: trimText(location) || null,
          notes: trimText(notes) || null,
        });
      }
    } catch {
      // keep empty; caller will return user-facing error
    }
  }
  return out;
}
