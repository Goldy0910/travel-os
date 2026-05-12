import { NextRequest, NextResponse } from "next/server";
import { getEntryAlerts } from "@/app/app/tools/visa3/_lib/visaGeminiService";
import type { VisaAlertsResponse, VisaAlertSeverity } from "@/app/app/tools/visa3/_lib/types";

type AlertsRequest = {
  destinationCountry?: string;
  passportCountry?: string;
};

function toSeverity(raw: string): VisaAlertSeverity {
  const value = raw.trim().toLowerCase();
  if (value === "ok") return "ok";
  if (value === "warning") return "warning";
  return "note";
}

export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY?.trim()) {
    return NextResponse.json({ error: "Missing GEMINI_API_KEY" }, { status: 503 });
  }
  let body: AlertsRequest;
  try {
    body = (await req.json()) as AlertsRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const destinationCountry = (body.destinationCountry ?? "").trim();
  const passportCountry = (body.passportCountry ?? "").trim();
  if (!destinationCountry || !passportCountry) {
    return NextResponse.json({ error: "Missing destinationCountry or passportCountry" }, { status: 400 });
  }
  const result = await getEntryAlerts(destinationCountry);
  return NextResponse.json({
    alerts: result.alerts.map((alert) => ({ ...alert, severity: toSeverity(alert.severity) })),
    refreshedAtIso: new Date().toISOString(),
  } satisfies VisaAlertsResponse);
}
