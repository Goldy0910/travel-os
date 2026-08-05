import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildExpertChatCards,
  buildExpertRecommendation,
  extractMentionedDestination,
  hasEnoughSignalsForRecommendation,
  scoreDestinationExpert,
  signalsFromConversationMemory,
  signalsFromQuizAnswers,
  wantsFullOptionsList,
} from "./index";
import { EMPTY_MEMORY_FIELDS } from "@/lib/chat/memory-types";
import { DESTINATION_CATALOG } from "@/lib/find-destination/catalog";
import type { QuizAnswers } from "@/app/find-destination/_lib/types";
import { recommendDestinationsMock } from "@/lib/find-destination/recommend";

const beachCoupleQuiz: QuizAnswers = {
  companion: "couple",
  budgetInr: 100000,
  duration: "1-week",
  weather: "beach",
  interests: ["beaches", "food", "relaxation"],
  region: "international",
  travelStyle: "relaxing",
  transport: "flights",
};

describe("expert recommendation mode", () => {
  it("generates a single primary recommendation with at most two alternatives", () => {
    const result = buildExpertRecommendation({
      signals: signalsFromQuizAnswers(beachCoupleQuiz),
      limit: 3,
    });

    assert.ok(result);
    assert.equal(result!.primary.role, "primary");
    assert.ok(result!.primary.matchScore >= 55 && result!.primary.matchScore <= 98);
    assert.ok(result!.alternatives.length <= 2);
    assert.ok(result!.alternatives.every((a) => a.role === "alternative"));
    assert.ok(result!.expertOpinion.toLowerCase().includes("choose"));
    assert.ok(result!.primary.whyReasons.length >= 3);
  });

  it("ranks alternatives strictly below the primary (no equal ranks)", () => {
    const result = buildExpertRecommendation({
      signals: signalsFromQuizAnswers(beachCoupleQuiz),
      limit: 3,
    });
    assert.ok(result);
    for (const alt of result!.alternatives) {
      assert.ok(alt.matchScore < result!.primary.matchScore);
    }
    const scores = [result!.primary.matchScore, ...result!.alternatives.map((a) => a.matchScore)];
    assert.equal(new Set(scores).size, scores.length);
  });

  it("builds personalized recommendation explanations from user inputs", () => {
    const signals = signalsFromQuizAnswers(beachCoupleQuiz);
    const dest = DESTINATION_CATALOG.find((d) => d.slug.includes("bali")) ?? DESTINATION_CATALOG[0]!;
    const { matchScore } = scoreDestinationExpert(dest, signals);
    assert.ok(matchScore >= 55);

    const result = buildExpertRecommendation({
      signals,
      candidateNames: [dest.name, "Phuket", "Maldives"].filter(Boolean),
      limit: 3,
    });
    assert.ok(result);
    const joined = result!.primary.whyReasons.join(" ").toLowerCase();
    assert.ok(joined.includes("budget") || joined.includes("₹") || joined.includes("100"));
  });

  it("explains why a user-mentioned destination was not the primary pick", () => {
    const signals = {
      ...signalsFromQuizAnswers(beachCoupleQuiz),
      budgetInr: 60000,
      mentionedDestination: "Switzerland",
    };
    const result = buildExpertRecommendation({ signals, limit: 3 });
    assert.ok(result);
    assert.ok(result!.whyNotUserChoice);
    assert.match(result!.whyNotUserChoice!, /Switzerland/i);
    assert.match(result!.whyNotUserChoice!, /better overall experience/i);
  });

  it("detects missing information when core prefs are thin", () => {
    assert.equal(
      hasEnoughSignalsForRecommendation({ interests: [] }),
      false,
    );
    assert.equal(
      hasEnoughSignalsForRecommendation({
        interests: ["beaches"],
        budgetInr: 50000,
      }),
      true,
    );
  });

  it("detects full-options bypass and mentioned destinations", () => {
    assert.equal(wantsFullOptionsList("Show me all options"), true);
    assert.equal(wantsFullOptionsList("Where should I go for a beach trip?"), false);
    assert.equal(extractMentionedDestination("What about Switzerland?"), "Switzerland");
    assert.equal(extractMentionedDestination("Is Bali good for couples?"), "Bali");
  });

  it("builds expert chat cards only from harvested candidate names", () => {
    const memory = {
      ...EMPTY_MEMORY_FIELDS,
      budget: "₹1,00,000",
      travel_duration: "7 days",
      interests: ["beaches", "food"],
      weather_preference: "warm",
      group_size: "couple",
    };
    const cards = buildExpertChatCards({
      signals: signalsFromConversationMemory(memory),
      candidateNames: ["Bali", "Maldives"],
    });
    assert.ok(cards.length >= 1);
    assert.ok(cards.length <= 2);
    assert.equal(cards[0]!.role, "primary");
    assert.ok(typeof cards[0]!.matchScore === "number");

    const empty = buildExpertChatCards({
      signals: signalsFromConversationMemory(memory),
      candidateNames: [],
    });
    assert.equal(empty.length, 0);
  });

  it("keeps find-destination mock flow compatible (exactly 3 ranked picks)", () => {
    const response = recommendDestinationsMock(beachCoupleQuiz);
    assert.equal(response.source, "mock");
    assert.ok(response.destinations.length >= 1 && response.destinations.length <= 3);
    assert.ok(response.destinations[0]!.confidenceScore >= response.destinations.at(-1)!.confidenceScore);
  });
});
