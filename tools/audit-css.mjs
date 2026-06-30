#!/usr/bin/env node
/**
 * audit-css.mjs — CSS/template class coverage check.
 *
 * Greps every `dlc-*` class from templates/*.hbs and checks that a
 * corresponding CSS selector exists in styles/*.css.
 *
 * Skips dynamic class fragments (e.g. `dlc-chip-{{color}}`) — these
 * cannot be statically resolved and are reported separately as a note.
 *
 * Exit 0  — all classes covered.
 * Exit 1  — uncovered classes found (prints a list).
 *
 * Used by: `/verify-system`, `.githooks/pre-commit` (on *.hbs or *.css changes),
 *   PostToolUse hook for templates/ and styles/ edits.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function collectFiles(dir, ext) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(ext))
    .map((e) => path.join(e.parentPath ?? e.path, e.name));
}

// --- collect classes from templates ---
const hbsFiles = collectFiles(path.join(REPO_ROOT, "templates"), ".hbs");
const classRe = /class="([^"]+)"/g;
// No `g` flag here — test() with a stateful regex alternates true/false (lastIndex bug).
const tokenRe = /\{\{[^}]+\}\}/;

const usedClasses = new Set();
const dynamicFragments = new Set();

for (const file of hbsFiles) {
  const src = fs.readFileSync(file, "utf8");
  for (const match of src.matchAll(classRe)) {
    for (const token of match[1].split(/\s+/)) {
      if (!token.startsWith("dlc-")) {
        continue;
      }
      if (tokenRe.test(token)) {
        dynamicFragments.add(token);
      } else {
        usedClasses.add(token);
      }
    }
  }
}

// --- collect selectors from styles ---
const cssFiles = collectFiles(path.join(REPO_ROOT, "styles"), ".css");
const selectorRe = /\.(dlc-[a-z][a-z0-9-]*)/g;

const definedClasses = new Set();
for (const file of cssFiles) {
  const src = fs.readFileSync(file, "utf8");
  for (const match of src.matchAll(selectorRe)) {
    definedClasses.add(match[1]);
  }
}

// --- compare ---
const missing = [...usedClasses].filter((c) => !definedClasses.has(c)).sort();

if (missing.length === 0) {
  console.log(`audit-css OK — ${usedClasses.size} classes, all covered.`);
  if (dynamicFragments.size > 0) {
    console.log(
      `  note: ${dynamicFragments.size} dynamic fragments skipped (handlebars expressions):`
    );
    for (const f of [...dynamicFragments].sort()) {
      console.log(`    ${f}`);
    }
  }
  process.exit(0);
}

console.error(
  `audit-css FAILED — ${missing.length} class(es) used in templates but missing from styles/:\n`
);
for (const c of missing) {
  console.error(`  .${c}`);
}
if (dynamicFragments.size > 0) {
  console.error(
    `\n  note: ${dynamicFragments.size} dynamic fragments not checked (handlebars expressions).`
  );
}
process.exit(1);
