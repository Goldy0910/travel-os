import { runAiDecision } from "@/lib/homepage-decision/ai";
import { parseDecisionRequest, runRulesDecision } from "@/lib/homepage-decision/engine";
import type { HomepageDecisionApiResult, HomepageDecisionResponse } from "@/lib/homepage-decision/types";
import { after, NextRequest, NextResponse } from "next/server";
import { resolveInterestActorId } from "@/lib/destination-interest/actor";
import { resolveTopLevelDestination } from "@/lib/destination-interest/resolve";
import { createDestinationInterestService } from "@/lib/destination-interest/server";
import { trackInterestFireAndForget } from "@/lib/destination-interest/service";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" } satisfies HomepageDecisionApiResult,
      { status: 400 },
    );
  }

  const input = parseDecisionRequest(body);
  if (!input) {
    return NextResponse.json(
      { ok: false, error: "Invalid request" } satisfies HomepageDecisionApiResult,
      { status: 400 },
    );
  }

  if (!input.priorities.length && !input.destination?.trim()) {
    return NextResponse.json(
      { ok: false, error: "Select at least one priority or enter a destination." } satisfies HomepageDecisionApiResult,
      { status: 400 },
    );
  }

  try {
    const ai = await runAiDecision(input);
    if (ai) {
      scheduleHomepageInterestTracking(ai);
      return NextResponse.json({
        ok: true,
        data: ai,
        source: "ai",
      } satisfies HomepageDecisionApiResult);
    }
  } catch {
    /* fall through to rules */
  }

  const data = runRulesDecision(input);
  scheduleHomepageInterestTracking(data);
  return NextResponse.json({
    ok: true,
    data,
    source: "rules",
  } satisfies HomepageDecisionApiResult);
}

function scheduleHomepageInterestTracking(data: HomepageDecisionResponse) {
  after(() => {
    void (async () => {
      try {
        const actorId = await resolveInterestActorId();
        if (!actorId) return;
        const primary =
          data.destinationSlug ||
          resolveTopLevelDestination({ name: data.destination, type: "city" })?.id;
        const altIds = data.alternatives
          .map(
            (alt) =>
              alt.slug ||
              resolveTopLevelDestination({ name: alt.name, type: "city" })?.id ||
              "",
          )
          .filter(Boolean);
        const service = await createDestinationInterestService();
        if (primary) {
          trackInterestFireAndForget(
            service,
            [primary],
            data.mode === "validation" ? "SEARCH" : "AI_RECOMMENDED",
            actorId,
          );
        }
        if (altIds.length) {
          trackInterestFireAndForget(service, altIds, "AI_RECOMMENDED", actorId);
        }
      } catch {
        // never affect homepage recommendations
      }
    })();
  });
}
