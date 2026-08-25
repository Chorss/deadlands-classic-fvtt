/**
 * DeadlandsItem — the system Item document.
 *
 * Archetype-agnostic base for every item subtype (weapon, armor, gear, edge,
 * hindrance, ammo, and the archetype-specific hex/miracle/favor/gizmo). Type
 * behavior lives in each item's TypeDataModel; this class is the shared
 * document-level hook surface for cross-type concerns added in later phases
 * (for example, ActiveEffect transfer for edges and hindrances).
 *
 * @license MIT
 */
export class DeadlandsItem extends Item {}
