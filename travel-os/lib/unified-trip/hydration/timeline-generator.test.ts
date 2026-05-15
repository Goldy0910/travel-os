import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildTimelineSlots } from "./timeline-generator";
import type { NormalizedTripPlan } from "../types";

function planWithDayNumbers(dayNumbers: number[]): NormalizedTripPlan {
  return {
    destination: { name: "Spiti", canonicalLocation: "Spiti Valley" },
    summary: "",
    whyThisFits: [],
    budget: "",
    travelEffort: "",
    recommendationExplanation: "",
    days: dayNumbers.map((dayNumber, index) => ({
      dayNumber,
      title: `Day ${dayNumber}`,
      summary: `Summary ${index + 1}`,
      activities: [
        {
          id: `a-${index}`,
          title: `Activity ${index + 1}`,
          description: `Activity ${index + 1}`,
          location: "Spiti",
          startTime: "10:00",
          category: "sightseeing",
        },
      ],
    })),
  };
}

describe("buildTimelineSlots", () => {
  it("maps each plan day to a distinct calendar date by array order", () => {
    const dayIdByDate = new Map<string, string>([
      ["2026-05-29", "d1"],
      ["2026-05-30", "d2"],
      ["2026-05-31", "d3"],
    ]);
    const plan = planWithDayNumbers([1, 1, 2]);

    const slots = buildTimelineSlots(plan, "2026-05-29", "2026-05-31", dayIdByDate);

    assert.equal(slots.length, 3);
    assert.equal(slots[0]?.dateYmd, "2026-05-29");
    assert.equal(slots[1]?.dateYmd, "2026-05-30");
    assert.equal(slots[2]?.dateYmd, "2026-05-31");
    assert.equal(slots[0]?.dayNumber, 1);
    assert.equal(slots[1]?.dayNumber, 2);
    assert.equal(slots[2]?.dayNumber, 3);
  });

  it("drops plan days beyond the trip date range", () => {
    const dayIdByDate = new Map<string, string>([["2026-05-29", "d1"]]);
    const plan = planWithDayNumbers([1, 2]);

    const slots = buildTimelineSlots(plan, "2026-05-29", "2026-05-29", dayIdByDate);

    assert.equal(slots.length, 1);
    assert.equal(slots[0]?.dateYmd, "2026-05-29");
  });
});
