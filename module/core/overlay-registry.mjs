/**
 * OverlayRegistry — the plugin contract for character *overlays*.
 *
 * An overlay is laid over an existing character rather than being its own actor
 * type. Harrowed is the canonical case: any PC can become Harrowed (`dlc` p.194),
 * so it is an overlay (flag + sub-schema + a conditional sheet tab), not a
 * `documentTypes.Actor` entry. Future overlays register the same way.
 *
 * Unlike archetypes/items, overlays add NO documentType — they contribute extra
 * schema fields merged into the base character model and a tab shown only when
 * the overlay is active on a given actor.
 *
 * @see docs/implementation-plan.md §2, Phase 11
 * @license MIT
 */

/**
 * The contract an overlay module must satisfy.
 *
 * @typedef {object} OverlayDefinition
 * @property {string} id            Overlay key (camelCase, e.g. "harrowed").
 * @property {string} label         i18n key for the overlay label.
 * @property {() => Record<string, foundry.data.fields.DataField>} [schemaFields]
 *           Returns extra schema fields merged into the base character schema
 *           (e.g. `{ isHarrowed, dominion, harrowedPowers }`).
 * @property {(actor: foundry.documents.Actor) => boolean} [isActive]
 *           Predicate deciding whether the overlay is active on an actor
 *           (e.g. `actor.system.harrowed?.isHarrowed === true`).
 * @property {object} [sheetTab]    Descriptor for the tab injected when active.
 * @property {object} [mechanics]   Overlay-specific callbacks (e.g. dominionRoll).
 * @property {string[]} [appliesTo] Archetype ids the overlay may attach to; omit = all PCs.
 */

export class OverlayRegistry {
  /** @type {Map<string, OverlayDefinition>} */
  static #overlays = new Map();

  /**
   * @param {OverlayDefinition} def
   * @returns {OverlayDefinition}
   */
  static register(def) {
    if (!def?.id || typeof def.id !== "string") {
      throw new Error("OverlayRegistry.register: `id` (string) is required.");
    }
    if (this.#overlays.has(def.id)) {
      throw new Error(`OverlayRegistry: overlay "${def.id}" is already registered.`);
    }
    this.#overlays.set(def.id, def);
    return def;
  }

  /** @param {string} id @returns {OverlayDefinition | undefined} */
  static get(id) {
    return this.#overlays.get(id);
  }

  /** @param {string} id @returns {boolean} */
  static has(id) {
    return this.#overlays.has(id);
  }

  /** @returns {OverlayDefinition[]} */
  static all() {
    return [...this.#overlays.values()];
  }

  /** @returns {string[]} */
  static ids() {
    return [...this.#overlays.keys()];
  }

  /**
   * Overlays applicable to a given archetype id.
   * @param {string} archetypeId
   * @returns {OverlayDefinition[]}
   */
  static forArchetype(archetypeId) {
    return this.all().filter((def) => !def.appliesTo || def.appliesTo.includes(archetypeId));
  }

  /**
   * Overlays currently active on an actor (per each overlay's `isActive`).
   * @param {foundry.documents.Actor} actor
   * @returns {OverlayDefinition[]}
   */
  static activeOn(actor) {
    return this.all().filter((def) => def.isActive?.(actor) ?? false);
  }

  /** Remove every registration — test/teardown only. */
  static clear() {
    this.#overlays.clear();
  }
}
