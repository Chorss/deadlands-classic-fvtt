/**
 * ItemRegistry — the plugin contract for item subtypes.
 *
 * Core item types (weapon, armor, gear, edge, hindrance, ammo) register from
 * `core/items/*`; archetype-specific types (hex, miracle, favor, gizmo) register
 * from their archetype `manifest.mjs`. Mirrors {@link ArchetypeRegistry}.
 *
 * @see docs/implementation-plan.md §3.5–3.6
 * @license MIT
 */

/**
 * The contract an item type must satisfy.
 *
 * @typedef {object} ItemDefinition
 * @property {string} id            Matches a `documentTypes.Item.<id>` key in system.json (camelCase).
 * @property {string} label         i18n key for the item-type label (e.g. "TYPES.Item.weapon").
 * @property {typeof foundry.abstract.TypeDataModel} dataModel  The TypeDataModel subclass.
 * @property {Function} [sheetClass] Optional ItemSheetV2 subclass; falls back to a shared sheet.
 * @property {string} [defaultIcon] Default item image path.
 * @property {string[]} [htmlFields] Schema paths to enrich as HTML (mirrors system.json).
 */

export class ItemRegistry {
  /** @type {Map<string, ItemDefinition>} */
  static #items = new Map();

  /**
   * @param {ItemDefinition} def
   * @returns {ItemDefinition}
   */
  static register(def) {
    if (!def?.id || typeof def.id !== "string") {
      throw new Error("ItemRegistry.register: `id` (string) is required.");
    }
    if (!def.dataModel) {
      throw new Error(`ItemRegistry.register("${def.id}"): \`dataModel\` is required.`);
    }
    if (this.#items.has(def.id)) {
      throw new Error(`ItemRegistry: item type "${def.id}" is already registered.`);
    }
    this.#items.set(def.id, def);
    return def;
  }

  /** @param {string} id @returns {ItemDefinition | undefined} */
  static get(id) {
    return this.#items.get(id);
  }

  /** @param {string} id @returns {boolean} */
  static has(id) {
    return this.#items.has(id);
  }

  /** @returns {ItemDefinition[]} */
  static all() {
    return [...this.#items.values()];
  }

  /** @returns {string[]} */
  static ids() {
    return [...this.#items.keys()];
  }

  /**
   * Map of `{ [id]: dataModel }` for `CONFIG.Item.dataModels`.
   * @returns {Record<string, typeof foundry.abstract.TypeDataModel>}
   */
  static dataModels() {
    return Object.fromEntries(this.all().map((def) => [def.id, def.dataModel]));
  }

  /** Remove every registration — test/teardown only. */
  static clear() {
    this.#items.clear();
  }
}
