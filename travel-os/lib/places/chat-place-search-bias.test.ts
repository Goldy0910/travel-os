import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  placeCardLooksLikeUserHomeLeak,
  resolveChatPlaceSearchBias,
  searchQueryForPlace,
} from "./chat-place-search-bias";

describe("resolveChatPlaceSearchBias", () => {
  it("does not ground Munnar/Coorg/Wayanad recs in the user's Hyderabad location", () => {
    const bias = resolveChatPlaceSearchBias({
      userMessage: "Suggest a 4-day trip from Hyderabad — Munnar, Coorg or Wayanad?",
      replyText:
        "I'd compare **Munnar**, **Coorg**, and **Wayanad**. Coorg has Abbey Falls; Wayanad has Edakkal Caves.",
      entities: [
        { type: "city", name: "Munnar" },
        { type: "city", name: "Coorg" },
        { type: "city", name: "Wayanad" },
        { type: "attraction", name: "Abbey Falls" },
        { type: "attraction", name: "Edakkal Caves" },
      ],
      userCity: "Hyderabad",
      preferredDestination: null,
      candidateDestinations: [],
    });

    assert.ok(bias.replyDestinations.includes("Munnar"));
    assert.ok(bias.replyDestinations.includes("Coorg"));
    assert.ok(bias.replyDestinations.includes("Wayanad"));
    assert.equal(bias.defaultBias, null);
    assert.equal(bias.rejectAddressCity, "Hyderabad");
    assert.equal(searchQueryForPlace("Munnar", bias, ""), "Munnar");
    assert.equal(searchQueryForPlace("Coorg", bias, ""), "Coorg");
    assert.equal(
      searchQueryForPlace(
        "Abbey Falls",
        bias,
        "Coorg has Abbey Falls; Wayanad has Edakkal Caves.",
      ),
      "Abbey Falls, Coorg",
    );
    assert.equal(
      searchQueryForPlace(
        "Edakkal Caves",
        bias,
        "Coorg has Abbey Falls; Wayanad has Edakkal Caves.",
      ),
      "Edakkal Caves, Wayanad",
    );
  });

  it("uses user city only for true nearby / home recs", () => {
    const bias = resolveChatPlaceSearchBias({
      userMessage: "Best cafes near me this evening?",
      replyText: "Try Third Wave Coffee in Banjara Hills.",
      entities: [{ type: "cafe", name: "Third Wave Coffee" }],
      userCity: "Hyderabad",
    });
    assert.equal(bias.defaultBias, "Hyderabad");
    assert.equal(bias.rejectAddressCity, null);
    assert.equal(
      searchQueryForPlace("Third Wave Coffee", bias, ""),
      "Third Wave Coffee, Hyderabad",
    );
  });

  it("prefers trip destination over user home city", () => {
    const bias = resolveChatPlaceSearchBias({
      replyText: "Start at Palolem Beach then Anjuna.",
      entities: [
        { type: "beach", name: "Palolem Beach" },
        { type: "market", name: "Anjuna Flea Market" },
      ],
      tripDestination: "Goa",
      userCity: "Hyderabad",
    });
    assert.equal(bias.defaultBias, "Goa");
    assert.equal(bias.rejectAddressCity, "Hyderabad");
    assert.equal(searchQueryForPlace("Palolem Beach", bias, ""), "Palolem Beach, Goa");
  });
});

describe("placeCardLooksLikeUserHomeLeak", () => {
  it("drops Hyderabad restaurants when the reply is about hill stations", () => {
    const bias = resolveChatPlaceSearchBias({
      replyText: "Go to Munnar or Coorg.",
      entities: [
        { type: "city", name: "Munnar" },
        { type: "city", name: "Coorg" },
      ],
      userCity: "Hyderabad",
    });
    assert.equal(
      placeCardLooksLikeUserHomeLeak(
        {
          name: "Coorg Restaurant",
          address: "Banjara Hills, Hyderabad, Telangana, India",
        },
        bias,
      ),
      true,
    );
    assert.equal(
      placeCardLooksLikeUserHomeLeak(
        {
          name: "Munnar",
          address: "Munnar, Idukki, Kerala, India",
        },
        bias,
      ),
      false,
    );
  });
});
