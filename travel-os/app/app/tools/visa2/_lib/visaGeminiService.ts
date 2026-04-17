import type { VisaAlert, VisaLookupResponse } from "@/app/app/tools/visa2/_lib/types";

type GeminiCandidateResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
};

type ApplicationGuideResponse = {
  steps: string[];
};

type DocumentChecklistResponse = {
  items: string[];
};

type EntryAlertsResponse = {
  alerts: VisaAlert[];
};

function normalizeVisaType(raw: string): VisaLookupResponse["visaType"] {
  const value = raw.trim().toLowerCase();
  if (value.includes("visa-free") || value.includes("visa free")) return "Visa-free";
  if (value.includes("arrival")) return "Visa on arrival";
  if (value.includes("evisa") || value.includes("e-visa")) return "eVisa";
  return "Visa required";
}

function parseDaysFromProcessingTime(raw: string): number {
  const text = raw.toLowerCase();
  const range = /(\d+)\s*-\s*(\d+)\s*(day|days|week|weeks)/.exec(text);
  if (range) {
    const max = Number(range[2]);
    return range[3].startsWith("week") ? max * 7 : max;
  }
  const single = /(\d+)\s*(day|days|week|weeks)/.exec(text);
  if (single) {
    const count = Number(single[1]);
    return single[2].startsWith("week") ? count * 7 : count;
  }
  return 14;
}

async function callGeminiJson<T>(prompt: string): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey.trim(),
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1800 },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini request failed (${response.status})`);
  }

  const data = (await response.json()) as GeminiCandidateResponse;
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw || typeof raw !== "string") {
    throw new Error("Empty Gemini response");
  }

  const cleaned = raw.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error("Could not parse Gemini JSON response");
  }
}

export async function getVisaRequirements(
  passportCountry: string,
  destinationCountry: string,
): Promise<Pick<VisaLookupResponse, "visaType" | "processingTime" | "processingDays" | "fee" | "validity" | "maxStay" | "applyLink">> {
  const prompt = `You are an immigration assistant.
Return ONLY valid JSON (no markdown, no explanation).

For passport holders of ${passportCountry} traveling to ${destinationCountry}, provide:
{
  "visaType": "Visa-free | Visa on arrival | eVisa | Visa required",
  "processingTime": "short string",
  "fee": "short string",
  "validity": "short string",
  "maxStay": "short string",
  "applyLink": "official application URL"
}`;

  const parsed = await callGeminiJson<{
    visaType?: string;
    processingTime?: string;
    fee?: string;
    validity?: string;
    maxStay?: string;
    applyLink?: string;
  }>(prompt);

  const processingTime =
    typeof parsed.processingTime === "string" && parsed.processingTime.trim()
      ? parsed.processingTime.trim()
      : "10-15 days";

  return {
    visaType: normalizeVisaType(parsed.visaType ?? "Visa required"),
    processingTime,
    processingDays: parseDaysFromProcessingTime(processingTime),
    fee: typeof parsed.fee === "string" && parsed.fee.trim() ? parsed.fee.trim() : "Varies",
    validity:
      typeof parsed.validity === "string" && parsed.validity.trim()
        ? parsed.validity.trim()
        : "Depends on visa class",
    maxStay:
      typeof parsed.maxStay === "string" && parsed.maxStay.trim()
        ? parsed.maxStay.trim()
        : "Check official policy",
    applyLink:
      typeof parsed.applyLink === "string" && parsed.applyLink.trim()
        ? parsed.applyLink.trim()
        : `https://www.google.com/search?q=${encodeURIComponent(`${destinationCountry} official visa application`)}`,
  };
}

export async function getApplicationGuide(
  passportCountry: string,
  destinationCountry: string,
): Promise<ApplicationGuideResponse> {
  const prompt = `Return ONLY valid JSON.
No markdown, no preamble.

For ${passportCountry} passport holders visiting ${destinationCountry}, generate practical visa application steps.
JSON format:
{
  "steps": ["5 to 7 concise step strings in order"]
}`;
  const parsed = await callGeminiJson<{ steps?: unknown }>(prompt);
  const steps = Array.isArray(parsed.steps)
    ? parsed.steps.filter((step): step is string => typeof step === "string" && step.trim().length > 0)
    : [];
  return { steps: steps.slice(0, 8) };
}

export async function getDocumentChecklist(
  passportCountry: string,
  destinationCountry: string,
): Promise<DocumentChecklistResponse> {
  const prompt = `Return ONLY valid JSON.
No markdown, no preamble.

For ${passportCountry} passport holders traveling to ${destinationCountry}, provide a visa document checklist.
JSON format:
{
  "items": ["7 to 12 concise required-document strings"]
}`;
  const parsed = await callGeminiJson<{ items?: unknown }>(prompt);
  const items = Array.isArray(parsed.items)
    ? parsed.items.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  return { items: items.slice(0, 16) };
}

export async function getEntryAlerts(destinationCountry: string): Promise<EntryAlertsResponse> {
  const prompt = `Return ONLY valid JSON.
No markdown, no preamble.

Create entry alerts for travelers visiting ${destinationCountry}. Cover health, vaccination, insurance, and border-entry requirements.
JSON format:
{
  "alerts": [
    {
      "title": "short string",
      "detail": "short practical detail",
      "severity": "ok | note | warning"
    }
  ]
}
Include 4 to 8 alerts.`;

  const parsed = await callGeminiJson<{ alerts?: unknown }>(prompt);
  const alerts = Array.isArray(parsed.alerts)
    ? parsed.alerts
        .map((entry) => {
          const record = (entry ?? {}) as {
            title?: unknown;
            detail?: unknown;
            severity?: unknown;
          };
          const title = typeof record.title === "string" ? record.title.trim() : "";
          const detail = typeof record.detail === "string" ? record.detail.trim() : "";
          const severityRaw = typeof record.severity === "string" ? record.severity.trim().toLowerCase() : "note";
          if (!title || !detail) return null;
          return {
            title,
            detail,
            severity:
              severityRaw === "ok" || severityRaw === "warning" || severityRaw === "note"
                ? severityRaw
                : "note",
          } as VisaAlert;
        })
        .filter((alert): alert is VisaAlert => alert != null)
    : [];

  return { alerts: alerts.slice(0, 10) };
}
