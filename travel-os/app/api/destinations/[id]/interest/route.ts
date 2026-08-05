import { NextRequest, NextResponse } from "next/server";
import { emptyInterestSnapshot } from "@/lib/destination-interest/format";
import { createDestinationInterestService } from "@/lib/destination-interest/server";
import { getCurrentInterestPeriod } from "@/lib/destination-interest/time";
import { parseDestinationIdParam } from "@/lib/destination-interest/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = {
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
} as const;

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  const period = getCurrentInterestPeriod();
  let destinationId: string | null = null;
  try {
    const { id: rawId } = await context.params;
    destinationId = parseDestinationIdParam(decodeURIComponent(rawId || ""));
    if (!destinationId) {
      return NextResponse.json({ error: "Invalid destination id." }, { status: 400, headers: NO_STORE });
    }

    const service = await createDestinationInterestService();
    const snapshot = await service.getInterest(destinationId);
    return NextResponse.json(
      snapshot ?? emptyInterestSnapshot(destinationId, period.year, period.month),
      { status: 200, headers: NO_STORE },
    );
  } catch {
    return NextResponse.json(
      emptyInterestSnapshot(destinationId || "unknown", period.year, period.month),
      { status: 200, headers: NO_STORE },
    );
  }
}
