import { NextRequest, NextResponse } from "next/server";
import { createDestinationInterestService } from "@/lib/destination-interest/server";
import { parseInterestIdList } from "@/lib/destination-interest/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = {
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
} as const;

/** Batch fetch — one request for many destination cards. */
export async function GET(req: NextRequest) {
  try {
    const parsed = parseInterestIdList(req.nextUrl.searchParams.get("ids"));
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error, items: [] }, { status: 400, headers: NO_STORE });
    }
    const service = await createDestinationInterestService();
    const items = await service.getInterestBatch(parsed.destinationIds);
    return NextResponse.json({ items }, { status: 200, headers: NO_STORE });
  } catch {
    return NextResponse.json({ items: [] }, { status: 200, headers: NO_STORE });
  }
}
