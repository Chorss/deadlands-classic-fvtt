/**
 * BlessedSheet — actor sheet for the Blessed archetype.
 *
 * Extends the base character sheet with a "Miracles" tab that shows the faith
 * aptitude, sin state, and all miracle items with an Invoke button.
 *
 * @license MIT
 */

import { BaseCharacterSheet } from "../_base/base-character-sheet.mjs";
import { HARROWED_SHEET_PART, HARROWED_SHEET_TAB } from "../_overlays/harrowed/sheet-tab.mjs";
import { invokeMiracle, SIN_DENIAL_LABELS, trackSin } from "./mechanics.mjs";

const TEMPLATE_ROOT = "systems/deadlands-classic/templates/actor/parts";
const DIALOG_ROOT = "systems/deadlands-classic/templates/dialogs";

export class BlessedSheet extends BaseCharacterSheet {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["blessed"],
    actions: {
      invokeMiracle: BlessedSheet.#onInvokeMiracle,
      trackSin: BlessedSheet.#onTrackSin,
    },
  };

  /** @inheritDoc */
  static PARTS = {
    header: { template: `${TEMPLATE_ROOT}/header.hbs` },
    tabs: { template: `${TEMPLATE_ROOT}/tabs.hbs` },
    traits: { template: `${TEMPLATE_ROOT}/traits-tab.hbs` },
    combat: { template: `${TEMPLATE_ROOT}/combat-tab.hbs` },
    miracles: { template: `${TEMPLATE_ROOT}/miracles-tab.hbs` },
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
          id: "miracles",
          group: "sheet",
          icon: "fas fa-cross",
          label: "DEADLANDS.Sheet.Tab.Miracles",
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
    context.miracles = this.#prepareMiracles();
    context.faith = this.#prepareFaith();
    context.sinState = this.#prepareSinState();
    context.sinSeverities = ["minor", "major", "mortal"];
    return context;
  }

  #prepareMiracles() {
    return this.document.items
      .filter((i) => i.type === "miracle")
      .map((m) => ({
        id: m.id,
        name: m.name,
        img: m.img,
        tn: m.system.tn,
        speed: m.system.speed,
        duration: m.system.duration,
        range: m.system.range,
        sinSeverity: m.system.sinSeverity,
      }));
  }

  #prepareFaith() {
    const data = this.document.system.faith ?? { level: 0, modifier: 0 };
    return {
      level: data.level,
      modifier: data.modifier,
      levelPath: "system.faith.level",
      modifierPath: "system.faith.modifier",
    };
  }

  #prepareSinState() {
    const severity = this.document.system.faithDeniedSeverity ?? "none";
    const denied = severity !== "none";
    return {
      denied,
      severity,
      denialLabel: denied ? (SIN_DENIAL_LABELS[severity] ?? "") : "",
      sinPending: this.document.system.sinPending ?? false,
    };
  }

  // ── Action handlers ──────────────────────────────────────────────────────────

  /** @this {BlessedSheet} */
  static async #onInvokeMiracle(_event, target) {
    const miracleId = target.dataset.miracleId;
    const miracleItem = this.document.items.get(miracleId);
    if (!miracleItem) {
      return;
    }

    const maxWhite = this.document.system.chips?.white ?? 0;
    const content = await foundry.applications.handlebars.renderTemplate(
      `${DIALOG_ROOT}/invoke-miracle-dialog.hbs`,
      {
        miracleName: miracleItem.name,
        tn: miracleItem.system.tn,
        maxWhite,
      }
    );

    const params = await foundry.applications.api.DialogV2.prompt({
      window: {
        title: game.i18n.format("DEADLANDS.Blessed.Dialog.InvokeTitle", {
          miracle: miracleItem.name,
        }),
      },
      content,
      ok: {
        label: game.i18n.localize("DEADLANDS.Blessed.Dialog.Invoke"),
        callback: (_event, button) => {
          const els = button.form.elements;
          return {
            modifier: Number(els.modifier?.value ?? 0),
            whiteSpend: Number(els.whiteChips?.value ?? 0),
          };
        },
      },
    });

    if (!params) {
      return;
    }

    // Clamp to the actor's real white-chip count — the dialog's max is
    // advisory only, so a stale form value must not grant free extra dice.
    const whiteSpend = Math.min(Math.max(0, params.whiteSpend), maxWhite);
    if (whiteSpend > 0) {
      await this.document.update({
        "system.chips.white": maxWhite - whiteSpend,
      });
    }

    await invokeMiracle(this.document, miracleItem, {
      modifier: params.modifier,
      whiteSpend,
    });
  }

  /** @this {BlessedSheet} */
  static async #onTrackSin(_event, target) {
    const severity = target.dataset.severity ?? "minor";
    await trackSin(this.document, severity);
  }
}
