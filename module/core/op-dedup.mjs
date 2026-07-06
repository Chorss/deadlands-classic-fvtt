/**
 * Op-dedup cache — makes a GM-side op handler idempotent under retry.
 *
 * A `User#query` timeout expires only the CALLER's ack; the GM client keeps
 * executing the handler to completion (verified in Foundry's
 * `Users##handleUserQuery`). So a caller that retries after a timeout would
 * apply the same mutation twice. Keying each op with a unique `opId` and
 * running it through this cache collapses the retry onto the original: the
 * in-flight promise is shared, and a settled result is replayed for `ttlMs`.
 *
 * The entry is registered synchronously, before the first `await`, so even two
 * calls issued in the same tick (original + immediate retry) share one run
 * rather than racing a "nothing cached yet" check.
 *
 * Injectable clock (`now`) keeps it unit-testable without real time.
 *
 * @license MIT
 */

const DEFAULT_TTL_MS = 5 * 60_000;

export class OpDedupCache {
  /** @type {Map<string, { promise: Promise<any>, expiresAt: number|undefined }>} */
  #entries = new Map();

  /**
   * @param {object} [opts]
   * @param {number} [opts.ttlMs] — how long a settled result is replayed
   * @param {() => number} [opts.now] — clock source (defaults to Date.now)
   */
  constructor({ ttlMs = DEFAULT_TTL_MS, now = () => Date.now() } = {}) {
    this.ttlMs = ttlMs;
    this.now = now;
  }

  /**
   * Run `task` under `opId`, sharing an in-flight run and replaying a settled
   * one within the TTL. A falsy `opId` disables dedup (always runs).
   *
   * @param {string|undefined} opId
   * @param {() => Promise<any>} task
   * @returns {Promise<any>}
   */
  run(opId, task) {
    if (!opId) {
      return task();
    }
    this.#prune();
    const existing = this.#entries.get(opId);
    if (existing) {
      return existing.promise;
    }
    const entry = { promise: undefined, expiresAt: undefined };
    entry.promise = Promise.resolve()
      .then(task)
      .finally(() => {
        entry.expiresAt = this.now() + this.ttlMs;
      });
    // Swallow rejection on an internal branch so a fire-and-forget caller
    // doesn't trip Node's unhandled-rejection warning; the returned promise
    // still rejects for callers that await it.
    entry.promise.catch(() => {});
    this.#entries.set(opId, entry);
    return entry.promise;
  }

  /** Drop settled entries whose TTL has elapsed. In-flight entries are kept. */
  #prune() {
    const cutoff = this.now();
    for (const [key, e] of this.#entries) {
      if (e.expiresAt !== undefined && e.expiresAt <= cutoff) {
        this.#entries.delete(key);
      }
    }
  }
}
