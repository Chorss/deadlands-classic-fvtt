/**
 * BaseCharacterSheet — shared ApplicationV2 actor sheet for player archetypes.
 *
 * Four tabs (Traits, Combat, Gear, Bio) built on the V14 tab pattern: a `tabs`
 * navigation part plus one content part per tab, with `static TABS` driving the
 * navigation and `_preparePartContext` injecting per-tab state. Archetype sheets
 * extend this and append their own tabs/parts (Phases 9–11).
 *
 * @see docs/v14-api-notes.md (ApplicationV2 + HandlebarsApplicationMixin)
 * @license MIT
 */

import { APTITUDES, DEADLANDS, TRAITS } from "../../core/config.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

const TEMPLATE_ROOT = "systems/deadlands-classic/templates/actor/parts";

/** "sleightOfHand" → "SleightOfHand" for the PascalCase i18n segment. */
function toPascal(id) {
  return id.charAt(0).toUpperCase() + id.slice(1);
}

export class BaseCharacterSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["deadlands-classic", "sheet", "actor"],
    position: { width: 740, height: 720 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {},
  };

  /** @inheritDoc */
  static PARTS = {
    header: { template: `${TEMPLATE_ROOT}/header.hbs` },
    tabs: { template: `${TEMPLATE_ROOT}/tabs.hbs` },
    traits: { template: `${TEMPLATE_ROOT}/traits-tab.hbs` },
    combat: { template: `${TEMPLATE_ROOT}/combat-tab.hbs` },
    gear: { template: `${TEMPLATE_ROOT}/gear-tab.hbs` },
    bio: { template: `${TEMPLATE_ROOT}/bio-tab.hbs` },
  };

  /** @inheritDoc */
  static TABS = {
    sheet: {
      tabs: [
        {
          id: "traits",
          group: "sheet",
          icon: "fas fa-dice-d20",
          label: "DEADLANDS.Sheet.Tab.Traits",
        },
        { id: "combat", group: "sheet", icon: "fas fa-gun", label: "DEADLANDS.Sheet.Tab.Combat" },
        { id: "gear", group: "sheet", icon: "fas fa-box", label: "DEADLANDS.Sheet.Tab.Gear" },
        { id: "bio", group: "sheet", icon: "fas fa-feather", label: "DEADLANDS.Sheet.Tab.Bio" },
      ],
      initial: "traits",
    },
  };

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.actor = this.document;
    context.system = this.document.system;
    context.config = DEADLANDS;
    context.editable = this.isEditable;
    context.tabs = this._prepareTabs("sheet");
    context.traitGroups = this.#prepareTraits();
    context.items = this.#prepareItems();
    return context;
  }

  /** @inheritDoc */
  async _preparePartContext(partId, context) {
    if (context.tabs?.[partId]) context.tab = context.tabs[partId];
    return context;
  }

  /** Structured Trait → Aptitude view model with i18n keys and update paths. */
  #prepareTraits() {
    const system = this.document.system;
    const groups = { corporeal: [], mental: [] };
    for (const [id, cfg] of Object.entries(TRAITS)) {
      const trait = system.traits[id];
      const aptitudes = Object.keys(APTITUDES[id] ?? {}).map((aptId) => ({
        id: aptId,
        label: `DEADLANDS.Aptitude.${toPascal(aptId)}.Label`,
        level: trait.aptitudes[aptId]?.level ?? 0,
        path: `system.traits.${id}.aptitudes.${aptId}.level`,
      }));
      groups[cfg.group].push({
        id,
        label: `DEADLANDS.Trait.${toPascal(id)}.Label`,
        dieCount: trait.dieCount,
        dieType: trait.dieType,
        modifier: trait.modifier,
        dieCountPath: `system.traits.${id}.dieCount`,
        dieTypePath: `system.traits.${id}.dieType`,
        modifierPath: `system.traits.${id}.modifier`,
        aptitudes,
      });
    }
    return groups;
  }

  /** Group embedded items by type for the Combat / Gear tabs. */
  #prepareItems() {
    const byType = { weapon: [], armor: [], gear: [], edge: [], hindrance: [], ammo: [] };
    for (const item of this.document.items) {
      if (!byType[item.type]) byType[item.type] = [];
      byType[item.type].push(item);
    }
    return byType;
  }
}
