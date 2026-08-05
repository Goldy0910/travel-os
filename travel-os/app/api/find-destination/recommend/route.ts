import { recommendDestinations } from "@/lib/find-destination/recommend";
import type { QuizAnswers } from "@/app/find-destination/_lib/types";
import {
  BUDGET_MAX,
  BUDGET_MIN,
} from "@/app/find-destination/_lib/quiz-constants";
import { after } from "next/server";
import { resolveInterestActorId } from "@/lib/destination-interest/actor";
import { createDestinationInterestService } from "@/lib/destination-interest/server";
import { trackInterestFireAndForget } from "@/lib/destination-interest/service";

export const runtime = "nodejs";

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object";
}

function parseAnswers(body: unknown): QuizAnswers | null {
  if (!isObject(body)) return null;
  const companion = body.companion;
  const duration = body.duration;
  const weather = body.weather;
  const region = body.region;
  const travelStyle = body.travelStyle;
  const transport = body.transport;
  const budgetInr = Number(body.budgetInr);
  const interests = Array.isArray(body.interests)
    ? body.interests.filter((x): x is string => typeof x === "string")
    : null;

  if (
    typeof companion !== "string" ||
    typeof duration !== "string" ||
    typeof weather !== "string" ||
    typeof region !== "string" ||
    typeof travelStyle !== "string" ||
    typeof transport !== "string" ||
    !interests ||
    interests.length === 0 ||
    !Number.isFinite(budgetInr)
  ) {
    return null;
  }

  return {
    companion: companion as QuizAnswers["companion"],
    duration: duration as QuizAnswers["duration"],
    weather: weather as QuizAnswers["weather"],
    region: region as QuizAnswers["region"],
    travelStyle: travelStyle as QuizAnswers["travelStyle"],
    transport: transport as QuizAnswers["transport"],
    interests: interests as QuizAnswers["interests"],
    budgetInr: Math.min(BUDGET_MAX, Math.max(BUDGET_MIN, Math.round(budgetInr))),
  };
}

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const answers = parseAnswers(json);
  if (!answers) {
    return Response.json(
      { error: "Please complete all quiz questions before generating recommendations." },
      { status: 400 },
    );
  }

  try {
    const result = await recommendDestinations(answers);
    if (!result.destinations?.length) {
      return Response.json(
        { error: "No destinations matched. Try adjusting your answers." },
        { status: 502 },
      );
    }
    after(() => {
      void (async () => {
        try {
          const actorId = await resolveInterestActorId();
          if (!actorId) return;
          const service = await createDestinationInterestService();
          trackInterestFireAndForget(
            service,
            result.destinations.map((d) => d.slug),
            "AI_RECOMMENDED",
            actorId,
          );
        } catch {
          // never affect recommendations
        }
      })();
    });
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Recommendation failed";
    const status = /timeout|abort/i.test(message) ? 504 : 500;
    return Response.json(
      {
        error:
          status === 504
            ? "The recommendation service timed out. Please retry."
            : "We couldn't generate recommendations right now. Please retry.",
      },
      { status },
    );
  }
}
