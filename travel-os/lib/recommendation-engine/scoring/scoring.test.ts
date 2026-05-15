import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { recommendDestinations } from "../recommendation/recommend";
import { validateDestinationInput } from "../validation/validate-destination";
import { rankDestinations } from "./rank-destinations";

describe("recommendation engine scoring", () => {
  it("ranks relaxing budget 3-day trips with Coorg/Ooty/Pondicherry highly", () => {
    const ranked = rankDestinations(
      {
        days: 3,
        priorities: ["relaxing", "budget-friendly"],
        budget: "budget",
        originCity: "Bangalore",
      },
      { limit: 5 },
    );

    const top3 = ranked.slice(0, 3).map((r) => r.destination.slug);
    assert.ok(top3.includes("coorg-india") || top3.includes("ooty-india"));
    assert.ok(
      top3.includes("pondicherry-india") ||
        top3.includes("coorg-india") ||
        top3.includes("ooty-india"),
    );
  });

  it("returns structured recommendation payload", () => {
    const result = recommendDestinations({
      days: 3,
      priorities: ["relaxing"],
      budget: "budget",
      originCity: "Bangalore",
    });

    assert.equal(result.mode, "recommendation");
    assert.ok(result.fitScore > 0);
    assert.ok(result.whyItFits.length > 0);
    assert.ok(result.itinerary.length > 0);
    assert.ok(result.ranking.length >= 3);
    assert.equal(result.scoreBreakdown.total, result.fitScore);
  });

  it("validates weak fit for Ladakh on a 2-day trip", () => {
    const result = validateDestinationInput({
      days: 2,
      priorities: ["adventure"],
      destination: "Ladakh",
      originCity: "Mumbai",
    });

    assert.equal(result.mode, "validation");
    assert.equal(result.fit, "weak");
    assert.ok(result.alternatives.length >= 1);
  });

  it("validates strong fit for Goa weekend from Mumbai", () => {
    const result = validateDestinationInput({
      days: 3,
      priorities: ["relaxing", "budget-friendly"],
      budget: "budget",
      destination: "Goa",
      originCity: "Mumbai",
    });

    assert.equal(result.mode, "validation");
    assert.ok(result.fit === "strong" || result.fit === "moderate");
    assert.ok(result.fitScore >= 55);
  });
});
