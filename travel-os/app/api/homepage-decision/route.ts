import { runAiDecision } from "@/lib/homepage-decision/ai";
import { parseDecisionRequest, runRulesDecision } from "@/lib/homepage-decision/engine";
import type { HomepageDecisionApiResult } from "@/lib/homepage-decision/types";
import { NextRequest, NextResponse } from "next/server";

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
  return NextResponse.json({
    ok: true,
    data,
    source: "rules",
  } satisfies HomepageDecisionApiResult);
}
