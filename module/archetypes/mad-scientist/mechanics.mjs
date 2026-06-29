/**
 * Mad Scientist gizmo-creation and use mechanics.
 *
 * deviseBlueprint(actor, gizmoItem, opts) — Step 2: blueprint workflow:
 *   science roll (Cognition) vs TN 5 → draw 5+raises cards → evaluate poker hand
 *   hand must meet gizmoItem.system.blueprintHand from Gizmo Construction Table (dlc p.168-169)
 *   Black Joker → Madness Table (d20). dlc p.168.
 *   Updates gizmoItem: blueprintStatus, constructionTN, reliability base.
 *
 * constructGizmo(actor, gizmoItem, opts) — Step 4: construction workflow:
 *   tinkerin' roll (Deftness) vs gizmoItem.system.constructionTN
 *   each raise → +2 Reliability (base 10, max 19). dlc p.170.
 *   Updates gizmoItem: reliability, constructed.
 *
 * useGizmo(actor, gizmoItem) — activate a constructed gizmo:
 *   roll 1d20 simultaneously with Aptitude roll; 1d20 > reliability → malfunction. dlc p.247.
 *   malfunction severity: 2d6 on Malfunction Table (dlc p.247-249).
 *
 * Sources: dlc p.168-171, 247-249; snr p.12-15, 107.
 *
 * @license MIT
 */

import { ActionDeck, buildFullDeck, shuffleDeck } from "../../core/cards/action-deck.mjs";
import { rollExplodingPool } from "../../core/dice/exploding-roll.mjs";
import { evaluateHand, meetsMinHand } from "../../core/dice/poker-hand-evaluator.mjs";
import { GIZMO_CONSTRUCTION_TABLE } from "../../core/items/gizmo-data.mjs";

/**
 * Madness Table — d20 roll. dlc p.250.
 * Mechanical data only; entries describe the condition type, not rulebook prose.
 * @type {ReadonlyArray<{ roll: number, key: string }>}
 */
export const MADNESS_TABLE = [
  { roll: 1, key: "absentMinded" },
  { roll: 2, key: "absentMinded" },
  { roll: 3, key: "delusion" },
  { roll: 4, key: "delusion" },
  { roll: 5, key: "paranoia" },
  { roll: 6, key: "paranoia" },
  { roll: 7, key: "schizophrenia" },
  { roll: 8, key: "schizophrenia" },
  { roll: 9, key: "megalomania" },
  { roll: 10, key: "megalomania" },
  { roll: 11, key: "phobia" },
  { roll: 12, key: "phobia" },
  { roll: 13, key: "obsession" },
  { roll: 14, key: "obsession" },
  { roll: 15, key: "kleptomania" },
  { roll: 16, key: "kleptomania" },
  { roll: 17, key: "compulsion" },
  { roll: 18, key: "compulsion" },
  { roll: 19, key: "dementia" },
  { roll: 20, key: "dementia" },
];

// ── Blueprint workflow ────────────────────────────────────────────────────────

/**
 * Devise a blueprint: science roll → card draw → hand evaluation. dlc p.168-169.
 *
 * @param {Actor} actor — Mad Scientist actor
 * @param {Item} gizmoItem — the gizmo being blueprinted
 * @param {{ modifier?: number }} [opts]
 * @returns {Promise<void>}
 */
export async function deviseBlueprint(actor, gizmoItem, opts = {}) {
  const modifier = opts.modifier ?? 0;
  const { level: scienceLevel = 0, modifier: scienceMod = 0 } = actor.system.madScience ?? {};
  const traitData = actor.system.traits?.cognition;
  const cognitionDie = traitData?.dieType ?? "d6";
  const dieCount = Math.max(1, scienceLevel);
  const blueprintTN = 5; // Fair (5) — dlc p.168.

  const rollResult = rollExplodingPool(dieCount, cognitionDie, { modifier: modifier + scienceMod, tn: blueprintTN });

  const succeeded = !rollResult.bust && rollResult.total >= blueprintTN;
  let drawn = [];
  let handResult = null;
  let handMeets = false;
  let madness = null;

  if (succeeded) {
    const drawCount = 5 + rollResult.raises; // dlc p.168.
    drawn = await _drawCards(drawCount);

    const hasBlackJoker = drawn.some((c) => c.joker === "black");
    if (hasBlackJoker) {
      // Black Joker → Madness Table. dlc p.168.
      madness = await _rollMadnessTable(actor);
    }

    handResult = evaluateHand(drawn);
    const minHand = gizmoItem.system.blueprintHand ?? "pair";
    handMeets = meetsMinHand(handResult, minHand);

    if (handMeets) {
      // Derive construction TN from the Gizmo Construction Table. dlc p.168-169.
      const constructionTN = GIZMO_CONSTRUCTION_TABLE[minHand] ?? 5;
      // Blueprint raises add +2 each to Reliability. dlc p.170.
      const blueprintReliability = Math.min(19, 10 + rollResult.raises * 2);
      await gizmoItem.update({
        "system.blueprintStatus": "devised",
        "system.constructionTN": constructionTN,
        "system.reliability": blueprintReliability,
      });
    } else {
      await gizmoItem.update({ "system.blueprintStatus": "failed" });
    }
  } else {
    await gizmoItem.update({ "system.blueprintStatus": "failed" });
  }

  await _sendBlueprintMessage(actor, gizmoItem, rollResult, drawn, handResult, {
    succeeded,
    handMeets,
    madness,
  });
}

// ── Construction workflow ─────────────────────────────────────────────────────

/**
 * Construct the gizmo: tinkerin' roll vs construction TN. dlc p.170.
 * Each raise on the roll adds +2 Reliability (base 10, max 19).
 *
 * @param {Actor} actor — Mad Scientist actor
 * @param {Item} gizmoItem — a blueprinted gizmo (blueprintStatus = "devised")
 * @param {{ modifier?: number }} [opts]
 * @returns {Promise<void>}
 */
export async function constructGizmo(actor, gizmoItem, opts = {}) {
  if (gizmoItem.system.blueprintStatus !== "devised") {
    ui.notifications?.warn(game.i18n.localize("DEADLANDS.MadScientist.Warn.NeedsBlueprint"));
    return;
  }

  const modifier = opts.modifier ?? 0;
  const { level: tinkerinLevel = 0, modifier: tinkerinMod = 0 } = actor.system.tinkerin ?? {};
  const traitData = actor.system.traits?.deftness;
  const deftnessDie = traitData?.dieType ?? "d6";
  const dieCount = Math.max(1, tinkerinLevel);
  const constructionTN = gizmoItem.system.constructionTN ?? 5;

  const rollResult = rollExplodingPool(dieCount, deftnessDie, { modifier: modifier + tinkerinMod, tn: constructionTN });

  const succeeded = !rollResult.bust && rollResult.total >= constructionTN;
  // Start from blueprint-derived reliability (already includes blueprint raises). dlc p.170.
  let reliability = gizmoItem.system.reliability ?? 10;

  if (succeeded) {
    // Construction raises each add +2, cap at 19. dlc p.170.
    reliability = Math.min(19, reliability + rollResult.raises * 2);
    await gizmoItem.update({ "system.reliability": reliability, "system.constructed": true });
  }

  await _sendConstructionMessage(actor, gizmoItem, rollResult, { succeeded, reliability });
}

// ── Gizmo use + malfunction ───────────────────────────────────────────────────

/**
 * Check for malfunction when activating a gizmo. dlc p.247.
 * Roll 1d20; if result > reliability → malfunction, roll 2d6 on Malfunction Table.
 *
 * @param {Actor} actor — using actor
 * @param {Item} gizmoItem — the gizmo being used
 * @returns {Promise<{ malfunction: boolean, severity: string|null, d20: number }>}
 */
export async function checkMalfunction(actor, gizmoItem) {
  if (!gizmoItem.system.constructed) {
    ui.notifications?.warn(game.i18n.localize("DEADLANDS.MadScientist.Warn.NotConstructed"));
    return { malfunction: false, severity: null, d20: 0 };
  }

  const reliability = gizmoItem.system.reliability ?? 10;
  const d20 = Math.ceil(Math.random() * 20); // dlc p.247: roll 1d20 on use.
  const malfunction = d20 > reliability; // d20 > reliability → malfunction. dlc p.247.

  let severity = null;
  let d6Result = null;
  if (malfunction) {
    d6Result = Math.ceil(Math.random() * 6) + Math.ceil(Math.random() * 6); // 2d6 on table. dlc p.247.
    severity = _malfunctionSeverity(d6Result);
  }

  await _sendMalfunctionMessage(actor, gizmoItem, {
    d20,
    malfunction,
    severity,
    d6Result,
    reliability,
  });
  return { malfunction, severity, d20 };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function _drawCards(count) {
  if (game.combat) {
    return ActionDeck.deal(game.combat, count);
  }
  return shuffleDeck(buildFullDeck()).slice(0, count);
}

/**
 * Roll d20 on the Madness Table and whisper result to GM. dlc p.250.
 * @returns {Promise<{ roll: number, key: string }>}
 */
async function _rollMadnessTable(actor) {
  const roll = Math.ceil(Math.random() * 20);
  const entry =
    MADNESS_TABLE.find((e) => e.roll === roll) ?? MADNESS_TABLE[MADNESS_TABLE.length - 1];

  await ChatMessage.create({
    content: await foundry.applications.handlebars.renderTemplate("systems/deadlands-classic/templates/chat/madness-result.hbs", {
      actorName: actor.name,
      roll,
      key: entry.key,
      labelKey: `DEADLANDS.MadScientist.Madness.${_toPascal(entry.key)}.Label`,
      noteKey: `DEADLANDS.MadScientist.Madness.${_toPascal(entry.key)}.Note`,
    }),
    whisper: ChatMessage.getWhisperRecipients("GM"),
    speaker: ChatMessage.getSpeaker({ actor }),
  });

  return entry;
}

/**
 * Malfunction severity from 2d6. dlc p.247.
 * 2–5 → Major; 6–10 → Minor; 11–12 → Catastrophic.
 */
function _malfunctionSeverity(d6total) {
  if (d6total <= 5) {
    return "major";
  }
  if (d6total <= 10) {
    return "minor";
  }
  return "catastrophic";
}

async function _sendBlueprintMessage(actor, gizmoItem, rollResult, drawn, handResult, meta) {
  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/deadlands-classic/templates/chat/gizmo-result.hbs",
    {
      actorName: actor.name,
      gizmoName: gizmoItem.name,
      phase: "blueprint",
      rollResult,
      drawn,
      handResult,
      blueprintSucceeds: meta.handMeets,
      madness: meta.madness,
      minHandKey: gizmoItem.system.blueprintHand
        ? `DEADLANDS.Huckster.Hand.${_toPascal(gizmoItem.system.blueprintHand)}`
        : null,
    }
  );
  await ChatMessage.create({ content, speaker: ChatMessage.getSpeaker({ actor }) });
}

async function _sendConstructionMessage(actor, gizmoItem, rollResult, meta) {
  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/deadlands-classic/templates/chat/gizmo-result.hbs",
    {
      actorName: actor.name,
      gizmoName: gizmoItem.name,
      phase: "construction",
      rollResult,
      constructionSucceeds: meta.succeeded,
      reliability: meta.reliability,
    }
  );
  await ChatMessage.create({ content, speaker: ChatMessage.getSpeaker({ actor }) });
}

async function _sendMalfunctionMessage(actor, gizmoItem, meta) {
  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/deadlands-classic/templates/chat/gizmo-result.hbs",
    {
      actorName: actor.name,
      gizmoName: gizmoItem.name,
      phase: "malfunction",
      ...meta,
    }
  );
  await ChatMessage.create({ content, speaker: ChatMessage.getSpeaker({ actor }) });
}

function _toPascal(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : "";
}
