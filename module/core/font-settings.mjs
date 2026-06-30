/**
 * Display-font picker — world setting that updates --dlc-font-display live.
 * Four bundled offline fonts; no external network requests.
 */

export const SETTING_KEY = "displayFont";

const CSS_PROP = "--dlc-font-display";

const FONT_STACKS = {
  rye: '"Rye", Georgia, "Times New Roman", serif',
  arvo: '"Arvo", Georgia, serif',
  cinzel: '"Cinzel", Georgia, serif',
  system: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
};

/**
 * Apply a font choice by updating the CSS custom property on <html>.
 * Falls back to "rye" for unknown keys.
 *
 * @param {string} key - "rye" | "arvo" | "cinzel" | "system"
 */
export function applyFont(key) {
  const stack = FONT_STACKS[key] ?? FONT_STACKS.rye;
  document.documentElement.style.setProperty(CSS_PROP, stack);
}

/**
 * Register the world-scoped display-font setting.
 * Call once from the "init" hook.
 *
 * @param {string} systemId
 */
export function registerFontSettings(systemId) {
  game.settings.register(systemId, SETTING_KEY, {
    name: "DEADLANDS.Settings.DisplayFont.Label",
    hint: "DEADLANDS.Settings.DisplayFont.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "rye",
    choices: {
      rye: "DEADLANDS.Settings.DisplayFont.Rye",
      arvo: "DEADLANDS.Settings.DisplayFont.Arvo",
      cinzel: "DEADLANDS.Settings.DisplayFont.Cinzel",
      system: "DEADLANDS.Settings.DisplayFont.System",
    },
    onChange: applyFont,
  });
}
