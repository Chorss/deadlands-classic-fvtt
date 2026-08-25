import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findPrBodyIssues } from "../tools/pr-body-lib.mjs";

function body({ foundry = false, mechanic = false, untested = "None" } = {}) {
  return `
## Foundry impact
- [${foundry ? " " : "x"}] No Foundry runtime, UI, or API impact
- [${foundry ? "x" : " "}] Foundry runtime, UI, or API impact — E2E is required
- [${foundry ? " " : "x"}] Foundry E2E not required — no runtime, UI, or API impact
- [${foundry ? "x" : " "}] Foundry E2E passed — 10/10 on Foundry 14.367
## Deadlands mechanics and content
- [${mechanic ? " " : "x"}] No Deadlands mechanic or content impact
- [${mechanic ? "x" : " "}] Deadlands mechanic or content impact — evidence is required
## Rulebook evidence
${mechanic ? "dlc p.29" : "N/A"}
## Verification
- [x] \`npm run verify:ci\` passes
## Untested
${untested}
`;
}

describe("pull request readiness", () => {
  it("accepts an explicitly verified non-runtime change", () => {
    assert.deepEqual(findPrBodyIssues(body()), []);
  });

  it("accepts a 10/10 Foundry result and rulebook citation", () => {
    assert.deepEqual(findPrBodyIssues(body({ foundry: true, mechanic: true })), []);
  });

  it("blocks a runtime PR whose required Foundry result is unchecked", () => {
    const invalid = body({ foundry: true }).replace(
      "- [x] Foundry E2E passed — 10/10 on Foundry 14.367",
      "- [ ] Foundry E2E passed — 10/10 on Foundry 14.367"
    );
    assert.match(findPrBodyIssues(invalid).join("\n"), /10\/10 E2E/);
  });

  it("rejects missing evidence and an empty untested disclosure", () => {
    const invalid = body({ mechanic: true, untested: "<!-- placeholder -->" }).replace(
      "dlc p.29",
      "N/A"
    );
    assert.deepEqual(findPrBodyIssues(invalid), [
      "mechanic/content changes require at least one <slug> p.N citation",
      'Untested section must say "None" or list untested work',
    ]);
  });
});
