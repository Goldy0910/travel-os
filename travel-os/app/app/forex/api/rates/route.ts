import { NextRequest, NextResponse } from "next/server";

type ExchangeApiResponse = {
  result?: string;
  rates?: Record<string, number>;
  time_last_update_unix?: number;
  time_last_update_utc?: string;
};

const FALLBACK_INR: Record<string, number> = {
  USD: 83.5,
  EUR: 90.5,
  GBP: 106.5,
  INR: 1,
  AED: 22.75,
  SGD: 61.5,
  JPY: 0.55,
  THB: 2.3,
};

function fallbackRate(currency: string) {
  const key = currency.toUpperCase();
  return FALLBACK_INR[key] ?? 83.5;
}

export async function GET(req: NextRequest) {
  const currency = (req.nextUrl.searchParams.get("currency") ?? "USD").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    return NextResponse.json({ error: "Invalid currency code" }, { status: 400 });
  }

  try {
    const response = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(currency)}`, {
      cache: "no-store",
    });
    const data = (await response.json()) as ExchangeApiResponse;
    if (!response.ok || data.result !== "success" || !data.rates?.INR) {
      throw new Error("Live rates unavailable");
    }

    const lastUpdateIso = data.time_last_update_unix
      ? new Date(data.time_last_update_unix * 1000).toISOString()
      : new Date(data.time_last_update_utc ?? Date.now()).toISOString();

    return NextResponse.json({
      base: currency,
      rateToInr: data.rates.INR,
      lastUpdatedIso: lastUpdateIso,
      source: "live" as const,
    });
  } catch {
    return NextResponse.json({
      base: currency,
      rateToInr: fallbackRate(currency),
      lastUpdatedIso: new Date().toISOString(),
      source: "fallback" as const,
    });
  }
}
