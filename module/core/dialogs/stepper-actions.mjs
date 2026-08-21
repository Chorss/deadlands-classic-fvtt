/**
 * Shared stepper behavior for DialogV2-based forms (M6).
 *
 * A +/- pair that nudges a named `<input type="number">` living in the same
 * dialog form, clamped to that input's own `min`/`max`. `DialogV2` is a full
 * `ApplicationV2` subclass, so its `options.actions` map works exactly like a
 * sheet's `static DEFAULT_OPTIONS.actions` — spread `stepperActions` into any
 * `DialogV2.prompt()` config's `actions` to wire it up, no custom render hook
 * or manual `addEventListener` needed.
 *
 * Markup contract: two `<button data-action="stepUp|stepDown" data-for="<input
 * name>">` elements next to the target input. See `.dlc-stepper` in
 * `styles/dialogs.css` and `templates/dialogs/trait-roll-dialog.hbs`.
 *
 * @license MIT
 */

/**
 * @param {number} delta
 * @returns {(this: foundry.applications.api.DialogV2, event: PointerEvent, target: HTMLElement) => void}
 */
function step(delta) {
  return function (_event, target) {
    const input = this.element.querySelector(`input[name="${target.dataset.for}"]`);
    if (!input) {
      return;
    }
    const min = input.min !== "" ? Number(input.min) : Number.NEGATIVE_INFINITY;
    const max = input.max !== "" ? Number(input.max) : Number.POSITIVE_INFINITY;
    input.value = Math.min(max, Math.max(min, Number(input.value || 0) + delta));
  };
}

/** Spread into a `DialogV2.prompt()` config's `actions` map. */
export const stepperActions = {
  stepUp: step(1),
  stepDown: step(-1),
};
