import { NextRequest, NextResponse } from "next/server";
import {
  getApplicationGuide,
  getDocumentChecklist,
  getVisaRequirements,
} from "@/app/app/tools/visa2/_lib/visaGeminiService";
import type { VisaLookupResponse } from "@/app/app/tools/visa2/_lib/types";

type LookupRequest = {
  destinationCountry?: string;
  passportCountry?: string;
};

function fallbackLookup(destinationCountry: string): VisaLookupResponse {
  return {
    visaType: "Visa required",
    processingTime: "10-15 days",
    processingDays: 15,
    fee: "Varies by visa class",
    validity: "As per permit issued",
    maxStay: "Check embassy guidance",
    applyLink: `https://www.google.com/search?q=${encodeURIComponent(`${destinationCountry} official visa application`)}`,
    guideSteps: [
      "Check official entry policy for your passport.",
      "Complete application form and upload documents.",
      "Pay fees and submit biometrics if required.",
      "Track application status until decision.",
      "Carry visa printout and supporting docs when traveling.",
    ],
    documents: [
      "Passport (minimum 6 months validity)",
      "Recent passport-size photos",
      "Flight itinerary",
      "Accommodation proof",
      "Financial statements",
      "Travel insurance",
    ],
  };
}

export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY?.trim()) {
    return NextResponse.json({ error: "Missing GEMINI_API_KEY" }, { status: 503 });
  }

  let body: LookupRequest;
  try {
    body = (await req.json()) as LookupRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const destinationCountry = (body.destinationCountry ?? "").trim();
  const passportCountry = (body.passportCountry ?? "").trim();
  if (!destinationCountry || !passportCountry) {
    return NextResponse.json({ error: "Missing destinationCountry or passportCountry" }, { status: 400 });
  }

  try {
    const [requirements, guide, checklist] = await Promise.all([
      getVisaRequirements(passportCountry, destinationCountry),
      getApplicationGuide(passportCountry, destinationCountry),
      getDocumentChecklist(passportCountry, destinationCountry),
    ]);
    const fallback = fallbackLookup(destinationCountry);
    return NextResponse.json({
      ...requirements,
      guideSteps: guide.steps.length > 0 ? guide.steps : fallback.guideSteps,
      documents: checklist.items.length > 0 ? checklist.items : fallback.documents,
    } satisfies VisaLookupResponse);
  } catch {
    return NextResponse.json(fallbackLookup(destinationCountry));
  }
}
