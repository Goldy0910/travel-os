import { NextRequest, NextResponse } from "next/server";
import { getVisa3Lookup } from "@/app/app/tools/visa3/_lib/visaGeminiService";

type LookupRequest = {
  destinationCountry?: string;
  passportCountry?: string;
};

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
  const data = await getVisa3Lookup(passportCountry, destinationCountry);
  return NextResponse.json(data);
}
