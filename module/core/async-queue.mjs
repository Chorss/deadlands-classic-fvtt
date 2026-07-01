/**
 * Keyed promise-chain mutex — serializes async tasks sharing a key so
 * overlapping calls can't interleave between their `await` points and lose
 * an update. Used by FatePot (single global key) and ActionDeck (keyed per
 * combat.id) to close the same class of read-modify-write race.
 *
 * Does not protect against a genuinely simultaneous write from a *different*
 * client/browser — see docs/notes.md.
 *
 * @license MIT
 */

export class KeyedAsyncQueue {
  #queues = new Map();

  /**
   * Chain `task` after any pending task for `key`, then run it.
   * Once a key's chain settles with no new task queued in the meantime, its
   * entry is dropped so the map doesn't grow unboundedly over time.
   *
   * @param {string} key
   * @param {() => Promise<any>} task
   * @returns {Promise<any>}
   */
  enqueue(key, task) {
    const prior = this.#queues.get(key) ?? Promise.resolve();
    const result = prior.then(task, task);
    const chained = result.catch(() => {});
    this.#queues.set(key, chained);
    chained.finally(() => {
      if (this.#queues.get(key) === chained) {
        this.#queues.delete(key);
      }
    });
    return result;
  }
}
