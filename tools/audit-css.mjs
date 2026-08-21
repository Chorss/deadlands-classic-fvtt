#!/usr/bin/env node
/**
 * audit-css.mjs — CSS/class coverage check.
 *
 * Greps every `dlc-*` class from `templates/*.hbs` and `module/*.mjs` and checks
 * that a corresponding CSS selector exists in `styles/*.css`.
 *
 * Two severity levels, on purpose:
 *   templates/  → error   (exit 1) — the long-standing contract, kept strict.
 *   module/     → warning (exit 0) — chat cards built in template literals start
 *                 with a known backlog of unstyled classes (see MODULE_BACKLOG).
 *                 Flipping this to an error is the closing criterion of the
 *                 Ledger migration stage M4.
 *
 * Also reports dead selectors (defined in styles/ but used nowhere). That report
 * is informational only and never affects the exit code — during a UI migration
 * CSS legitimately lands before the markup that consumes it.
 *
 * Skips dynamic class fragments (e.g. `dlc-chip-{{color}}`, `${outcomeClass}`) —
 * these cannot be statically resolved and are reported separately as a note.
 *
 * Exit 0  — all template classes covered.
 * Exit 1  — uncovered template classes found (prints a list).
 *
 * Used by: `/verify-system`, `.githooks/pre-commit` (on *.hbs, *.css or *.mjs
 *   changes), PostToolUse hook for templates/ and styles/ edits.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Known unstyled classes in module/ — an existing gap, not a regression. Fixed in stage M4. */
const MODULE_BACKLOG = 9;

function collectFiles(dir, ext) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(ext))
    .map((e) => path.join(e.parentPath ?? e.path, e.name));
}

const classRe = /class="([^"]+)"/g;
// No `g` flag here — test() with a stateful regex alternates true/false (lastIndex bug).
// Matches a Handlebars expression or a JS template-literal interpolation.
const tokenRe = /\{\{[^}]+\}\}|\$\{[^}]*\}/;
// A `${…}` that is a whitespace-separated token of its own, so splitting the
// attribute loses it entirely (`class="dlc-roll-card ${outcomeClass}"`).
const bareInterpolationRe = /(^|\s)\$\{[^}]*\}/;

const dynamicFragments = new Set();

/**
 * Collect the static `dlc-*` classes used across a source tree.
 * Runtime-computed class lists go to `dynamicFragments` instead.
 *
 * @param {string} dir Directory to walk, relative to the repo root.
 * @param {string} ext File extension to scan (".hbs", ".mjs").
 * @returns {Set<string>} Statically resolvable class names.
 */
function collectUsedClasses(dir, ext) {
  const used = new Set();
  for (const file of collectFiles(path.join(REPO_ROOT, dir), ext)) {
    const src = fs.readFileSync(file, "utf8");
    for (const match of src.matchAll(classRe)) {
      const attr = match[1];
      const tokens = attr.split(/\s+/).filter((t) => t.startsWith("dlc-"));
      // A bare interpolation carries no `dlc-` prefix of its own, so the token split
      // drops it — record the whole attribute instead so it stays visible.
      if (tokens.length > 0 && bareInterpolationRe.test(attr)) {
        dynamicFragments.add(attr);
      }
      for (const token of tokens) {
        if (tokenRe.test(token)) {
          dynamicFragments.add(token);
        } else {
          used.add(token);
        }
      }
    }
  }
  return used;
}

// --- collect classes from templates and module code ---
const templateClasses = collectUsedClasses("templates", ".hbs");
const moduleClasses = collectUsedClasses("module", ".mjs");

// --- collect selectors from styles ---
const selectorRe = /\.(dlc-[a-z][a-z0-9-]*)/g;

const definedClasses = new Set();
for (const file of collectFiles(path.join(REPO_ROOT, "styles"), ".css")) {
  const src = fs.readFileSync(file, "utf8");
  for (const match of src.matchAll(selectorRe)) {
    definedClasses.add(match[1]);
  }
}

// --- compare ---
const missingFromTemplates = [...templateClasses].filter((c) => !definedClasses.has(c)).sort();
const missingFromModule = [...moduleClasses].filter((c) => !definedClasses.has(c)).sort();

const allUsed = new Set([...templateClasses, ...moduleClasses]);
const deadSelectors = [...definedClasses].filter((c) => !allUsed.has(c)).sort();

function reportDynamicFragments(write) {
  if (dynamicFragments.size === 0) {
    return;
  }
  write(`\n  note: ${dynamicFragments.size} dynamic fragment(s) skipped (runtime-built classes):`);
  for (const f of [...dynamicFragments].sort()) {
    write(`    ${f}`);
  }
}

/** Informational only — a migration puts CSS in place before the markup that uses it. */
function reportDeadSelectors() {
  if (deadSelectors.length === 0) {
    console.log("\n  dead selectors: none.");
    return;
  }
  console.log(
    `\n  note: ${deadSelectors.length} selector(s) defined in styles/ but used nowhere` +
      " (informational — does not affect the exit code):"
  );
  for (const c of deadSelectors) {
    console.log(`    .${c}`);
  }
}

function reportModuleWarnings() {
  if (missingFromModule.length === 0) {
    return;
  }
  const known = missingFromModule.length <= MODULE_BACKLOG ? " (known backlog, fixed in M4)" : "";
  console.warn(
    `\naudit-css WARNING — ${missingFromModule.length} class(es) used in module/ but missing` +
      `${known} from styles/:`
  );
  for (const c of missingFromModule) {
    console.warn(`  .${c}`);
  }
  if (missingFromModule.length > MODULE_BACKLOG) {
    console.warn(
      `\n  ${missingFromModule.length - MODULE_BACKLOG} above the known backlog of ` +
        `${MODULE_BACKLOG} — new unstyled classes were added. Add the CSS rules.`
    );
  }
}

if (missingFromTemplates.length > 0) {
  console.error(
    `audit-css FAILED — ${missingFromTemplates.length} class(es) used in templates but missing from styles/:\n`
  );
  for (const c of missingFromTemplates) {
    console.error(`  .${c}`);
  }
  reportDynamicFragments((m) => console.error(m));
  reportModuleWarnings();
  process.exit(1);
}

console.log(
  `audit-css OK — ${templateClasses.size} template + ${moduleClasses.size} module class(es), ` +
    "all template classes covered."
);
reportDynamicFragments((m) => console.log(m));
reportModuleWarnings();
reportDeadSelectors();
process.exit(0);
