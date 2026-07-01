/**
 * MadScientistSheet — actor sheet for the Mad Scientist archetype.
 *
 * Extends the base character sheet with a "Gizmos" tab that shows the science
 * and tinkerin' aptitudes plus all gizmo items with Devise Blueprint, Construct,
 * and Use (malfunction check) buttons.
 *
 * @license MIT
 */

import { POKER_HAND_RANKS } from "../../core/dice/poker-hand-evaluator.mjs";
import { toPascal } from "../../core/utils.mjs";
import { BaseCharacterSheet } from "../_base/base-character-sheet.mjs";
import { HARROWED_SHEET_PART, HARROWED_SHEET_TAB } from "../_overlays/harrowed/sheet-tab.mjs";
import { checkMalfunction, constructGizmo, deviseBlueprint } from "./mechanics.mjs";

const TEMPLATE_ROOT = "systems/deadlands-classic/templates/actor/parts";
const DIALOG_ROOT = "systems/deadlands-classic/templates/dialogs";

export class MadScientistSheet extends BaseCharacterSheet {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["mad-scientist"],
    actions: {
      deviseBlueprint: MadScientistSheet.#onDeviseBlueprint,
      constructGizmo: MadScientistSheet.#onConstructGizmo,
      useGizmo: MadScientistSheet.#onUseGizmo,
    },
  };

  /** @inheritDoc */
  static PARTS = {
    header: { template: `${TEMPLATE_ROOT}/header.hbs` },
    tabs: { template: `${TEMPLATE_ROOT}/tabs.hbs` },
    traits: { template: `${TEMPLATE_ROOT}/traits-tab.hbs` },
    combat: { template: `${TEMPLATE_ROOT}/combat-tab.hbs` },
    gizmos: { template: `${TEMPLATE_ROOT}/gizmos-tab.hbs` },
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
        { id: "gizmos", group: "sheet", icon: "fas fa-cog", label: "DEADLANDS.Sheet.Tab.Gizmos" },
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
    context.gizmos = this.#prepareGizmos();
    context.madScience = this.#prepareMadScience();
    context.tinkerin = this.#prepareTinkerin();
    context.blueprintHandChoices = Object.fromEntries(
      POKER_HAND_RANKS.map((k) => [k, `DEADLANDS.Huckster.Hand.${toPascal(k)}`])
    );
    return context;
  }

  #prepareGizmos() {
    return this.document.items
      .filter((i) => i.type === "gizmo")
      .map((g) => ({
        id: g.id,
        name: g.name,
        img: g.img,
        blueprintHand: g.system.blueprintHand,
        handLabel: `DEADLANDS.Huckster.Hand.${toPascal(g.system.blueprintHand)}`,
        constructionTN: g.system.constructionTN,
        reliability: g.system.reliability,
        powerType: g.system.powerType,
        blueprintStatus: g.system.blueprintStatus,
        constructed: g.system.constructed,
        speed: g.system.speed,
        duration: g.system.duration,
        range: g.system.range,
      }));
  }

  #prepareMadScience() {
    const data = this.document.system.madScience ?? { level: 0, modifier: 0 };
    return {
      level: data.level,
      modifier: data.modifier,
      levelPath: "system.madScience.level",
      modifierPath: "system.madScience.modifier",
    };
  }

  #prepareTinkerin() {
    const data = this.document.system.tinkerin ?? { level: 0, modifier: 0 };
    return {
      level: data.level,
      modifier: data.modifier,
      levelPath: "system.tinkerin.level",
      modifierPath: "system.tinkerin.modifier",
    };
  }

  // ── Action handlers ──────────────────────────────────────────────────────────

  /** @this {MadScientistSheet} */
  static async #onDeviseBlueprint(_event, target) {
    const gizmoId = target.dataset.gizmoId;
    const gizmoItem = this.document.items.get(gizmoId);
    if (!gizmoItem) {
      return;
    }

    const content = await foundry.applications.handlebars.renderTemplate(
      `${DIALOG_ROOT}/devise-blueprint-dialog.hbs`,
      {
        gizmoName: gizmoItem.name,
      }
    );

    const params = await foundry.applications.api.DialogV2.prompt({
      window: {
        title: game.i18n.format("DEADLANDS.MadScientist.Dialog.BlueprintTitle", {
          gizmo: gizmoItem.name,
        }),
      },
      content,
      ok: {
        label: game.i18n.localize("DEADLANDS.MadScientist.Dialog.Devise"),
        callback: (_event, button) => {
          const els = button.form.elements;
          return { modifier: Number(els.modifier?.value ?? 0) };
        },
      },
    });

    if (!params) {
      return;
    }
    await deviseBlueprint(this.document, gizmoItem, { modifier: params.modifier });
  }

  /** @this {MadScientistSheet} */
  static async #onConstructGizmo(_event, target) {
    const gizmoId = target.dataset.gizmoId;
    const gizmoItem = this.document.items.get(gizmoId);
    if (!gizmoItem) {
      return;
    }

    const content = await foundry.applications.handlebars.renderTemplate(
      `${DIALOG_ROOT}/devise-blueprint-dialog.hbs`,
      {
        gizmoName: gizmoItem.name,
        constructionTN: gizmoItem.system.constructionTN,
        isConstruction: true,
      }
    );

    const params = await foundry.applications.api.DialogV2.prompt({
      window: {
        title: game.i18n.format("DEADLANDS.MadScientist.Dialog.ConstructTitle", {
          gizmo: gizmoItem.name,
        }),
      },
      content,
      ok: {
        label: game.i18n.localize("DEADLANDS.MadScientist.Dialog.Construct"),
        callback: (_event, button) => {
          const els = button.form.elements;
          return { modifier: Number(els.modifier?.value ?? 0) };
        },
      },
    });

    if (!params) {
      return;
    }
    await constructGizmo(this.document, gizmoItem, { modifier: params.modifier });
  }

  /** @this {MadScientistSheet} */
  static async #onUseGizmo(_event, target) {
    const gizmoId = target.dataset.gizmoId;
    const gizmoItem = this.document.items.get(gizmoId);
    if (!gizmoItem) {
      return;
    }
    await checkMalfunction(this.document, gizmoItem);
  }
}
