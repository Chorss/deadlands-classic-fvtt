import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findRuntimeContractIssues } from "../tools/audit-i18n-lib.mjs";

const KEY = "DEADLANDS.Trait.Deftness.Label";
const RUNTIME_MARKER = "$" + "{…}";
const EXPRESSION = `DEADLANDS.Trait.${RUNTIME_MARKER}`;

describe("runtime i18n contracts", () => {
  it("accepts explicit keys for an observed runtime expression", () => {
    const config = {
      schemaVersion: 1,
      contracts: [{ expression: EXPRESSION, keys: [KEY] }],
    };
    assert.deepEqual(findRuntimeContractIssues([EXPRESSION], new Set([KEY]), config), []);
  });

  it("detects an unused exception after its runtime expression is removed", () => {
    const config = {
      schemaVersion: 1,
      contracts: [{ expression: EXPRESSION, keys: [KEY] }],
    };
    assert.deepEqual(findRuntimeContractIssues([], new Set([KEY]), config), [
      `unused runtime exception: ${EXPRESSION}`,
    ]);
  });

  it("rejects an unlisted expression and missing or wildcard keys", () => {
    const config = {
      schemaVersion: 1,
      contracts: [{ expression: EXPRESSION, keys: ["DEADLANDS.Trait.*"] }],
    };
    const unlisted = `DEADLANDS.Chip.${RUNTIME_MARKER}`;
    assert.deepEqual(findRuntimeContractIssues([unlisted], new Set(), config), [
      `unused runtime exception: ${EXPRESSION}`,
      "runtime contract contains a non-explicit key: DEADLANDS.Trait.*",
      `runtime expression has no explicit key contract: ${unlisted}`,
    ]);
  });
});
