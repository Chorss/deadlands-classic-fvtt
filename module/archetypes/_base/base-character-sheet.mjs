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

import { executeWhiteSpend } from "../../core/chips/chip-rules.mjs";
import { APTITUDES, DEADLANDS, TRAITS } from "../../core/config.mjs";
import { toPascal } from "../../core/utils.mjs";
import { HARROWED_SHEET_PART, HARROWED_SHEET_TAB } from "../_overlays/harrowed/sheet-tab.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;
const TextEditor = foundry.applications.ux.TextEditor.implementation;

const TEMPLATE_ROOT = "systems/deadlands-classic/templates/actor/parts";
const DIALOG_ROOT = "systems/deadlands-classic/templates/dialogs";

/** TN choices for the roll dialog — keyed by i18n slug, value = TN number. dlc p.28. */
const TN_CHOICES = [
  { value: 3, label: "DEADLANDS.TN.Foolproof" },
  { value: 5, label: "DEADLANDS.TN.Fair", default: true },
  { value: 7, label: "DEADLANDS.TN.Onerous" },
  { value: 9, label: "DEADLANDS.TN.Hard" },
  { value: 11, label: "DEADLANDS.TN.Incredible" },
];

/**
 * Show the shared Trait/Aptitude roll dialog.
 * @param {{ label: string, maxWhite: number, unskilled?: boolean }} opts
 * @returns {Promise<{tn:number, modifier:number, whiteSpend:number}|null>}
 */
async function _showRollDialog({ label, maxWhite, unskilled = false }) {
  const content = await foundry.applications.handlebars.renderTemplate(
    `${DIALOG_ROOT}/trait-roll-dialog.hbs`,
    {
      label,
      maxWhite,
      unskilled,
      tnChoices: TN_CHOICES,
    }
  );

  return foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n.localize("DEADLANDS.Dialog.TraitRoll.Title") },
    content,
    ok: {
      label: game.i18n.localize("DEADLANDS.Dialog.TraitRoll.Roll"),
      callback: (_event, button) => {
        const els = button.form.elements;
        return {
          tn: Number(els.tn.value),
          modifier: Number(els.modifier.value ?? 0),
          whiteSpend: Number(els.whiteChips?.value ?? 0),
        };
      },
    },
  });
}

export class BaseCharacterSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["deadlands-classic", "sheet", "actor"],
    position: { width: 740, height: 720, top: 60, left: 120 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      rollTrait: BaseCharacterSheet.#onRollTrait,
      rollAptitude: BaseCharacterSheet.#onRollAptitude,
      dominionRoll: BaseCharacterSheet.#onDominionRoll,
    },
  };

  /** Use actor name as window title (avoids redundant "Type: Name" pattern). */
  get title() {
    return this.document.name;
  }

  /** @inheritDoc */
  static PARTS = {
    header: { template: `${TEMPLATE_ROOT}/header.hbs` },
    tabs: { template: `${TEMPLATE_ROOT}/tabs.hbs` },
    traits: { template: `${TEMPLATE_ROOT}/traits-tab.hbs` },
    combat: { template: `${TEMPLATE_ROOT}/combat-tab.hbs` },
    // harrowed part is always declared so V14 ApplicationV2 renders it;
    // the tab nav entry is added conditionally in _prepareContext.
    harrowed: HARROWED_SHEET_PART,
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
        // harrowed is always declared in TABS so V14 ApplicationV2 builds its
        // state; the nav entry is removed from context.tabs when the overlay is
        // inactive, so the skull tab only appears for Harrowed characters.
        HARROWED_SHEET_TAB,
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
    context.traitGroups = this.#prepareTraits();
    context.dieTypeChoices = Object.fromEntries(DEADLANDS.DIE_TYPES.map((d) => [d, d]));
    context.wounds = this.#prepareWounds();
    context.chips = this.#prepareChips();
    context.items = this.#prepareItems();
    context.enrichedBiography = await TextEditor.enrichHTML(this.document.system.biography ?? "", {
      secrets: this.document.isOwner,
      rollData: this.document.getRollData(),
      relativeTo: this.document,
    });

    // Harrowed overlay — build tabs first, then remove the harrowed nav entry
    // when the overlay is inactive so the skull tab only shows for Harrowed PCs.
    context.harrowed = this.#prepareHarrowed();
    context.tabs = this._prepareTabs("sheet");
    if (!context.harrowed.isHarrowed) {
      delete context.tabs.harrowed;
    }

    return context;
  }

  /** @inheritDoc */
  async _preparePartContext(partId, context) {
    if (context.tabs?.[partId]) {
      context.tab = context.tabs[partId];
    }
    return context;
  }

  /** Structured Trait → Aptitude view model with i18n keys and update paths. */
  #prepareTraits() {
    const system = this.document.system;
    const groups = {
      corporeal: { id: "corporeal", label: "DEADLANDS.Sheet.TraitGroup.Corporeal", traits: [] },
      mental: { id: "mental", label: "DEADLANDS.Sheet.TraitGroup.Mental", traits: [] },
    };
    for (const [id, cfg] of Object.entries(TRAITS)) {
      const trait = system.traits[id];
      const aptitudes = Object.keys(APTITUDES[id] ?? {}).map((aptId) => ({
        id: aptId,
        traitId: id,
        label: `DEADLANDS.Aptitude.${toPascal(aptId)}.Label`,
        level: trait.aptitudes[aptId]?.level ?? 0,
        path: `system.traits.${id}.aptitudes.${aptId}.level`,
      }));
      groups[cfg.group].traits.push({
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
    return [groups.corporeal, groups.mental];
  }

  /** Wound-track view model: one entry per hit location + Wind bar data. */
  #prepareWounds() {
    const system = this.document.system;
    const SEVERITY_LABELS = [
      "DEADLANDS.Wound.Severity.None",
      "DEADLANDS.Wound.Severity.Light",
      "DEADLANDS.Wound.Severity.Heavy",
      "DEADLANDS.Wound.Severity.Serious",
      "DEADLANDS.Wound.Severity.Critical",
      "DEADLANDS.Wound.Severity.Maimed",
    ];
    const woundLocations = Object.entries(DEADLANDS.HIT_LOCATIONS).map(([id, cfg]) => {
      const severity = system.wounds[id]?.severity ?? 0;
      // Build 5 pip objects so HBS can iterate without custom helpers.
      const pips = Array.from({ length: 5 }, (_, i) => ({ filled: i < severity }));
      return {
        id,
        label: `DEADLANDS.HitLocation.${toPascal(id)}.Label`,
        severity,
        severityLabel: SEVERITY_LABELS[severity] ?? SEVERITY_LABELS[0],
        isLimb: cfg.limb ?? false,
        isMaimed: severity >= 5,
        pips,
        path: `system.wounds.${id}.severity`,
      };
    });
    const windValue = system.wind?.value ?? 0;
    const windMax = system.wind?.max ?? 0;
    return {
      woundLocations,
      wind: { value: windValue, max: windMax },
      windedClass: windValue <= 0 ? "dlc-winded" : "",
    };
  }

  /** Fate Chip view model: one entry per color. */
  #prepareChips() {
    const system = this.document.system;
    if (!system.chips) {
      return [];
    }
    return Object.keys(DEADLANDS.CHIP_COLORS).map((color) => ({
      color,
      label: `DEADLANDS.Chip.${toPascal(color)}.Label`,
      value: system.chips[color] ?? 0,
      path: `system.chips.${color}`,
    }));
  }

  /** Group embedded items by type for the Combat / Gear tabs. */
  #prepareItems() {
    const byType = { weapon: [], armor: [], gear: [], edge: [], hindrance: [], ammo: [] };
    for (const item of this.document.items) {
      if (!byType[item.type]) {
        byType[item.type] = [];
      }
      byType[item.type].push(item);
    }
    return byType;
  }

  // ── Harrowed overlay ─────────────────────────────────────────────────────

  /** Harrowed view model for the overlay tab. */
  #prepareHarrowed() {
    const h = this.document.system.harrowed;
    if (!h) {
      return { isHarrowed: false, dominion: {}, powers: [], coup: [] };
    }
    return {
      isHarrowed: h.isHarrowed ?? false,
      dominion: h.dominion ?? {},
      powers: h.harrowedPowers ?? [],
      coup: h.countingCoup ?? [],
    };
  }

  // ── Roll action handlers ──────────────────────────────────────────────────

  /**
   * Pure Trait roll (no aptitude). dlc p.27.
   * @this {BaseCharacterSheet}
   */
  static async #onRollTrait(_event, target) {
    const traitId = target.dataset.traitId;
    const label = game.i18n.localize(`DEADLANDS.Trait.${toPascal(traitId)}.Label`);
    const maxWhite = this.document.system.chips?.white ?? 0;

    const params = await _showRollDialog({ label, maxWhite });
    if (!params) {
      return;
    }

    const whiteSpend = await executeWhiteSpend(this.document, params.whiteSpend);

    await game.deadlandsClassic.dice.rollTrait(this.document, traitId, {
      tn: params.tn,
      modifier: params.modifier,
      extraDice: whiteSpend,
    });
  }

  /**
   * Dominion Roll — Spirit vs manitou contest, once per session. bod p.62/p.80.
   * @this {BaseCharacterSheet}
   */
  static async #onDominionRoll(_event, _target) {
    const { dominionRoll } = await import("../_overlays/harrowed/mechanics.mjs");
    await dominionRoll(this.document);
  }

  /**
   * Aptitude roll (trait die, aptitude die count). dlc p.27, p.29.
   * @this {BaseCharacterSheet}
   */
  static async #onRollAptitude(_event, target) {
    const traitId = target.dataset.traitId;
    const aptitudeId = target.dataset.aptitudeId;
    const trait = this.document.system.traits[traitId];
    const aptLevel = trait.aptitudes[aptitudeId]?.level ?? 0;
    const unskilled = aptLevel === 0; // dlc p.29 — unskilled: 1 die, -4 modifier

    const label = game.i18n.localize(`DEADLANDS.Aptitude.${toPascal(aptitudeId)}.Label`);
    const maxWhite = this.document.system.chips?.white ?? 0;

    const params = await _showRollDialog({ label, maxWhite, unskilled });
    if (!params) {
      return;
    }

    const whiteSpend = await executeWhiteSpend(this.document, params.whiteSpend);

    await game.deadlandsClassic.dice.rollTrait(this.document, traitId, {
      aptitudeId,
      tn: params.tn,
      modifier: params.modifier,
      extraDice: whiteSpend,
    });
  }
}
