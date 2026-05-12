import type {
  VisaAlert,
  VisaDocumentDetail,
  VisaLookupResponse,
  VisaTypeId,
  VisaTypeOption,
} from "@/app/app/tools/visa3/_lib/types";

type GeminiCandidateResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
};

function fallbackDocs(): VisaDocumentDetail[] {
  return [
    {
      name: "Passport bio page",
      format: "PDF or JPEG, max 2MB",
      requirement: "Clear scan of photo page, passport valid at least 6 months from return date.",
      tip: "Use natural light and avoid shadows on edges.",
    },
    {
      name: "Recent passport-size photo",
      format: "JPEG, white background, max 1MB",
      requirement: "Taken in the last 6 months, face centered, no heavy filters.",
      tip: "Most photo studios can export visa-specific sizes if you mention destination.",
    },
    {
      name: "Flight itinerary",
      format: "PDF, max 2MB",
      requirement: "Onward/return booking showing traveler name and travel dates.",
      tip: "A refundable booking can reduce risk while visa is still pending.",
    },
    {
      name: "Accommodation proof",
      format: "PDF or JPEG, max 2MB",
      requirement: "Hotel booking or host invitation covering the full stay window.",
      tip: "If staying with friends/family, include host ID and address proof.",
    },
    {
      name: "Financial proof",
      format: "PDF, max 2MB",
      requirement: "Bank statement for the last 3 months with stable closing balance.",
      tip: "Salary slips can strengthen this if your account balance recently changed.",
    },
    {
      name: "Travel insurance",
      format: "PDF, max 2MB",
      requirement: "Policy document covering trip dates and medical emergencies.",
      tip: "Check if destination has minimum coverage limits before buying.",
    },
  ];
}

function fallbackVisaOptions(destinationCountry: string): VisaTypeOption[] {
  const docs = fallbackDocs();
  return [
    {
      id: "e-visa",
      label: "e-Visa",
      description: "Apply online, no embassy visit needed. Fastest option.",
      processingTime: "3-7 days",
      processingDays: 7,
      feeInr: "INR 4,200 (approx.)",
      feeNote: "Paid online at time of application.",
      validity: "90 days from issue",
      maxStay: "Up to 30 days",
      applyLink: `https://www.google.com/search?q=${encodeURIComponent(`${destinationCountry} official e-visa`)}`,
      guideSteps: [
        "Create an account on the official visa portal.",
        "Fill traveler details exactly as in your passport.",
        "Upload documents in required format and size.",
        "Pay the visa fee online and save payment receipt.",
        "Track approval email and download your visa PDF before departure.",
      ],
      documents: docs,
    },
    {
      id: "embassy-sticker-visa",
      label: "Embassy Sticker Visa",
      description: "Apply via embassy or VFS center. Best for longer stays.",
      processingTime: "10-15 days",
      processingDays: 15,
      feeInr: "INR 7,900 (approx.)",
      feeNote: "Paid during appointment or document submission.",
      validity: "As per visa officer decision",
      maxStay: "As stamped on visa",
      applyLink: `https://www.google.com/search?q=${encodeURIComponent(`${destinationCountry} embassy visa application`)}`,
      guideSteps: [
        "Book your visa appointment on the official channel.",
        "Complete the embassy form and print acknowledgement.",
        "Prepare originals plus photocopies of required documents.",
        "Attend biometrics/interview as instructed by visa center.",
        "Track passport dispatch and verify visa details after collection.",
      ],
      documents: docs,
    },
  ];
}

function fallbackLookup(destinationCountry: string): VisaLookupResponse {
  return {
    visaOptions: fallbackVisaOptions(destinationCountry),
    rejectionGuide: {
      reasons: [
        "Incomplete financial documents",
        "Mismatch between passport and application details",
        "Insufficient trip purpose clarity",
        "Travel insurance not meeting policy requirements",
        "Unclear accommodation or return plan",
      ],
      immediateAction: "Review refusal letter first. Reapply after fixing document gaps; appeal only when policy explicitly supports it.",
      timeline: "Most applicants can reapply in 2-6 weeks once missing paperwork is corrected.",
      reassurance:
        "First-time applicants with complete documents have a high approval rate. Most rejections are due to missing paperwork.",
    },
  };
}

function normalizeVisaTypeId(raw: string): VisaTypeId | null {
  const value = raw.trim().toLowerCase();
  if (value.includes("e-visa") || value.includes("evisa")) return "e-visa";
  if (value.includes("sticker") || value.includes("embassy")) return "embassy-sticker-visa";
  if (value.includes("arrival")) return "visa-on-arrival";
  if (value.includes("free")) return "visa-free";
  return null;
}

function visaTypeLabel(id: VisaTypeId): string {
  if (id === "e-visa") return "e-Visa";
  if (id === "embassy-sticker-visa") return "Embassy Sticker Visa";
  if (id === "visa-on-arrival") return "Visa on Arrival";
  return "Visa-Free";
}

function parseProcessingDays(raw: string): number {
  const text = raw.toLowerCase();
  const range = /(\d+)\s*-\s*(\d+)\s*(day|days|week|weeks)/.exec(text);
  if (range) return range[3].startsWith("week") ? Number(range[2]) * 7 : Number(range[2]);
  const single = /(\d+)\s*(day|days|week|weeks)/.exec(text);
  if (single) return single[2].startsWith("week") ? Number(single[1]) * 7 : Number(single[1]);
  return 14;
}

async function callGeminiJson<T>(prompt: string): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey?.trim()) throw new Error("Missing GEMINI_API_KEY");

  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey.trim() },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 2800 },
      }),
    },
  );
  if (!response.ok) throw new Error(`Gemini request failed (${response.status})`);
  const data = (await response.json()) as GeminiCandidateResponse;
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw || typeof raw !== "string") throw new Error("Empty Gemini response");
  const cleaned = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned) as T;
}

export async function getVisa3Lookup(
  passportCountry: string,
  destinationCountry: string,
): Promise<VisaLookupResponse> {
  const prompt = `You are an immigration assistant.
Return ONLY valid JSON.

Passport: ${passportCountry}
Destination: ${destinationCountry}

Return this schema:
{
  "visaOptions": [
    {
      "type": "e-Visa | Embassy Sticker Visa | Visa on Arrival | Visa-Free",
      "description": "single short sentence for first-timers",
      "processingTime": "short text",
      "feeInr": "INR amount approx",
      "feeNote": "short payment context",
      "validity": "short text",
      "maxStay": "short text",
      "applyLink": "official URL",
      "guideSteps": ["exactly 5 concise practical steps"],
      "documents": [
        {"name":"doc name","format":"PDF/JPEG size info","requirement":"specific requirement","tip":"first-timer tip"}
      ]
    }
  ],
  "rejectionGuide": {
    "reasons": ["top 5 reasons"],
    "immediateAction": "reapply vs appeal vs alternative visa guidance",
    "timeline": "typical reapplication timeline",
    "reassurance": "first-time reassurance sentence"
  }
}

Constraints:
- Include ONLY visa types actually available for this passport+destination pair.
- 4 to 6 document objects per visa type.
- feeInr must be INR-focused even if approximate.
- Keep text practical and non-legalese.`;

  try {
    const parsed = await callGeminiJson<{
      visaOptions?: Array<Record<string, unknown>>;
      rejectionGuide?: Record<string, unknown>;
    }>(prompt);
    const visaOptionsRaw = Array.isArray(parsed.visaOptions) ? parsed.visaOptions : [];
    const fallback = fallbackLookup(destinationCountry);
    const options: VisaTypeOption[] = visaOptionsRaw
      .map((entry) => {
        const typeId = normalizeVisaTypeId(String(entry.type ?? ""));
        if (!typeId) return null;
        const docsRaw = Array.isArray(entry.documents) ? entry.documents : [];
        const docs = docsRaw
          .map((doc) => {
            const row = (doc ?? {}) as Record<string, unknown>;
            const name = typeof row.name === "string" ? row.name.trim() : "";
            if (!name) return null;
            return {
              name,
              format: typeof row.format === "string" && row.format.trim() ? row.format.trim() : "PDF or JPEG, max 2MB",
              requirement:
                typeof row.requirement === "string" && row.requirement.trim()
                  ? row.requirement.trim()
                  : "Provide clear and complete document as per official guidance.",
              tip:
                typeof row.tip === "string" && row.tip.trim()
                  ? row.tip.trim()
                  : "Keep file names simple so officers can review quickly.",
            } satisfies VisaDocumentDetail;
          })
          .filter((item): item is VisaDocumentDetail => item != null)
          .slice(0, 6);

        const processingTime =
          typeof entry.processingTime === "string" && entry.processingTime.trim()
            ? entry.processingTime.trim()
            : "10-15 days";
        return {
          id: typeId,
          label: visaTypeLabel(typeId),
          description:
            typeof entry.description === "string" && entry.description.trim()
              ? entry.description.trim()
              : `${visaTypeLabel(typeId)} option based on current travel rules.`,
          processingTime,
          processingDays: parseProcessingDays(processingTime),
          feeInr: typeof entry.feeInr === "string" && entry.feeInr.trim() ? entry.feeInr.trim() : "INR 4,500 (approx.)",
          feeNote:
            typeof entry.feeNote === "string" && entry.feeNote.trim()
              ? entry.feeNote.trim()
              : "Fees vary by season and visa center.",
          validity: typeof entry.validity === "string" && entry.validity.trim() ? entry.validity.trim() : "As per issued permit",
          maxStay: typeof entry.maxStay === "string" && entry.maxStay.trim() ? entry.maxStay.trim() : "Check official policy",
          applyLink:
            typeof entry.applyLink === "string" && entry.applyLink.trim()
              ? entry.applyLink.trim()
              : `https://www.google.com/search?q=${encodeURIComponent(`${destinationCountry} official visa portal`)}`,
          guideSteps: Array.isArray(entry.guideSteps)
            ? entry.guideSteps.filter((step): step is string => typeof step === "string" && step.trim().length > 0).slice(0, 5)
            : fallback.visaOptions[0].guideSteps,
          documents: docs.length > 0 ? docs : fallback.visaOptions[0].documents,
        } satisfies VisaTypeOption;
      })
      .filter((item): item is VisaTypeOption => item != null);

    const rejectionRaw = parsed.rejectionGuide ?? {};
    const reasons = Array.isArray(rejectionRaw.reasons)
      ? rejectionRaw.reasons.filter((r): r is string => typeof r === "string" && r.trim().length > 0).slice(0, 5)
      : [];

    return {
      visaOptions: options.length > 0 ? options : fallback.visaOptions,
      rejectionGuide: {
        reasons: reasons.length > 0 ? reasons : fallback.rejectionGuide.reasons,
        immediateAction:
          typeof rejectionRaw.immediateAction === "string" && rejectionRaw.immediateAction.trim()
            ? rejectionRaw.immediateAction.trim()
            : fallback.rejectionGuide.immediateAction,
        timeline:
          typeof rejectionRaw.timeline === "string" && rejectionRaw.timeline.trim()
            ? rejectionRaw.timeline.trim()
            : fallback.rejectionGuide.timeline,
        reassurance:
          typeof rejectionRaw.reassurance === "string" && rejectionRaw.reassurance.trim()
            ? rejectionRaw.reassurance.trim()
            : fallback.rejectionGuide.reassurance,
      },
    };
  } catch {
    return fallbackLookup(destinationCountry);
  }
}

export async function getEntryAlerts(destinationCountry: string): Promise<{ alerts: VisaAlert[] }> {
  const prompt = `Return ONLY valid JSON.
No markdown.
Create 4 to 8 entry alerts for visiting ${destinationCountry}.
Schema:
{
  "alerts":[{"title":"short","detail":"practical detail","severity":"ok|note|warning"}]
}`;
  try {
    const parsed = await callGeminiJson<{ alerts?: unknown }>(prompt);
    const alerts = Array.isArray(parsed.alerts)
      ? parsed.alerts
          .map((entry) => {
            const row = (entry ?? {}) as Record<string, unknown>;
            const title = typeof row.title === "string" ? row.title.trim() : "";
            const detail = typeof row.detail === "string" ? row.detail.trim() : "";
            const severityRaw = typeof row.severity === "string" ? row.severity.trim().toLowerCase() : "note";
            if (!title || !detail) return null;
            const severity = severityRaw === "ok" || severityRaw === "warning" ? severityRaw : "note";
            return { title, detail, severity } as VisaAlert;
          })
          .filter((alert): alert is VisaAlert => alert != null)
      : [];
    return {
      alerts:
        alerts.length > 0
          ? alerts
          : [
              { title: "Check latest advisories", detail: "Review destination entry guidance 24 hours before flight.", severity: "note" },
              { title: "Carry backup copies", detail: "Keep printed visa approval and hotel booking in cabin baggage.", severity: "ok" },
              { title: "Immigration queues", detail: "Arrive early if biometric checks are mandatory at entry.", severity: "warning" },
            ],
    };
  } catch {
    return {
      alerts: [
        { title: "Check latest advisories", detail: "Review destination entry guidance 24 hours before flight.", severity: "note" },
        { title: "Carry backup copies", detail: "Keep printed visa approval and hotel booking in cabin baggage.", severity: "ok" },
        { title: "Immigration queues", detail: "Arrive early if biometric checks are mandatory at entry.", severity: "warning" },
      ],
    };
  }
}
