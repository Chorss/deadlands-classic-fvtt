/**
 * Unit tests for gm-proxy dispatch — Foundry globals (game/ui/foundry/CONFIG)
 * are stubbed as plain objects. Covers retry-with-same-opId, the GM-local
 * failure notification (previously silent), and registerGmOp's opId dedup.
 */

import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { dispatchGmOp, registerGmOp } from "../module/core/gm-proxy.mjs";

let notifications;
// Persistent across installGlobals so every dispatch gets a distinct opId —
// the module-level dedup cache is shared by all tests in this file.
let ridCounter = 0;

function installGlobals({ activeGM = null } = {}) {
  notifications = { warn: [], error: [] };
  globalThis.CONFIG = { queries: {} };
  globalThis.foundry = { utils: { randomID: () => `rid${ridCounter++}` } };
  globalThis.ui = {
    notifications: {
      warn: (m) => notifications.warn.push(m),
      error: (m) => notifications.error.push(m),
    },
  };
  globalThis.game = {
    user: { id: "u1", isGM: Boolean(activeGM?.isSelf) },
    users: { activeGM },
    i18n: { localize: (k) => k },
  };
}

describe("dispatchGmOp", () => {
  beforeEach(() => installGlobals());

  it("warns and throws when no GM is active", async () => {
    installGlobals({ activeGM: null });
    await assert.rejects(() => dispatchGmOp("sys.noGm", { op: "x" }), /no active GM/);
    assert.equal(notifications.warn.length, 1);
  });

  it("runs the handler locally when this client is the GM, stripping opId", async () => {
    installGlobals({ activeGM: { isSelf: true } });
    let seen = null;
    registerGmOp("sys.localOk", (data) => {
      seen = data;
      return { ok: true };
    });
    const res = await dispatchGmOp("sys.localOk", { op: "ping" });
    assert.deepEqual(res, { ok: true });
    assert.deepEqual(seen, { op: "ping" });
    assert.equal(notifications.error.length, 0);
  });

  it("notifies on a GM-local handler failure (previously silent)", async () => {
    installGlobals({ activeGM: { isSelf: true } });
    registerGmOp("sys.localFail", () => {
      throw new Error("local boom");
    });
    await assert.rejects(() => dispatchGmOp("sys.localFail", { op: "x" }), /local boom/);
    assert.equal(notifications.error.length, 1);
  });

  it("retries a timed-out query once with the same opId and succeeds", async () => {
    let attempts = 0;
    const seenIds = [];
    installGlobals({
      activeGM: {
        isSelf: false,
        query: async (_name, payload) => {
          attempts++;
          seenIds.push(payload.opId);
          if (attempts === 1) {
            throw new Error("timeout");
          }
          return { ok: true };
        },
      },
    });
    const res = await dispatchGmOp("sys.retry", { op: "x" });
    assert.deepEqual(res, { ok: true });
    assert.equal(attempts, 2);
    assert.equal(seenIds[0], seenIds[1]);
    assert.equal(notifications.error.length, 0);
  });

  it("shows the failure notification once after exhausting retries", async () => {
    installGlobals({
      activeGM: {
        isSelf: false,
        query: async () => {
          throw new Error("timeout");
        },
      },
    });
    await assert.rejects(() => dispatchGmOp("sys.fail", { op: "x" }), /timeout/);
    assert.equal(notifications.error.length, 1);
  });
});

describe("registerGmOp dedup", () => {
  beforeEach(() => installGlobals({ activeGM: { isSelf: true } }));

  it("collapses ops with the same opId onto one handler run", async () => {
    let calls = 0;
    registerGmOp("sys.dedup", async () => {
      calls++;
      return calls;
    });
    const wrapped = CONFIG.queries["sys.dedup"];
    const a = await wrapped({ opId: "fixed-op", op: "x" }, { user: game.user });
    const b = await wrapped({ opId: "fixed-op", op: "x" }, { user: game.user });
    assert.equal(a, 1);
    assert.equal(b, 1);
    assert.equal(calls, 1);
  });
});
