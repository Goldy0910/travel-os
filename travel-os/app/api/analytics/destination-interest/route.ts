import { NextRequest, NextResponse } from "next/server";
import { resolveInterestActorId } from "@/lib/destination-interest/actor";
import { createDestinationInterestService } from "@/lib/destination-interest/server";
import { parseTrackPayload } from "@/lib/destination-interest/validate";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = {
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
} as const;

export async function POST(req: NextRequest) {
  try {
    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: NO_STORE });
    }

    const parsed = parseTrackPayload(json);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });
    }

    const actorId = await resolveInterestActorId();
    if (!actorId) {
      return NextResponse.json({ success: true }, { status: 200, headers: NO_STORE });
    }

    const limited = checkRateLimit({
      key: `destination-interest:${actorId}`,
      limit: 40,
      windowMs: 60_000,
      enforce: true,
    });
    if (!limited.allowed) {
      return rateLimitResponse(limited);
    }

    const service = await createDestinationInterestService();
    await service.track(parsed.destinationId, parsed.eventType, actorId);
    return NextResponse.json({ success: true }, { status: 200, headers: NO_STORE });
  } catch {
    return NextResponse.json({ success: true }, { status: 200, headers: NO_STORE });
  }
}
