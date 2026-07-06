/**
 * Unit tests for OpDedupCache — pure, no Foundry runtime.
 * Uses an injected clock so TTL expiry is deterministic.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OpDedupCache } from "../module/core/op-dedup.mjs";

describe("OpDedupCache", () => {
  it("runs the task once and replays the settled result for the same opId", async () => {
    const cache = new OpDedupCache();
    let calls = 0;
    const task = async () => {
      calls++;
      return "result";
    };

    const first = await cache.run("op-1", task);
    const second = await cache.run("op-1", task);

    assert.equal(first, "result");
    assert.equal(second, "result");
    assert.equal(calls, 1);
  });

  it("shares a single in-flight run for concurrent calls with the same opId", async () => {
    const cache = new OpDedupCache();
    let calls = 0;
    const task = () =>
      new Promise((resolve) => {
        calls++;
        setTimeout(() => resolve("done"), 5);
      });

    // Both issued before the first resolves — must collapse to one run.
    const [a, b] = await Promise.all([cache.run("op-2", task), cache.run("op-2", task)]);

    assert.equal(a, "done");
    assert.equal(b, "done");
    assert.equal(calls, 1);
  });

  it("runs every time when no opId is given", async () => {
    const cache = new OpDedupCache();
    let calls = 0;
    const task = async () => ++calls;

    await cache.run(undefined, task);
    await cache.run(undefined, task);

    assert.equal(calls, 2);
  });

  it("re-runs the task once the TTL has elapsed", async () => {
    let clock = 1000;
    const cache = new OpDedupCache({ ttlMs: 100, now: () => clock });
    let calls = 0;
    const task = async () => ++calls;

    await cache.run("op-3", task);
    clock += 50; // still within TTL
    await cache.run("op-3", task);
    assert.equal(calls, 1);

    clock += 100; // now past TTL
    await cache.run("op-3", task);
    assert.equal(calls, 2);
  });

  it("replays a rejection for a retried opId without re-running", async () => {
    const cache = new OpDedupCache();
    let calls = 0;
    const task = async () => {
      calls++;
      throw new Error("boom");
    };

    await assert.rejects(() => cache.run("op-4", task), /boom/);
    await assert.rejects(() => cache.run("op-4", task), /boom/);
    assert.equal(calls, 1);
  });
});
