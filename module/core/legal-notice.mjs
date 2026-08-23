/**
 * LegalNotice — the trademark / content disclaimer, visible inside the app.
 *
 * Until 0.4.1 the disclaimer lived only in `README.md`, which nobody reads from
 * inside Foundry. It now appears in three places a user cannot miss: the package
 * browser (`system.json` description), this settings-menu entry, and the README.
 *
 * Registered unrestricted — this is information for every user, not a GM tool.
 *
 * @license MIT
 */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class LegalNotice extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: "dlc-legal-notice",
    classes: ["deadlands-classic", "dlc-legal-notice"],
    window: { title: "DEADLANDS.Legal.Title", icon: "fa-solid fa-scale-balanced" },
    position: { width: 460, height: "auto" },
  };

  /** @override */
  static PARTS = {
    notice: { template: "systems/deadlands-classic/templates/apps/legal-notice.hbs" },
  };
}

/**
 * Register the legal-notice settings menu. Call once from the "init" hook.
 *
 * @param {string} systemId
 */
export function registerLegalNotice(systemId) {
  game.settings.registerMenu(systemId, "legalNotice", {
    name: "DEADLANDS.Legal.Title",
    label: "DEADLANDS.Legal.MenuLabel",
    hint: "DEADLANDS.Legal.MenuHint",
    icon: "fa-solid fa-scale-balanced",
    type: LegalNotice,
    restricted: false,
  });
}
