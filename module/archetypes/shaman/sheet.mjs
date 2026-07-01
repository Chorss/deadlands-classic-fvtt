/**
 * ShamanSheet — actor sheet for the Shaman archetype.
 *
 * Extends the base character sheet with a "Favors" tab that shows the ritual
 * aptitude, Appeasement pool, and all favor items with Perform Ritual / Spend
 * Appeasement buttons.
 *
 * @license MIT
 */

import { toPascal } from "../../core/utils.mjs";
import { BaseCharacterSheet } from "../_base/base-character-sheet.mjs";
import { HARROWED_SHEET_PART, HARROWED_SHEET_TAB } from "../_overlays/harrowed/sheet-tab.mjs";
import { performRitual, spendFavor } from "./mechanics.mjs";

const TEMPLATE_ROOT = "systems/deadlands-classic/templates/actor/parts";
const DIALOG_ROOT = "systems/deadlands-classic/templates/dialogs";

export class ShamanSheet extends BaseCharacterSheet {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["shaman"],
    actions: {
      performRitual: ShamanSheet.#onPerformRitual,
      spendFavor: ShamanSheet.#onSpendFavor,
    },
  };

  /** @inheritDoc */
  static PARTS = {
    header: { template: `${TEMPLATE_ROOT}/header.hbs` },
    tabs: { template: `${TEMPLATE_ROOT}/tabs.hbs` },
    traits: { template: `${TEMPLATE_ROOT}/traits-tab.hbs` },
    combat: { template: `${TEMPLATE_ROOT}/combat-tab.hbs` },
    favors: { template: `${TEMPLATE_ROOT}/favors-tab.hbs` },
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
        {
          id: "favors",
          group: "sheet",
          icon: "fas fa-feather-alt",
          label: "DEADLANDS.Sheet.Tab.Favors",
        },
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
    context.favors = this.#prepareFavors();
    context.ritual = this.#prepareRitual();
    context.appeasement = this.document.system.appeasement ?? { current: 0, max: 0 };
    context.guardianSpirit = this.document.system.guardianSpirit ?? 0;
    return context;
  }

  #prepareFavors() {
    return this.document.items
      .filter((i) => i.type === "favor")
      .map((f) => ({
        id: f.id,
        name: f.name,
        img: f.img,
        medicine: f.system.medicine,
        medicineLabel: `DEADLANDS.Shaman.Medicine.${toPascal(f.system.medicine)}`,
        ritualType: f.system.ritualType,
        ritualTypeLabel: `DEADLANDS.Shaman.RitualType.${toPascal(f.system.ritualType)}`,
        appeasementCost: f.system.appeasementCost,
        ritualTN: f.system.ritualTN,
        speed: f.system.speed,
        duration: f.system.duration,
        range: f.system.range,
      }));
  }

  #prepareRitual() {
    const data = this.document.system.ritual ?? { level: 0, modifier: 0 };
    return {
      level: data.level,
      modifier: data.modifier,
      levelPath: "system.ritual.level",
      modifierPath: "system.ritual.modifier",
    };
  }

  // ── Action handlers ──────────────────────────────────────────────────────────

  /** @this {ShamanSheet} */
  static async #onPerformRitual(_event, target) {
    const favorId = target.dataset.favorId;
    const favorItem = this.document.items.get(favorId);
    if (!favorItem) {
      return;
    }

    const content = await foundry.applications.handlebars.renderTemplate(
      `${DIALOG_ROOT}/ritual-dialog.hbs`,
      {
        favorName: favorItem.name,
        ritualTN: favorItem.system.ritualTN,
        ritualTypeLabel: `DEADLANDS.Shaman.RitualType.${toPascal(favorItem.system.ritualType)}`,
      }
    );

    const params = await foundry.applications.api.DialogV2.prompt({
      window: {
        title: game.i18n.format("DEADLANDS.Shaman.Dialog.RitualTitle", { favor: favorItem.name }),
      },
      content,
      ok: {
        label: game.i18n.localize("DEADLANDS.Shaman.Dialog.Perform"),
        callback: (_event, button) => {
          const els = button.form.elements;
          return { modifier: Number(els.modifier?.value ?? 0) };
        },
      },
    });

    if (!params) {
      return;
    }
    await performRitual(this.document, favorItem, { modifier: params.modifier });
  }

  /** @this {ShamanSheet} */
  static async #onSpendFavor(_event, target) {
    const favorId = target.dataset.favorId;
    const favorItem = this.document.items.get(favorId);
    if (!favorItem) {
      return;
    }
    await spendFavor(this.document, favorItem);
  }
}
