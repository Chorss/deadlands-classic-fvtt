/**
 * GM proxy — routes shared-state mutations to the active GM's client.
 *
 * World-scope settings (Fate Pot) and Combat-document flags (Action Deck) can
 * only be written by a GM-level user, and Foundry offers no compare-and-swap
 * for concurrent writes from several clients. Both problems share one fix:
 * every client sends a JSON operation descriptor to the single designated GM
 * client (`game.users.activeGM`), which applies it inside a KeyedAsyncQueue —
 * one serialized writer for the whole world.
 *
 * Transport is Foundry's native Queries API (`CONFIG.queries` + `User#query`,
 * riding the core "userQuery" socket channel — no `socket: true` manifest flag
 * required). Payloads and results must be JSON-serializable; a handler error
 * reaches the caller as an `Error` carrying only the message string.
 *
 * A `User#query` timeout expires only the caller's ack — the GM keeps running
 * the handler — so a bare retry would apply an op twice. Each dispatch stamps a
 * unique `opId`; `registerGmOp` runs every handler through an {@link OpDedupCache}
 * on the GM client, so a retried op with the same id collapses onto the first
 * run instead of re-applying. `dispatchGmOp` retries a timed-out query once with
 * that same id, and shows the failure notification on BOTH the remote and the
 * GM-local path (the latter previously failed silently).
 *
 * Known limitation: a GM logged in from two tabs receives the query on both
 * sockets. The dedup cache is per-client, so each tab still applies it once —
 * multi-tab GM sessions remain unsupported. See docs/notes.md.
 *
 * @license MIT
 */

import { OpDedupCache } from "./op-dedup.mjs";

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_RETRIES = 1;

/** Handlers kept locally so the GM-local path can skip the socket round trip. */
const handlers = new Map();

/** GM-side idempotency cache — shared by every registered op. */
const dedupCache = new OpDedupCache();

/**
 * Register a GM-op handler under `CONFIG.queries`. Must run during `init` on
 * EVERY client — `User#query` refuses to send a query name the calling client
 * has not registered itself. The handler is wrapped so the transport-level
 * `opId` is stripped from the payload and used to dedupe retried ops.
 *
 * @param {string} name — query name, prefixed with the system id
 * @param {(data: object, context: { user: User }) => Promise<object>} handler
 *   Executed on the active GM's client; `context.user` is the requesting user.
 */
export function registerGmOp(name, handler) {
  const wrapped = (payload, context) => {
    const { opId, ...data } = payload ?? {};
    return dedupCache.run(opId, () => handler(data, context));
  };
  handlers.set(name, wrapped);
  CONFIG.queries[name] = wrapped;
}

/**
 * Execute a GM op: locally when this client is the designated GM, otherwise
 * via a query to the active GM's client. Rejects when no GM is connected —
 * shared state is never written from a non-GM client (server permissions
 * would refuse the write anyway).
 *
 * @param {string} name — query name passed to {@link registerGmOp}
 * @param {object} data — JSON-serializable operation descriptor
 * @param {object} [opts]
 * @param {number} [opts.timeout] — ms before a single query attempt rejects
 * @param {number} [opts.retries] — extra attempts after a timeout (same opId)
 * @returns {Promise<object>} the handler's JSON-serializable result
 */
export async function dispatchGmOp(
  name,
  data,
  { timeout = DEFAULT_TIMEOUT_MS, retries = DEFAULT_RETRIES } = {}
) {
  const gm = game.users.activeGM;
  if (!gm) {
    ui.notifications.warn(game.i18n.localize("DEADLANDS.GmProxy.NoActiveGM"));
    throw new Error(`GM op "${name}" rejected: no active GM in this world.`);
  }

  // Stable across retries so the GM's dedup cache collapses them onto one run.
  const opId = `${game.user.id}:${foundry.utils.randomID(16)}`;
  const payload = { ...data, opId };

  try {
    if (gm.isSelf) {
      const handler = handlers.get(name);
      if (!handler) {
        throw new Error(`GM op "${name}" is not registered.`);
      }
      return await handler(payload, { user: game.user });
    }
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await gm.query(name, payload, { timeout });
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr;
  } catch (err) {
    ui.notifications.error(game.i18n.localize("DEADLANDS.GmProxy.QueryFailed"));
    console.error(`deadlands-classic | GM op "${name}" failed:`, err);
    throw err;
  }
}
