import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CANONICAL_PUBLIC_ORIGIN,
  ensureBrandShareUrl,
  isBrandPublicOrigin,
  isEphemeralPublicOrigin,
  normalizePublicOrigin,
} from "./public-site-url-shared";

describe("public site url shared", () => {
  it("normalizes www to apex brand domain", () => {
    assert.equal(normalizePublicOrigin("https://www.traveltill99.com/"), CANONICAL_PUBLIC_ORIGIN);
    assert.equal(isBrandPublicOrigin("https://traveltill99.com"), true);
  });

  it("treats vercel.app as ephemeral", () => {
    assert.equal(isEphemeralPublicOrigin("https://travel-os-abc.vercel.app"), true);
    assert.equal(isEphemeralPublicOrigin("https://traveltill99.com"), false);
  });

  it("rewrites stale hosts to traveltill99.com for invite links", () => {
    assert.equal(
      ensureBrandShareUrl("https://old-app.vercel.app/join?code=ABC123"),
      "https://old-app.vercel.app/join?code=ABC123",
    );
    assert.equal(
      ensureBrandShareUrl("https://legacy.example.com/join?code=ABC123"),
      `${CANONICAL_PUBLIC_ORIGIN}/join?code=ABC123`,
    );
    assert.equal(
      ensureBrandShareUrl("https://www.traveltill99.com/join?code=ABC123"),
      `${CANONICAL_PUBLIC_ORIGIN}/join?code=ABC123`,
    );
  });
});
