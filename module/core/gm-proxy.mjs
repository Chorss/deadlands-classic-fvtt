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
 * Known limitation: a GM logged in from two tabs receives the query on both
 * sockets and applies the op twice (first ack wins). Multi-tab GM sessions
 * are unsupported. See docs/notes.md.
 *
 * @license MIT
 */

const DEFAULT_TIMEOUT_MS = 30_000;

/** Handlers kept locally so the GM-local path can skip the socket round trip. */
const handlers = new Map();

/**
 * Register a GM-op handler under `CONFIG.queries`. Must run during `init` on
 * EVERY client — `User#query` refuses to send a query name the calling client
 * has not registered itself.
 *
 * @param {string} name — query name, prefixed with the system id
 * @param {(data: object, context: { user: User }) => Promise<object>} handler
 *   Executed on the active GM's client; `context.user` is the requesting user.
 */
export function registerGmOp(name, handler) {
  handlers.set(name, handler);
  CONFIG.queries[name] = handler;
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
 * @param {number} [opts.timeout] — ms before the query rejects (always finite;
 *   an omitted timeout would let the promise hang forever)
 * @returns {Promise<object>} the handler's JSON-serializable result
 */
export async function dispatchGmOp(name, data, { timeout = DEFAULT_TIMEOUT_MS } = {}) {
  const gm = game.users.activeGM;
  if (!gm) {
    ui.notifications.warn(game.i18n.localize("DEADLANDS.GmProxy.NoActiveGM"));
    throw new Error(`GM op "${name}" rejected: no active GM in this world.`);
  }

  if (gm.isSelf) {
    const handler = handlers.get(name);
    if (!handler) {
      throw new Error(`GM op "${name}" is not registered.`);
    }
    return handler(data, { user: game.user });
  }

  try {
    return await gm.query(name, data, { timeout });
  } catch (err) {
    ui.notifications.error(game.i18n.localize("DEADLANDS.GmProxy.QueryFailed"));
    console.error(`deadlands-classic | GM op "${name}" failed:`, err);
    throw err;
  }
}
