import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyInterestEvent, emptyInterestCounters } from "./apply";
import { displayInterestCount, formatDestinationInterestLabel } from "./format";
import { InMemoryDestinationInterestStore } from "./memory-store";
import {
  detectRegisteredDestinationsInText,
  destinationInterestTargetsFromChat,
} from "./from-chat";
import {
  resolveTopLevelDestination,
  resolveTopLevelDestinations,
  isAcceptableDestinationId,
} from "./resolve";
import { DestinationInterestService } from "./service";
import { getCurrentInterestPeriod, isSameInterestPeriod } from "./time";
import { parseInterestIdList, parseTrackPayload } from "./validate";

describe("destination filtering", () => {
  it("tracks top-level destinations and ignores attractions/POIs", () => {
    assert.equal(resolveTopLevelDestination({ name: "Manali", type: "city" })?.id, "manali-india");
    assert.equal(resolveTopLevelDestination({ name: "Goa", type: "place" })?.id, "goa-india");
    assert.equal(resolveTopLevelDestination({ name: "Bali" })?.id, "bali-indonesia");
    assert.equal(resolveTopLevelDestination({ name: "Japan", type: "country" })?.id, "japan");
    assert.equal(resolveTopLevelDestination({ name: "Switzerland" })?.id, "switzerland");

    assert.equal(resolveTopLevelDestination({ name: "Rohtang Pass", type: "place" }), null);
    assert.equal(resolveTopLevelDestination({ name: "Solang Valley", type: "attraction" }), null);
    assert.equal(resolveTopLevelDestination({ name: "Hadimba Temple", type: "temple" }), null);
    assert.equal(resolveTopLevelDestination({ name: "Cafe 1947", type: "cafe" }), null);
    assert.equal(resolveTopLevelDestination({ name: "Marriott Goa", type: "hotel" }), null);
    assert.equal(resolveTopLevelDestination({ name: "River rafting", type: "activity" }), null);
  });

  it("filters a mixed AI entity list down to destinations only", () => {
    const resolved = resolveTopLevelDestinations([
      { name: "Manali", type: "city" },
      { name: "Hadimba Temple", type: "temple" },
      { name: "Cafe 1947", type: "cafe" },
      { name: "Goa", type: "place" },
      { name: "River rafting", type: "activity" },
    ]);
    assert.deepEqual(
      resolved.map((d) => d.id).sort(),
      ["goa-india", "manali-india"],
    );
  });
});

describe("unique traveler + event counting", () => {
  it("counts one unique traveler across many events from the same user", async () => {
    const store = new InMemoryDestinationInterestStore({ year: 2026, month: 8 });
    const actor = "user-a";
    await store.track({ destinationId: "manali-india", eventType: "SEARCH", actorId: actor });
    await store.track({ destinationId: "manali-india", eventType: "SEARCH", actorId: actor });
    await store.track({ destinationId: "manali-india", eventType: "DETAIL_VIEW", actorId: actor });
    await store.track({ destinationId: "manali-india", eventType: "TRIP_ADD", actorId: actor });

    const row = await store.getMonthly("manali-india", { year: 2026, month: 8 });
    assert.ok(row);
    assert.equal(row.unique_travelers, 1);
    assert.equal(row.search_count, 2);
    assert.equal(row.detail_view_count, 1);
    assert.equal(row.trip_add_count, 1);
    assert.equal(row.total_interest, 4);
  });

  it("increments unique travelers only for first monthly event per user", async () => {
    const store = new InMemoryDestinationInterestStore({ year: 2026, month: 8 });
    await store.track({ destinationId: "goa-india", eventType: "SEARCH", actorId: "a" });
    await store.track({ destinationId: "goa-india", eventType: "AI_RECOMMENDED", actorId: "b" });
    await store.track({ destinationId: "goa-india", eventType: "FAVORITE", actorId: "a" });
    const row = await store.getMonthly("goa-india", { year: 2026, month: 8 });
    assert.equal(row?.unique_travelers, 2);
    assert.equal(row?.ai_recommendation_count, 1);
    assert.equal(row?.favorite_count, 1);
  });

  it("applies the pure reducer without mutating the previous state", () => {
    const start = emptyInterestCounters();
    const next = applyInterestEvent(start, "SEARCH", true);
    assert.equal(start.uniqueTravelers, 0);
    assert.equal(next.uniqueTravelers, 1);
    assert.equal(next.searchCount, 1);
    const again = applyInterestEvent(next, "DETAIL_VIEW", false);
    assert.equal(again.uniqueTravelers, 1);
    assert.equal(again.detailViewCount, 1);
    assert.equal(again.totalInterest, 2);
  });
});

describe("monthly reset", () => {
  it("keeps previous months and starts fresh next month", async () => {
    const august = new InMemoryDestinationInterestStore({ year: 2026, month: 8 });
    const september = new InMemoryDestinationInterestStore({ year: 2026, month: 9 });
    await august.track({ destinationId: "bali-indonesia", eventType: "SEARCH", actorId: "a" });

    assert.equal(
      (await august.getMonthly("bali-indonesia", { year: 2026, month: 8 }))?.unique_travelers,
      1,
    );
    assert.equal(await september.getMonthly("bali-indonesia", { year: 2026, month: 9 }), null);

    await september.track({ destinationId: "bali-indonesia", eventType: "SEARCH", actorId: "a" });
    assert.equal(
      (await september.getMonthly("bali-indonesia", { year: 2026, month: 9 }))?.unique_travelers,
      1,
    );
  });

  it("uses the current UTC calendar month automatically", () => {
    const now = new Date("2026-08-05T12:00:00.000Z");
    const later = new Date("2026-09-01T00:00:00.000Z");
    const a = getCurrentInterestPeriod(now);
    const b = getCurrentInterestPeriod(later);
    assert.deepEqual(a, { year: 2026, month: 8 });
    assert.deepEqual(b, { year: 2026, month: 9 });
    assert.equal(isSameInterestPeriod(a, b), false);
  });
});

describe("API validation", () => {
  it("accepts valid track payloads and rejects bad ones", () => {
    assert.deepEqual(parseTrackPayload({ destinationId: "manali-india", eventType: "SEARCH" }), {
      ok: true,
      destinationId: "manali-india",
      eventType: "SEARCH",
    });
    assert.equal(parseTrackPayload({ destinationId: "hadimba-temple", eventType: "SEARCH" }).ok, false);
    assert.equal(parseTrackPayload({ destinationId: "manali-india", eventType: "CLICK" }).ok, false);
    assert.equal(parseTrackPayload(null).ok, false);
    assert.equal(parseTrackPayload({ eventType: "SEARCH" }).ok, false);
  });

  it("batches destination ids and drops invalid / duplicate entries", () => {
    const parsed = parseInterestIdList("manali-india, goa-india, manali-india, hadimba-temple, bali-indonesia");
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.deepEqual(parsed.destinationIds, ["manali-india", "goa-india", "bali-indonesia"]);
  });

  it("rejects empty batch lists", () => {
    assert.equal(parseInterestIdList("").ok, false);
    assert.equal(parseInterestIdList("rohtang-pass, cafe-1947").ok, false);
  });
});

describe("badge rendering", () => {
  it("hides zero, singularizes one, and pluralizes many", () => {
    assert.equal(formatDestinationInterestLabel(0), null);
    assert.equal(formatDestinationInterestLabel(-1), null);
    assert.equal(
      formatDestinationInterestLabel(1),
      "1 traveler explored this destination this month",
    );
    assert.equal(
      formatDestinationInterestLabel(124),
      "124 travelers explored this destination this month",
    );
    assert.equal(displayInterestCount({ uniqueTravelers: 1, totalInterest: 8 }), 8);
    assert.equal(displayInterestCount({ uniqueTravelers: 3 }), 3);
  });
});

describe("batching + service integration flows", () => {
  it("reads many destinations in one store round-trip", async () => {
    const store = new InMemoryDestinationInterestStore(getCurrentInterestPeriod());
    const service = new DestinationInterestService(store);
    await store.track({ destinationId: "manali-india", eventType: "AI_RECOMMENDED", actorId: "u1" });
    await store.track({ destinationId: "goa-india", eventType: "AI_RECOMMENDED", actorId: "u2" });
    await store.track({ destinationId: "bali-indonesia", eventType: "AI_RECOMMENDED", actorId: "u1" });

    const batch = await service.getInterestBatch(["manali-india", "goa-india", "bali-indonesia", "shimla-india"]);
    assert.equal(batch.length, 4);
    assert.equal(batch.find((r) => r.destinationId === "manali-india")?.uniqueTravelers, 1);
    assert.equal(batch.find((r) => r.destinationId === "shimla-india")?.uniqueTravelers, 0);
    assert.equal(batch.find((r) => r.destinationId === "goa-india")?.recommendationCount, 1);
  });

  it("covers search, recommendation, details, trip add, and favorite event types", async () => {
    const store = new InMemoryDestinationInterestStore(getCurrentInterestPeriod());
    const service = new DestinationInterestService(store);
    const dest = "switzerland";
    await service.trackSearch(dest, "user-1");
    await service.trackRecommendation(dest, "user-1");
    await service.trackView(dest, "user-2");
    await service.trackTripAdd(dest, "user-2");
    await service.trackFavorite(dest, "user-3");

    const snap = await service.getInterest(dest);
    assert.ok(snap);
    assert.equal(snap.uniqueTravelers, 3);
    assert.equal(snap.searchCount, 1);
    assert.equal(snap.recommendationCount, 1);
    assert.equal(snap.detailViewCount, 1);
    assert.equal(snap.tripAddCount, 1);
    assert.equal(snap.favoriteCount, 1);
    assert.equal(snap.totalInterest, 5);
    assert.equal(snap.month, getCurrentInterestPeriod().month);
    assert.equal(snap.year, getCurrentInterestPeriod().year);
  });

  it("skips non-destinations at the service boundary", async () => {
    const store = new InMemoryDestinationInterestStore(getCurrentInterestPeriod());
    const service = new DestinationInterestService(store);
    const result = await service.track("hadimba-temple", "DETAIL_VIEW", "user-1");
    assert.equal(result.skipped, "not_destination");
    assert.equal(store.events.length, 0);
  });

  it("does not count anonymous-looking empty actors", async () => {
    const store = new InMemoryDestinationInterestStore(getCurrentInterestPeriod());
    const service = new DestinationInterestService(store);
    const result = await service.trackSearch("goa-india", "   ");
    assert.equal(result.skipped, "unauthenticated");
    assert.equal(store.events.length, 0);
  });
});

describe("chat destination extraction", () => {
  it("finds Manali in assistant prose even when entities are only attractions", () => {
    const text =
      "In Manali, start with Hadimba Temple, wander Old Manali, then ride up to Solang Valley.";
    assert.deepEqual(
      detectRegisteredDestinationsInText(text).map((d) => d.id),
      ["manali-india"],
    );
    const targets = destinationInterestTargetsFromChat({
      entities: [
        { name: "Hadimba Temple", type: "temple" },
        { name: "Old Manali", type: "place" },
        { name: "Solang Valley", type: "attraction" },
      ],
      text,
    });
    assert.deepEqual(
      targets.map((t) => t.destinationId),
      ["manali-india"],
    );
  });

  it("uses conversation memory only when the message itself has no destination", () => {
    const fromMemory = destinationInterestTargetsFromChat({
      entities: [{ name: "Cafe 1947", type: "cafe" }],
      text: "This cafe is a classic riverside stop.",
      memoryDestinations: ["Manali", "Goa"],
    });
    assert.deepEqual(
      fromMemory.map((t) => t.destinationId),
      ["manali-india"],
    );
  });
});

describe("acceptable destination ids", () => {
  it("allows registry ids and rejects poi-like slugs", () => {
    assert.equal(isAcceptableDestinationId("manali-india"), true);
    assert.equal(isAcceptableDestinationId("japan"), true);
    assert.equal(isAcceptableDestinationId("hadimba-temple"), false);
    assert.equal(isAcceptableDestinationId("marriott-goa"), false);
  });
});
