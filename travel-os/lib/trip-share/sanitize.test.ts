import assert from "node:assert/strict";
import test from "node:test";
import { buildPublicTripShareSnapshot } from "@/lib/trip-share/sanitize";
import type { MasterTripFile } from "@/lib/master-trip-file/types";

const baseFile: MasterTripFile = {
  schemaVersion: 1,
  preferences: { days: 5, priorities: ["culture"] },
  destination: {
    name: "Goa",
    slug: "goa",
    canonicalLocation: "Goa, India",
    country: "India",
  },
  recommendation: {
    mode: "recommendation",
    whyItFits: ["Beach + culture", "contact me at test@example.com"],
    explanation: "Great fit",
    travelEffort: "Easy",
    budgetEstimate: "₹40k",
    alternatives: [],
  },
  itinerary: [
    { id: "d1", dayNumber: 1, title: "Arrive", summary: "North Goa beaches" },
  ],
  practical: {
    travelEffort: "Easy",
    budgetEstimate: "₹40k",
  },
  refinementHistory: [],
  edits: [],
  refinementChat: { messages: [{ id: "m1", role: "user", content: "secret", at: "" }] },
  metadata: {
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    source: "homepage",
  },
};

test("buildPublicTripShareSnapshot strips emails and omits chat", () => {
  const snap = buildPublicTripShareSnapshot(baseFile);
  assert.equal(snap.destination.name, "Goa");
  assert.ok(!snap.whyItFits.some((l) => l.includes("@")));
  assert.equal(snap.durationDays, 5);
  assert.equal(snap.itineraryPreview.length, 1);
});
