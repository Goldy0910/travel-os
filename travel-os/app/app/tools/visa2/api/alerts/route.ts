import { NextRequest, NextResponse } from "next/server";
import { getEntryAlerts } from "@/app/app/tools/visa2/_lib/visaGeminiService";
import type { VisaAlertsResponse, VisaAlertSeverity } from "@/app/app/tools/visa2/_lib/types";

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

function fallbackAlerts(): VisaAlertsResponse {
  return {
    alerts: [
      { title: "Vaccination guidance", detail: "Check official health advisories before travel.", severity: "note" },
      { title: "Insurance", detail: "Comprehensive travel medical insurance is strongly recommended.", severity: "note" },
      { title: "Entry documents", detail: "Carry passport, visa approval, and return/onward tickets.", severity: "ok" },
    ],
    refreshedAtIso: new Date().toISOString(),
  };
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

  try {
    const result = await getEntryAlerts(destinationCountry);
    const alerts = result.alerts
      .map((alert) => ({
        ...alert,
        severity: toSeverity(alert.severity),
      }))
      .slice(0, 10);

    return NextResponse.json({
      alerts: alerts.length > 0 ? alerts : fallbackAlerts().alerts,
      refreshedAtIso: new Date().toISOString(),
    } satisfies VisaAlertsResponse);
  } catch {
    return NextResponse.json(fallbackAlerts());
  }
}
