import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractSourcesOfTruthTable, findCitationIssues } from "../tools/audit-docs-lib.mjs";

describe("documentation citation parsing", () => {
  const catalog = new Map([
    ["dlc", 412],
    ["hnh", 128],
  ]);

  it("rejects an unknown rulebook slug instead of silently skipping it", () => {
    assert.deepEqual(findCitationIssues("Raises: `dcl p.29`.", catalog), [
      { type: "unknown-slug", slug: "dcl" },
    ]);
  });

  it("rejects either endpoint of an out-of-range citation", () => {
    assert.deepEqual(findCitationIssues("See `hnh p.120-140`.", catalog), [
      { type: "out-of-range", slug: "hnh", page: 140, pages: 128 },
    ]);
  });

  it("accepts known citations and ordinary prose page references", () => {
    assert.deepEqual(findCitationIssues("See `dlc p.29` and the sheet on page 412.", catalog), []);
  });
});

describe("CLAUDE.md Sources of truth parsing", () => {
  it("returns only the table under the Sources of truth heading", () => {
    const markdown = `
# Guide

Incidental reference: \`docs/notes.md\`.

## Sources of truth

| Topic | Location |
|---|---|
| Architecture | \`docs/architecture.md\` |

## Later section

Another reference: \`docs/testing-e2e.md\`.
`;
    const table = extractSourcesOfTruthTable(markdown);

    assert.match(table.text, /docs\/architecture\.md/);
    assert.doesNotMatch(table.text, /docs\/notes\.md/);
    assert.doesNotMatch(table.text, /docs\/testing-e2e\.md/);
  });

  it("does not borrow a similarly shaped table from a later section", () => {
    const markdown = `
## Sources of truth

No table here.

## Other

| Topic | Location |
|---|---|
| Notes | \`docs/notes.md\` |
`;

    assert.equal(extractSourcesOfTruthTable(markdown).text, "");
  });
});
