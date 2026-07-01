/**
 * Unit tests for the KeyedAsyncQueue promise-chain mutex.
 *
 * @license MIT
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { KeyedAsyncQueue } from "../module/core/async-queue.mjs";

describe("KeyedAsyncQueue", () => {
  it("serializes overlapping tasks for the same key in submission order", async () => {
    const queue = new KeyedAsyncQueue();
    const order = [];

    const first = queue.enqueue("a", async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      order.push("first");
    });
    const second = queue.enqueue("a", async () => {
      order.push("second");
    });

    await Promise.all([first, second]);
    assert.deepEqual(order, ["first", "second"]);
  });

  it("does not lose an update across two chained read-modify-write tasks", async () => {
    const queue = new KeyedAsyncQueue();
    let counter = 0;

    const increment = () =>
      queue.enqueue("counter", async () => {
        const current = counter;
        await new Promise((resolve) => setTimeout(resolve, 5));
        counter = current + 1;
      });

    await Promise.all([increment(), increment(), increment()]);
    assert.equal(counter, 3);
  });

  it("runs different keys independently, without waiting on each other", async () => {
    const queue = new KeyedAsyncQueue();
    const order = [];

    const slow = queue.enqueue("a", async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      order.push("slow");
    });
    const fast = queue.enqueue("b", async () => {
      order.push("fast");
    });

    await Promise.all([slow, fast]);
    assert.deepEqual(order, ["fast", "slow"]);
  });

  it("propagates a task's rejection to its own caller", async () => {
    const queue = new KeyedAsyncQueue();
    await assert.rejects(
      queue.enqueue("a", async () => {
        throw new Error("boom");
      }),
      /boom/
    );
  });

  it("still runs a later task after an earlier one rejects", async () => {
    const queue = new KeyedAsyncQueue();
    const failing = queue.enqueue("a", async () => {
      throw new Error("boom");
    });
    const following = queue.enqueue("a", async () => "ok");

    await assert.rejects(failing);
    assert.equal(await following, "ok");
  });
});
