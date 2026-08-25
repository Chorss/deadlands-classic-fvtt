import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findRuleIssues } from "../tools/audit-rules-lib.mjs";
import { catalogDigest, validateRulesCatalog } from "../tools/rules-catalog-lib.mjs";

function fixtureCatalog() {
  const catalog = {
    schemaVersion: 1,
    sourceRevision: "1".repeat(40),
    sources: {
      dlc: { pages: 412, sha256: "2".repeat(64) },
    },
  };
  catalog.catalogSha256 = catalogDigest(catalog);
  return catalog;
}

describe("public rules catalog", () => {
  it("accepts valid metadata and its integrity digest", () => {
    assert.deepEqual(validateRulesCatalog(fixtureCatalog()), []);
  });

  it("fails when the catalog is missing", () => {
    assert.deepEqual(validateRulesCatalog(null), ["catalog is missing or invalid"]);
  });

  it("detects changed source hashes", () => {
    const catalog = fixtureCatalog();
    catalog.sources.dlc.sha256 = "3".repeat(64);
    assert.deepEqual(validateRulesCatalog(catalog), ["catalog SHA-256 mismatch"]);
  });
});

describe("rules evidence audit", () => {
  it("accepts a known in-range citation", () => {
    assert.deepEqual(findRuleIssues("docs/example.md", "See `dlc p.29`.", fixtureCatalog()), []);
  });

  it("rejects unknown slugs and out-of-range pages", () => {
    assert.deepEqual(
      findRuleIssues("docs/example.md", "See `dcl p.29` and `dlc p.999`.", fixtureCatalog()),
      [
        "docs/example.md:1: unknown rulebook slug dcl",
        "docs/example.md:1: dlc p.999 exceeds 412 pages",
      ]
    );
  });

  it("requires evidence in mechanic content JSON", () => {
    const text = JSON.stringify({ type: "edge", name: "Example", system: {} });
    assert.deepEqual(findRuleIssues("content/_source/edges/example.json", text, fixtureCatalog()), [
      "content/_source/edges/example.json: mechanic JSON has no <slug> p.N citation",
    ]);
  });
});
