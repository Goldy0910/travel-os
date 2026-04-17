import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  fallbackVisaGuide,
  type TravelerType,
  type VisaGuide,
  type VisaProcessStep,
  type VisaRecommendations,
} from "@/app/app/visa/_lib/visa-data";

type VisaGuideRow = {
  destination_key: string;
  destination_display: string;
  visa_type: string;
  cost: string;
  cost_source_link: string | null;
  processing_time: string;
  apply_link: string;
  checklist_salaried: unknown;
  checklist_self_employed: unknown;
  checklist_student: unknown;
  recommendations_before_apply: unknown;
  recommendations_while_applying: unknown;
  recommendations_after_apply: unknown;
  steps: unknown;
};

type GeminiGuidePayload = {
  visaType: string;
  cost: string;
  costSourceLink: string;
  processingTime: string;
  applyLink: string;
  checklist: Record<TravelerType, string[]>;
  recommendations: VisaRecommendations;
  steps: VisaProcessStep[];
};

function normalizeDestination(raw: string): { key: string; display: string } {
  const display = raw.trim().replace(/\s+/g, " ");
  const first = (display.split(",")[0] ?? display).trim();
  const key = first.toLowerCase();
  return { key, display: first || "Destination" };
}

function normalizeUrl(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

function countryFromDestination(display: string): string {
  const lower = display.toLowerCase();
  const map: Array<{ match: RegExp; country: string }> = [
    { match: /\bjapan\b|\btokyo\b|\bosaka\b|\bkyoto\b/, country: "japan" },
    { match: /\bthailand\b|\bbangkok\b|\bphuket\b/, country: "thailand" },
    { match: /\buae\b|\bdubai\b|\babu dhabi\b/, country: "uae" },
    { match: /\bsingapore\b/, country: "singapore" },
    { match: /\bmalaysia\b|\bkuala lumpur\b/, country: "malaysia" },
    { match: /\bindonesia\b|\bbali\b/, country: "indonesia" },
    { match: /\bvietnam\b|\bhanoi\b|\bho chi minh\b/, country: "vietnam" },
    { match: /\bsri lanka\b|\bcolombo\b/, country: "sri lanka" },
    { match: /\baustralia\b|\bsydney\b|\bmelbourne\b/, country: "australia" },
    { match: /\bnew zealand\b|\bauckland\b/, country: "new zealand" },
    { match: /\bunited kingdom\b|\buk\b|\blondon\b/, country: "united kingdom" },
    { match: /\bunited states\b|\busa\b|\bnew york\b/, country: "united states" },
    { match: /\bcanada\b|\btoronto\b/, country: "canada" },
    { match: /\bturkey\b|\bistanbul\b/, country: "turkey" },
    { match: /\bfrance\b|\bparis\b/, country: "france" },
    { match: /\bgermany\b|\bberlin\b/, country: "germany" },
    { match: /\bitaly\b|\brome\b/, country: "italy" },
    { match: /\bspain\b|\bbarcelona\b|\bmadrid\b/, country: "spain" },
  ];
  for (const entry of map) {
    if (entry.match.test(lower)) return entry.country;
  }
  return display.toLowerCase();
}

function officialApplyLinkForDestination(destinationDisplay: string): string {
  const country = countryFromDestination(destinationDisplay);
  const links: Record<string, string> = {
    japan: "https://www.mofa.go.jp/j_info/visit/visa/visaonline.html",
    thailand: "https://www.thaievisa.go.th/",
    uae: "https://smartservices.icp.gov.ae/",
    singapore: "https://www.ica.gov.sg/",
    malaysia: "https://malaysiavisa.imi.gov.my/evisa/evisa.jsp",
    indonesia: "https://molina.imigrasi.go.id/",
    vietnam: "https://evisa.xuatnhapcanh.gov.vn/",
    "sri lanka": "https://www.eta.gov.lk/",
    australia: "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-finder",
    "new zealand": "https://www.immigration.govt.nz/new-zealand-visas",
    "united kingdom": "https://www.gov.uk/check-uk-visa",
    "united states": "https://travel.state.gov/content/travel/en/us-visas.html",
    canada: "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada.html",
    turkey: "https://www.evisa.gov.tr/en/",
    france: "https://france-visas.gouv.fr/en/",
    germany: "https://digital.diplo.de/visa",
    italy: "https://vistoperitalia.esteri.it/home/en",
    spain: "https://www.exteriores.gob.es/en/ServiciosAlCiudadano/Paginas/Servicios-consulares.aspx",
  };
  if (links[country]) return links[country];
  const q = encodeURIComponent(`${destinationDisplay} official eVisa application site:gov`);
  return `https://www.google.com/search?q=${q}`;
}

function sanitizeApplyLink(destinationDisplay: string, rawLink: string): string {
  const normalized = normalizeUrl(rawLink);
  if (!normalized) return officialApplyLinkForDestination(destinationDisplay);
  const lower = normalized.toLowerCase();
  if (lower.includes("passportindia.gov.in")) {
    return officialApplyLinkForDestination(destinationDisplay);
  }
  return normalized;
}

function isAuthenticCostSource(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes(".gov") ||
    lower.includes(".gob.") ||
    lower.includes("vfsglobal.com") ||
    lower.includes("blsindia-visa.com") ||
    lower.includes("tlscontact.com") ||
    lower.includes("visa.vfsglobal") ||
    lower.includes("immigration")
  );
}

function sanitizeCostSourceLink(destinationDisplay: string, rawLink: string, applyLink: string): string {
  const normalized = normalizeUrl(rawLink);
  if (normalized && isAuthenticCostSource(normalized)) return normalized;
  const fallbackQuery = encodeURIComponent(`${destinationDisplay} official visa fee site:gov`);
  if (isAuthenticCostSource(applyLink)) return applyLink;
  return `https://www.google.com/search?q=${fallbackQuery}`;
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter((v) => v.length > 0);
}

function toSteps(value: unknown): VisaProcessStep[] {
  if (!Array.isArray(value)) return [];
  const out: VisaProcessStep[] = [];
  for (const entry of value) {
    const record = entry as Record<string, unknown>;
    const title = typeof record.title === "string" ? record.title.trim() : "";
    const tip = typeof record.tip === "string" ? record.tip.trim() : "";
    const linkRaw = typeof record.link === "string" ? record.link.trim() : "";
    if (!title || !tip) continue;
    out.push(linkRaw ? { title, tip, link: linkRaw } : { title, tip });
  }
  return out;
}

function rowToGuide(row: VisaGuideRow): VisaGuide {
  return {
    info: {
      visaType: row.visa_type,
      cost: row.cost,
      costSourceLink: sanitizeCostSourceLink(
        row.destination_display,
        row.cost_source_link ?? "",
        sanitizeApplyLink(row.destination_display, row.apply_link),
      ),
      processingTime: row.processing_time,
      applyLink: sanitizeApplyLink(row.destination_display, row.apply_link),
    },
    checklistByType: {
      salaried: toStringList(row.checklist_salaried),
      "self-employed": toStringList(row.checklist_self_employed),
      student: toStringList(row.checklist_student),
    },
    recommendations: {
      beforeApply: toStringList(row.recommendations_before_apply),
      whileApplying: toStringList(row.recommendations_while_applying),
      afterApply: toStringList(row.recommendations_after_apply),
    },
    steps: toSteps(row.steps),
    source: "ai-db",
  };
}

function buildPrompt(destination: string): string {
  return `You are a visa assistant for Indian travelers.
Return ONLY valid JSON (no markdown).
Generate practical visa guidance for Indian passport holders traveling to ${destination}.
Use current best practices and official immigration/consulate guidance style.

JSON format:
{
  "visaType": "string",
  "cost": "string in INR range for visa fee + typical service charges",
  "costSourceLink": "official source URL for visa fee (gov/consulate/VFS/TLS/BLS)",
  "processingTime": "string",
  "applyLink": "official country visa portal URL",
  "checklist": {
    "salaried": ["6 to 8 concise strings"],
    "self-employed": ["6 to 8 concise strings"],
    "student": ["6 to 8 concise strings"]
  },
  "recommendations": {
    "beforeApply": ["3 concise best-practice bullets"],
    "whileApplying": ["3 concise best-practice bullets"],
    "afterApply": ["3 concise best-practice bullets"]
  },
  "steps": [
    { "title": "Fill application form", "tip": "string", "link": "official apply URL" },
    { "title": "Upload documents", "tip": "string", "link": null },
    { "title": "Book appointment", "tip": "string", "link": null },
    { "title": "Attend biometrics", "tip": "string", "link": null },
    { "title": "Wait for approval", "tip": "string", "link": null }
  ]
}

Constraints:
- Keep wording practical and user-friendly for mobile UI.
- Always include an official application link in applyLink and step 1 link.
- For costSourceLink, use the most authentic available fee page (official govt/consulate or official processing partner).
- Do not include markdown or comments.`;
}

async function fetchGeminiGuide(destination: string): Promise<GeminiGuidePayload> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(destination) }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 2200 },
      }),
    },
  );
  if (!response.ok) {
    throw new Error("Gemini request failed");
  }
  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw || typeof raw !== "string") {
    throw new Error("Empty Gemini response");
  }
  const cleaned = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned) as GeminiGuidePayload;
}

function withFallback(guide: VisaGuide): VisaGuide {
  return {
    info: {
      visaType: guide.info.visaType || fallbackVisaGuide.info.visaType,
      cost: guide.info.cost || fallbackVisaGuide.info.cost,
      costSourceLink: guide.info.costSourceLink || fallbackVisaGuide.info.costSourceLink,
      processingTime: guide.info.processingTime || fallbackVisaGuide.info.processingTime,
      applyLink: guide.info.applyLink || fallbackVisaGuide.info.applyLink,
    },
    checklistByType: {
      salaried: guide.checklistByType.salaried.length
        ? guide.checklistByType.salaried
        : fallbackVisaGuide.checklistByType.salaried,
      "self-employed": guide.checklistByType["self-employed"].length
        ? guide.checklistByType["self-employed"]
        : fallbackVisaGuide.checklistByType["self-employed"],
      student: guide.checklistByType.student.length
        ? guide.checklistByType.student
        : fallbackVisaGuide.checklistByType.student,
    },
    recommendations: {
      beforeApply: guide.recommendations.beforeApply.length
        ? guide.recommendations.beforeApply
        : fallbackVisaGuide.recommendations.beforeApply,
      whileApplying: guide.recommendations.whileApplying.length
        ? guide.recommendations.whileApplying
        : fallbackVisaGuide.recommendations.whileApplying,
      afterApply: guide.recommendations.afterApply.length
        ? guide.recommendations.afterApply
        : fallbackVisaGuide.recommendations.afterApply,
    },
    steps: guide.steps.length ? guide.steps : fallbackVisaGuide.steps,
    source: guide.source,
  };
}

export async function getOrCreateVisaGuideForDestination(destinationRaw: string): Promise<VisaGuide> {
  const { key, display } = normalizeDestination(destinationRaw);
  if (!key) return fallbackVisaGuide;

  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("destination_visa_guides")
    .select(
      "destination_key,destination_display,visa_type,cost,cost_source_link,processing_time,apply_link,checklist_salaried,checklist_self_employed,checklist_student,recommendations_before_apply,recommendations_while_applying,recommendations_after_apply,steps",
    )
    .eq("destination_key", key)
    .maybeSingle();

  if (existing) {
    return withFallback(rowToGuide(existing as VisaGuideRow));
  }

  try {
    const generated = await fetchGeminiGuide(display);
    const applyLink = sanitizeApplyLink(display, generated.applyLink ?? "");
    const costSourceLink = sanitizeCostSourceLink(display, generated.costSourceLink ?? "", applyLink);
    const stepApplyLink = applyLink;
    const steps = (generated.steps ?? []).map((step, index) =>
      index === 0 ? { ...step, link: stepApplyLink } : step,
    );
    const row = {
      destination_key: key,
      destination_display: display,
      visa_type: generated.visaType,
      cost: generated.cost,
      cost_source_link: costSourceLink,
      processing_time: generated.processingTime,
      apply_link: applyLink,
      checklist_salaried: generated.checklist?.salaried ?? [],
      checklist_self_employed: generated.checklist?.["self-employed"] ?? [],
      checklist_student: generated.checklist?.student ?? [],
      recommendations_before_apply: generated.recommendations?.beforeApply ?? [],
      recommendations_while_applying: generated.recommendations?.whileApplying ?? [],
      recommendations_after_apply: generated.recommendations?.afterApply ?? [],
      steps,
    };
    const { data: inserted } = await supabase
      .from("destination_visa_guides")
      .upsert(row, { onConflict: "destination_key" })
      .select(
        "destination_key,destination_display,visa_type,cost,cost_source_link,processing_time,apply_link,checklist_salaried,checklist_self_employed,checklist_student,recommendations_before_apply,recommendations_while_applying,recommendations_after_apply,steps",
      )
      .maybeSingle();

    if (inserted) return withFallback(rowToGuide(inserted as VisaGuideRow));
  } catch {
    return fallbackVisaGuide;
  }

  return fallbackVisaGuide;
}
