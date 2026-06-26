/**
 * ArchetypeRegistry — the plugin contract for player-character archetypes.
 *
 * Each archetype (Cowboy, Huckster, Shaman, Blessed, Mad Scientist, …) is a
 * self-contained module that calls {@link ArchetypeRegistry.register} from its
 * `manifest.mjs`. Core stays archetype-agnostic: it only knows this contract.
 * The entry point reads the registry in the `init` hook to wire
 * `CONFIG.Actor.dataModels` and the per-type sheets.
 *
 * @see docs/implementation-plan.md §2
 * @see .claude/rules/naming.md — registry keys are camelCase, matching system.json
 * @license MIT
 */

/**
 * The contract an archetype module must satisfy.
 *
 * @typedef {object} ArchetypeDefinition
 * @property {string} id            Matches a `documentTypes.Actor.<id>` key in system.json (camelCase).
 * @property {string} label         i18n key for the archetype label (e.g. "TYPES.Actor.cowboy").
 * @property {typeof foundry.abstract.TypeDataModel} dataModel  The TypeDataModel subclass.
 * @property {Function} sheetClass  The ActorSheetV2 (+ HandlebarsApplicationMixin) subclass.
 * @property {object} [mechanics]   Optional archetype-specific roll/power callbacks.
 * @property {string} [defaultIcon] Default prototype-token / actor image path.
 * @property {string[]} [htmlFields] Schema paths to enrich as HTML (mirrors system.json).
 */

export class ArchetypeRegistry {
  /** @type {Map<string, ArchetypeDefinition>} */
  static #archetypes = new Map();

  /**
   * Register an archetype. Idempotent per id is NOT assumed — a duplicate id is
   * a developer error and throws, so manifest double-imports surface loudly.
   * @param {ArchetypeDefinition} def
   * @returns {ArchetypeDefinition} the stored definition
   */
  static register(def) {
    if (!def?.id || typeof def.id !== "string") {
      throw new Error("ArchetypeRegistry.register: `id` (string) is required.");
    }
    if (!def.dataModel) {
      throw new Error(`ArchetypeRegistry.register("${def.id}"): \`dataModel\` is required.`);
    }
    if (this.#archetypes.has(def.id)) {
      throw new Error(`ArchetypeRegistry: archetype "${def.id}" is already registered.`);
    }
    this.#archetypes.set(def.id, def);
    return def;
  }

  /**
   * @param {string} id
   * @returns {ArchetypeDefinition | undefined}
   */
  static get(id) {
    return this.#archetypes.get(id);
  }

  /** @param {string} id @returns {boolean} */
  static has(id) {
    return this.#archetypes.has(id);
  }

  /** @returns {ArchetypeDefinition[]} all registered archetypes (insertion order) */
  static all() {
    return [...this.#archetypes.values()];
  }

  /** @returns {string[]} the registered archetype ids */
  static ids() {
    return [...this.#archetypes.keys()];
  }

  /**
   * Map of `{ [id]: dataModel }` for `CONFIG.Actor.dataModels`.
   * @returns {Record<string, typeof foundry.abstract.TypeDataModel>}
   */
  static dataModels() {
    return Object.fromEntries(this.all().map((def) => [def.id, def.dataModel]));
  }

  /** Remove every registration — test/teardown only. */
  static clear() {
    this.#archetypes.clear();
  }
}
