import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filterEntitiesForPlaceCards,
  isBlockedChatEntityName,
  mergeChatEntities,
  normalizeChatEntities,
  parseStructuredChatResponse,
} from "./structured-response";

describe("blocked chat entity names", () => {
  it("blocks product and assistant role phrases", () => {
    assert.equal(isBlockedChatEntityName("Travel Buddy"), true);
    assert.equal(isBlockedChatEntityName("Travel Till"), true);
    assert.equal(isBlockedChatEntityName("Travel Till 99"), true);
    assert.equal(isBlockedChatEntityName("your travel buddy"), true);
    assert.equal(isBlockedChatEntityName("Palolem Beach"), false);
    assert.equal(isBlockedChatEntityName("Manali"), false);
  });

  it("drops branding entities from normalize / merge / filter", () => {
    assert.deepEqual(
      normalizeChatEntities([
        { type: "place", name: "Travel Buddy" },
        { type: "beach", name: "Palolem Beach" },
        { type: "place", name: "Travel Till" },
      ]),
      [{ type: "beach", name: "Palolem Beach" }],
    );
    assert.deepEqual(
      mergeChatEntities(
        [{ type: "place", name: "Travel Till 99" }],
        [{ type: "cafe", name: "Cafe 1947" }],
      ),
      [{ type: "cafe", name: "Cafe 1947" }],
    );
    assert.deepEqual(
      filterEntitiesForPlaceCards([
        { type: "place", name: "Travel Buddy" },
        { type: "place", name: "Hadimba Temple" },
      ]),
      [{ type: "place", name: "Hadimba Temple" }],
    );
  });

  it("keeps greeting replies without place cards when only branding entities are present", () => {
    const parsed = parseStructuredChatResponse(
      JSON.stringify({
        response: "Hi! I'm your Travel Buddy for Travel Till 99 — ready to plan an amazing trip.",
        entities: [
          { type: "place", name: "Travel Buddy" },
          { type: "place", name: "Travel Till" },
        ],
      }),
    );
    assert.match(parsed.response, /Hi!/);
    assert.deepEqual(parsed.entities, []);
  });
});
