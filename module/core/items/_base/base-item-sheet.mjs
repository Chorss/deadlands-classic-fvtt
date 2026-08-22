/**
 * BaseItemSheet — shared ApplicationV2 item sheet for the core item types.
 *
 * Provides the common context (editable flag, enriched description) and the
 * `postToChat` action every item-sheet subclass shares. Type-specific sheets
 * (WeaponSheet, EdgeSheet) extend this with their own `static PARTS` and any
 * extra context fields.
 *
 * @see module/archetypes/_base/base-character-sheet.mjs (equivalent actor-side pattern)
 * @license MIT
 */

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;
const TextEditor = foundry.applications.ux.TextEditor.implementation;

export class BaseItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["deadlands-classic", "sheet", "item"],
    position: { width: 420, height: "auto" },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      postToChat: BaseItemSheet.#onPostToChat,
    },
  };

  /** Use item name as window title (avoids redundant "Type: Name" pattern). */
  get title() {
    return this.document.name;
  }

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.item = this.document;
    context.system = this.document.system;
    context.editable = this.isEditable;
    // Foundry's own document-subtype label — already localized for every item
    // type (lang/en.json, lang/pl.json), so the header needs no per-type key.
    context.itemTypeLabelKey = `TYPES.Item.${this.document.type}`;
    context.enrichedDescription = await TextEditor.enrichHTML(
      this.document.system.description ?? "",
      {
        secrets: this.document.isOwner,
        rollData: this.document.getRollData(),
        relativeTo: this.document,
      }
    );
    return context;
  }

  /**
   * Post the item's name and enriched description to chat.
   * @this {BaseItemSheet}
   */
  static async #onPostToChat(_event, _target) {
    const item = this.document;
    const description = await TextEditor.enrichHTML(item.system.description ?? "", {
      secrets: item.isOwner,
      rollData: item.getRollData(),
      relativeTo: item,
    });
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: item.actor }),
      content: `<h3>${item.name}</h3>${description}`,
    });
  }
}
