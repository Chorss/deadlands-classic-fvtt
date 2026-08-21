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
 * Markup contract: a `<button data-action="step" data-delta="±1" data-for="<input
 * name>">` element next to the target input. See `.dlc-stepper` in
 * `styles/dialogs.css` and `templates/dialogs/parts/modifier-stepper.hbs`.
 *
 * @license MIT
 */

/**
 * @this {foundry.applications.api.DialogV2}
 * @param {PointerEvent} _event
 * @param {HTMLElement} target
 */
function step(_event, target) {
  const delta = Number(target.dataset.delta);
  if (!Number.isFinite(delta)) {
    return;
  }
  const input = this.element.querySelector(`input[name="${target.dataset.for}"]`);
  if (!input) {
    return;
  }
  const min = input.min !== "" ? Number(input.min) : Number.NEGATIVE_INFINITY;
  const max = input.max !== "" ? Number(input.max) : Number.POSITIVE_INFINITY;
  input.value = Math.min(max, Math.max(min, Number(input.value || 0) + delta));
}

/** Spread into a `DialogV2.prompt()` config's `actions` map. */
export const stepperActions = {
  step,
};
