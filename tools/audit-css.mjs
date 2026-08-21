#!/usr/bin/env node
/**
 * audit-css.mjs — CSS/class coverage check.
 *
 * Greps every `dlc-*` class from `templates/*.hbs` and `module/*.mjs` and checks
 * that a corresponding CSS selector exists in `styles/*.css`.
 *
 * templates/ and module/ are both an error (exit 1) — the long-standing template
 * contract, plus module/ as of M6, which closed the last entry of MODULE_BACKLOG
 * (`dlc-hand-dialog`, CombatantHandDialog's root class — see styles/dialogs.css).
 * MODULE_BACKLOG is kept as an empty, documented set rather than deleted so a
 * future regression has somewhere deliberate to go if it's ever excused again.
 *
 * Also reports selectors defined in styles/ that nothing uses, split by confidence:
 * genuinely dead vs. probably reached through a dynamic fragment. Informational
 * only, never affects the exit code — during a UI migration CSS legitimately lands
 * before the markup that consumes it.
 *
 * Classes are collected from `class="…"` attributes and, in `.mjs`, from bare
 * `"dlc-*"` string literals — `classList.add()`, `DEFAULT_OPTIONS.classes` and
 * computed class names never appear inside a `class="…"` attribute.
 *
 * Skips dynamic class fragments (e.g. `dlc-chip-{{color}}`, `${outcomeClass}`) —
 * these cannot be statically resolved and are reported separately as a note.
 *
 * Exit 0  — all template and module classes covered.
 * Exit 1  — uncovered template and/or module classes found (prints a list).
 *
 * Used by: `npm run verify:all` (hence CI and `/verify-system`) and
 *   `.githooks/pre-commit` on *.hbs, *.css or *.mjs changes.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Classes used in `module/` deliberately excused from the coverage check — a
 * disclosed exception, not silent drift. Empty since M6 closed the last entry
 * (`dlc-hand-dialog`); frozen as names rather than a count so a one-for-one
 * swap (style one, add another) still trips the check.
 */
const MODULE_BACKLOG = new Set([]);

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
// A `dlc-*` class name as a standalone string literal — how classList.add(),
// DEFAULT_OPTIONS.classes and computed class names reach the DOM.
const literalRe = /["'`](dlc-[a-z][a-z0-9-]*)["'`]/g;
// Handlebars *block* syntax. Stripped before splitting the attribute, otherwise a
// class inside a block sticks to `}}`/`{{/if}}` and is lost in the split.
const hbBlockRe = /\{\{[#/][^}]*\}\}|\{\{\s*else[^}]*\}\}/g;
// No `g` flag here — test() with a stateful regex alternates true/false (lastIndex bug).
// Matches a Handlebars expression or a JS template-literal interpolation.
const tokenRe = /\{\{[^}]+\}\}|\$\{[^}]*\}/;
// A `${…}` that is a whitespace-separated token of its own, so splitting the
// attribute loses it entirely (`class="dlc-roll-card ${outcomeClass}"`).
const bareInterpolationRe = /(^|\s)\$\{[^}]*\}/;
const cssCommentRe = /\/\*[\s\S]*?\*\//g;

const dynamicFragments = new Set();

/**
 * Sort the `dlc-*` tokens of one `class="…"` attribute into static and dynamic.
 *
 * @param {string} attr Raw attribute value.
 * @param {Set<string>} used Receives statically resolvable class names.
 */
function collectFromAttribute(attr, used) {
  // A bare interpolation carries no `dlc-` prefix of its own, so the token split
  // drops it — record the whole attribute instead so it stays visible.
  if (bareInterpolationRe.test(attr)) {
    dynamicFragments.add(attr.replace(/\s+/g, " ").trim());
  }
  for (const token of attr.replace(hbBlockRe, " ").split(/\s+/)) {
    if (!token.startsWith("dlc-")) {
      continue;
    }
    if (tokenRe.test(token)) {
      dynamicFragments.add(token);
    } else {
      used.add(token);
    }
  }
}

/**
 * Collect the static `dlc-*` classes used across a source tree.
 * Runtime-computed class lists go to `dynamicFragments` instead.
 *
 * @param {string} dir Directory to walk, relative to the repo root.
 * @param {string} ext File extension to scan (".hbs", ".mjs").
 * @param {boolean} scanLiterals Also collect bare `"dlc-*"` string literals.
 * @returns {Set<string>} Statically resolvable class names.
 */
function collectUsedClasses(dir, ext, scanLiterals) {
  const used = new Set();
  for (const file of collectFiles(path.join(REPO_ROOT, dir), ext)) {
    const src = fs.readFileSync(file, "utf8");
    for (const match of src.matchAll(classRe)) {
      collectFromAttribute(match[1], used);
    }
    if (scanLiterals) {
      for (const match of src.matchAll(literalRe)) {
        used.add(match[1]);
      }
    }
  }
  return used;
}

// --- collect classes from templates and module code ---
const templateClasses = collectUsedClasses("templates", ".hbs", false);
const moduleClasses = collectUsedClasses("module", ".mjs", true);

// --- collect selectors from styles ---
const selectorRe = /\.(dlc-[a-z][a-z0-9-]*)/g;

const definedClasses = new Set();
for (const file of collectFiles(path.join(REPO_ROOT, "styles"), ".css")) {
  // Comments are stripped first — a class named only in a comment is not defined,
  // and treating it as such punches a hole in the template gate.
  const src = fs.readFileSync(file, "utf8").replace(cssCommentRe, " ");
  for (const match of src.matchAll(selectorRe)) {
    definedClasses.add(match[1]);
  }
}

// --- compare ---
const missingFromTemplates = [...templateClasses].filter((c) => !definedClasses.has(c)).sort();
const missingFromModule = [...moduleClasses].filter((c) => !definedClasses.has(c)).sort();

const allUsed = new Set([...templateClasses, ...moduleClasses]);
// Static prefix of each dynamic fragment (`dlc-chip-{{chip.color}}` → `dlc-chip-`).
// A bare `dlc-` prefix (from `dlc-{{group.id}}`) matches everything, so it is dropped.
const dynamicPrefixes = [...dynamicFragments]
  .map((f) => f.match(/^(dlc-[a-z0-9-]*?)\{\{/)?.[1])
  .filter((p) => p && p.length > "dlc-".length);

const unusedSelectors = [...definedClasses].filter((c) => !allUsed.has(c)).sort();
const maybeCovered = unusedSelectors.filter((c) => dynamicPrefixes.some((p) => c.startsWith(p)));
const deadSelectors = unusedSelectors.filter((c) => !maybeCovered.includes(c));

function reportDynamicFragments(write) {
  if (dynamicFragments.size === 0) {
    return;
  }
  write(`\n  note: ${dynamicFragments.size} dynamic fragment(s) skipped (runtime-built classes):`);
  for (const f of [...dynamicFragments].sort()) {
    write(`    ${f}`);
  }
}

function reportList(heading, classes) {
  if (classes.length === 0) {
    return;
  }
  console.log(heading);
  for (const c of classes) {
    console.log(`    .${c}`);
  }
}

/** Informational only — a migration puts CSS in place before the markup that uses it. */
function reportUnusedSelectors() {
  if (unusedSelectors.length === 0) {
    console.log("\n  dead selectors: none.");
    return;
  }
  console.log("\n  (informational — the sections below do not affect the exit code)");
  reportList(
    `\n  ${deadSelectors.length} selector(s) defined in styles/ but used nowhere:`,
    deadSelectors
  );
  reportList(
    `\n  ${maybeCovered.length} selector(s) with no static use, probably reached ` +
      "through a dynamic fragment:",
    maybeCovered
  );
}

function reportModuleFailures() {
  if (missingFromModule.length === 0) {
    return;
  }
  const unexpected = missingFromModule.filter((c) => !MODULE_BACKLOG.has(c));
  console.error(
    `\naudit-css FAILED — ${missingFromModule.length} class(es) used in module/ but missing from styles/:`
  );
  for (const c of missingFromModule) {
    console.error(`  .${c}${MODULE_BACKLOG.has(c) ? "" : "   ← NOT in the known backlog"}`);
  }
  if (unexpected.length > 0) {
    console.error(
      `\n  ${unexpected.length} class(es) outside the known backlog — ` +
        "add the CSS rules, or extend MODULE_BACKLOG deliberately."
    );
  }
}

if (missingFromTemplates.length > 0 || missingFromModule.length > 0) {
  if (missingFromTemplates.length > 0) {
    console.error(
      `audit-css FAILED — ${missingFromTemplates.length} class(es) used in templates but missing from styles/:\n`
    );
    for (const c of missingFromTemplates) {
      console.error(`  .${c}`);
    }
  }
  reportDynamicFragments((m) => console.error(m));
  reportModuleFailures();
  process.exit(1);
}

console.log(
  `audit-css OK — ${templateClasses.size} template + ${moduleClasses.size} module class(es), ` +
    "all template and module classes covered."
);
reportDynamicFragments((m) => console.log(m));
reportUnusedSelectors();
process.exit(0);
