/**
 * DeadlandsActor — the system Actor document.
 *
 * Archetype-agnostic base behavior shared by every character type. The heavy
 * mechanics (exploding-pool rolls, chip economy) live in `core/dice` and
 * `core/chips`; this class is the thin document-level façade those subsystems
 * hang off. In Phase 1 the convenience methods delegate to the
 * `game.deadlandsClassic.dice` / `.chips` APIs once they exist (Phases 3–5).
 *
 * @license MIT
 */
export class DeadlandsActor extends Actor {
  /**
   * Initialise wind.value to wind.max on first creation so a new PC is not
   * immediately Winded. prepareDerivedData computes wind.max from die faces;
   * the schema default for wind.value is 0 and must be corrected here. dlc p.40.
   *
   * @override
   */
  _onCreate(data, options, userId) {
    super._onCreate(data, options, userId);
    if (userId !== game.userId) {
      return;
    }
    const wind = this.system.wind;
    if (wind && wind.value === 0 && wind.max > 0) {
      this.update({ "system.wind.value": wind.max }).catch((err) =>
        console.error("DeadlandsActor#_onCreate: failed to initialise wind.value", err)
      );
    }
  }

  /**
   * Roll a Trait or Aptitude as an exploding dice pool.
   * Thin façade over `game.deadlandsClassic.dice.rollTrait` (wired in Phase 3/4).
   *
   * @param {string} traitId               A key of {@link DEADLANDS.TRAITS}.
   * @param {object} [options]
   * @param {string} [options.aptitude]     Aptitude under the trait, if any.
   * @param {number} [options.tn]           Target Number (defaults to Fair = 5).
   * @param {number} [options.modifier]     Flat modifier applied to the roll.
   * @returns {Promise<unknown>} the roll result (shape defined in Phase 3).
   */
  async rollTrait(traitId, options = {}) {
    const dice = game.deadlandsClassic?.dice;
    if (!dice?.rollTrait) {
      throw new Error("DeadlandsActor#rollTrait: dice engine not available yet (Phase 3).");
    }
    return dice.rollTrait(this, traitId, options);
  }

  /**
   * Spend a Fate Chip held by this actor.
   * Thin façade over `game.deadlandsClassic.chips.spend` (wired in Phase 5).
   *
   * @param {"white"|"red"|"blue"|"legend"} color
   * @param {object} [context]  Roll/action context for the 1-per-action rules.
   * @returns {Promise<unknown>}
   */
  async spendFateChip(color, context = {}) {
    const chips = game.deadlandsClassic?.chips;
    if (!chips?.spend) {
      throw new Error("DeadlandsActor#spendFateChip: chip system not available yet (Phase 5).");
    }
    return chips.spend(this, color, context);
  }
}
