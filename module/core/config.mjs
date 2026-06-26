/**
 * DEADLANDS — system configuration constants.
 *
 * Single source of truth for the archetype-agnostic mechanical constants used
 * across `core/`. All values verified against the rulebook (`dlc`, Deadlands
 * Classic 20th Anniversary); page cites in comments aid review. No rulebook
 * prose is reproduced here — only numbers and our own identifiers.
 *
 * Naming: keys are camelCase to match `system.json` documentTypes and registry
 * keys; this object is exposed as `game.deadlandsClassic.config`.
 *
 * @see .claude/rules/naming.md
 * @license MIT
 */

/**
 * The 10 Traits — five Corporeal, five Mental. Insertion order is the canonical
 * sheet order (Corporeal block, then Mental block). `dlc` p.37-38.
 * @type {Record<string, { group: "corporeal" | "mental" }>}
 */
export const TRAITS = {
  deftness: { group: "corporeal" },
  nimbleness: { group: "corporeal" },
  quickness: { group: "corporeal" },
  strength: { group: "corporeal" },
  vigor: { group: "corporeal" },
  cognition: { group: "mental" },
  knowledge: { group: "mental" },
  mien: { group: "mental" },
  smarts: { group: "mental" },
  spirit: { group: "mental" },
};

/**
 * Standard Aptitudes grouped by governing Trait (nested model — `dlc` p.41-51,
 * every entry lists "Associated Trait"). Core ships only the *standard*
 * aptitudes available to any character.
 *
 * Deliberately EXCLUDED (added by their archetype modules to keep core
 * archetype-agnostic — each maps 1:1 to an Arcane Background):
 *   hexslingin' → Huckster, ritual → Shaman, faith → Blessed,
 *   mad science → Mad Scientist.
 *
 * `concentrations: true` flags aptitudes that split into specializations
 * (e.g. shootin': pistol/rifle/shotgun). Only the rulebook-enumerated ones are
 * flagged for now; the full concentration handling is built with the aptitude
 * schema in Phase 2 (re-verify against `dlc` p.41-51 then).
 *
 * @type {Record<string, Record<string, { concentrations?: boolean }>>}
 */
export const APTITUDES = {
  deftness: {
    bow: {},
    filchin: {},
    lockpickin: {},
    shootin: { concentrations: true },
    sleightOfHand: {},
    throwin: {},
  },
  nimbleness: {
    acrobatics: {},
    climbin: {},
    dodge: {},
    fightin: { concentrations: true },
    horseRidin: {},
    sneak: {},
  },
  quickness: {
    quickDraw: { concentrations: true },
  },
  strength: {},
  vigor: {},
  cognition: {
    artillery: {},
    arts: {},
    scrutinize: {},
    search: {},
    trackin: {},
  },
  knowledge: {
    academia: {},
    areaKnowledge: {},
    demolition: {},
    disguise: {},
    language: {},
    medicine: { concentrations: true },
    professional: {},
    science: {},
  },
  mien: {
    animalWranglin: {},
    leadership: {},
    overawe: {},
    performance: { concentrations: true },
    persuasion: {},
    taleTellin: {},
  },
  smarts: {
    bluff: {},
    ridicule: {},
    scroungin: {},
    streetwise: {},
    survival: {},
    tinkerin: {},
  },
  spirit: {
    guts: {},
  },
};

/**
 * Trait/Aptitude die types. The polyhedral set a Trait die can be (Coordination
 * d4..d12). Face value drives Wind max (`Vigor` + `Spirit`) — `dlc` p.40.
 * @type {readonly string[]}
 */
export const DIE_TYPES = ["d4", "d6", "d8", "d10", "d12"];

/**
 * Named Target Number difficulty ladder. `dlc` p.28.
 * @type {Record<string, number>}
 */
export const TNS = {
  foolproof: 3,
  fair: 5,
  onerous: 7,
  hard: 9,
  incredible: 11,
};

/**
 * Fate Chip colors and their fixed values. `dlc` p.146-148.
 *   - white: +1 die per chip on a Trait/Aptitude roll (spent before any
 *     red/blue/legend).
 *   - red: roll a bonus die, add to the highest; max 1/action; triggers the
 *     Marshal's Tithe.
 *   - blue: like red, no Tithe; max 1/action.
 *   - legend: as blue, or a full reroll (consumes the chip).
 * `windNegated: Infinity` for legend = "all Wind".
 * @type {Record<string, { woundsNegated: number, windNegated: number, bountyPoints: number, maxPerAction: number | null }>}
 */
export const CHIP_COLORS = {
  white: { woundsNegated: 1, windNegated: 5, bountyPoints: 1, maxPerAction: null },
  red: { woundsNegated: 2, windNegated: 10, bountyPoints: 2, maxPerAction: 1 },
  blue: { woundsNegated: 3, windNegated: 15, bountyPoints: 3, maxPerAction: 1 },
  legend: { woundsNegated: 5, windNegated: Infinity, bountyPoints: 5, maxPerAction: 1 },
};

/** Starting Fate Pot seed (Legend is earned, never seeded). `dlc` p.146. */
export const FATE_POT_SEED = { white: 50, red: 25, blue: 10, legend: 0 };

/** A character may hold at most this many chips; the surplus converts to Bounty Points. `dlc` p.146. */
export const CHIP_LIMIT = 10;

/**
 * Wound severity levels. `dlc` p.139. A location holds a `severity: 0-5`.
 * @type {Record<string, number>}
 */
export const WOUND_SEVERITIES = {
  none: 0,
  light: 1,
  heavy: 2,
  serious: 3,
  critical: 4,
  maimed: 5,
};

/** Highest severity a single location can reach. `dlc` p.139. */
export const WOUND_MAX = WOUND_SEVERITIES.maimed;

/**
 * Wound penalty applied to Trait/Aptitude rolls, keyed by severity level. The
 * penalty comes from the character's *highest* current wound, NOT the sum.
 * `dlc` p.140 (Wound Effects table).
 * @type {Record<number, number>}
 */
export const WOUND_PENALTIES = {
  0: 0,
  1: -1,
  2: -2,
  3: -3,
  4: -4,
  5: -5,
};

/**
 * Wound-track slots (8). Limbs are split Left/Right (a design decision, not a
 * raw table row — `dlc` p.133). `limb: true` marks locations that go unusable
 * when Maimed (arm = no hand, leg = halved Pace).
 * @type {Record<string, { limb?: boolean, side?: "left" | "right" }>}
 */
export const HIT_LOCATIONS = {
  noggin: {},
  upperGuts: {},
  lowerGuts: {},
  gizzards: {},
  leftArm: { limb: true, side: "left" },
  rightArm: { limb: true, side: "right" },
  leftLeg: { limb: true, side: "left" },
  rightLeg: { limb: true, side: "right" },
};

/**
 * Hit-location draw table: 1d20 → base location. `dlc` p.133. `legs`/`arms`
 * resolve to a side via a follow-up roll on any die: even = right, odd = left.
 * Each raise on the attack lets the attacker shift the result by ±1.
 * @type {ReadonlyArray<{ min: number, max: number, location: string, limb?: boolean }>}
 */
export const HIT_LOCATION_TABLE = [
  { min: 1, max: 4, location: "legs", limb: true },
  { min: 5, max: 9, location: "lowerGuts" },
  { min: 10, max: 10, location: "gizzards" },
  { min: 11, max: 14, location: "arms", limb: true },
  { min: 15, max: 19, location: "upperGuts" },
  { min: 20, max: 20, location: "noggin" },
];

/**
 * Action Deck card suits with tie-break precedence (higher wins):
 * Spades > Hearts > Diamonds > Clubs. `dlc` p.117.
 * @type {Record<string, { precedence: number, symbol: string }>}
 */
export const CARD_SUITS = {
  spades: { precedence: 4, symbol: "♠" },
  hearts: { precedence: 3, symbol: "♥" },
  diamonds: { precedence: 2, symbol: "♦" },
  clubs: { precedence: 1, symbol: "♣" },
};

/** Card ranks low→high; Ace high for initiative. 52-card deck + 2 jokers. `dlc` p.116-117. */
export const CARD_RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

/** The two jokers: Red beats Black; Black is the penalty card. `dlc` p.118. */
export const JOKERS = { red: "red", black: "black" };

/**
 * Aggregated config object exposed as `game.deadlandsClassic.config`.
 * Kept as a single frozen namespace so downstream code and modders read one API.
 */
export const DEADLANDS = Object.freeze({
  TRAITS,
  APTITUDES,
  DIE_TYPES,
  TNS,
  CHIP_COLORS,
  FATE_POT_SEED,
  CHIP_LIMIT,
  WOUND_SEVERITIES,
  WOUND_MAX,
  WOUND_PENALTIES,
  HIT_LOCATIONS,
  HIT_LOCATION_TABLE,
  CARD_SUITS,
  CARD_RANKS,
  JOKERS,
});
