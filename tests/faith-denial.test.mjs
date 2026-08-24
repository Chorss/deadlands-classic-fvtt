import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getActiveFaithDenialEffect,
  isFaithDenialEffect,
} from "../module/archetypes/blessed/faith-denial.mjs";

function effect(overrides = {}) {
  return {
    id: "faith-denial",
    active: true,
    disabled: false,
    duration: { expired: false, remaining: 10 },
    flags: { "deadlands-classic": { faithDenial: { severity: "minor" } } },
    ...overrides,
  };
}

describe("faith-denial Active Effect selection", () => {
  it("recognizes only effects with a valid severity flag", () => {
    assert.equal(isFaithDenialEffect(effect()), true);
    assert.equal(isFaithDenialEffect(effect({ flags: {} })), false);
    assert.equal(
      isFaithDenialEffect(
        effect({ flags: { "deadlands-classic": { faithDenial: { severity: "unknown" } } } })
      ),
      false
    );
  });

  it("returns an active, enabled and unexpired effect", () => {
    const active = effect();
    const actor = {
      effects: [
        effect({ id: "disabled", disabled: true, active: false }),
        effect({ id: "expired", duration: { expired: true, remaining: 0 }, active: false }),
        active,
      ],
    };
    assert.equal(getActiveFaithDenialEffect(actor), active);
  });

  it("does not block access for disabled or expired effects", () => {
    assert.equal(
      getActiveFaithDenialEffect({ effects: [effect({ disabled: true, active: false })] }),
      undefined
    );
    assert.equal(
      getActiveFaithDenialEffect({
        effects: [effect({ duration: { expired: true, remaining: 0 }, active: false })],
      }),
      undefined
    );
  });
});
