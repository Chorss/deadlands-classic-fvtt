#!/usr/bin/env node
/**
 * audit-i18n.mjs — i18n key usage-vs-existence check.
 *
 * Greps every STATIC `"DEADLANDS.*"` key literal from module/*.mjs and
 * templates/*.hbs and checks that it exists in lang/en.json (the authoritative
 * key set). Complements verify-documenttypes.mjs, which only checks EN<->PL
 * parity, not whether a key used in code exists at all.
 *
 * Only quoted, PascalCase keys that end at the closing quote are validated.
 * Keys assembled at runtime — template literals (`DEADLANDS.Trait.${id}.Label`)
 * or Handlebars `concat` with a trailing-dot prefix — cannot be resolved
 * statically; the `${…}` form is reported as a note, never as a failure.
 *
 * Exit 0 — every statically-used key exists in en.json.
 * Exit 1 — a used key is missing (prints a file:line list).
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

// A fully static key: quoted, PascalCase segments, ends at the closing quote.
// The quote requirement excludes bare CONFIG access like `DEADLANDS.WOUND_MAX`.
const STATIC_KEY_RE = /["'`](DEADLANDS(?:\.[A-Z][A-Za-z0-9]*)+)["'`]/g;
// A runtime key: a quoted/backticked DEADLANDS string that interpolates.
const DYNAMIC_KEY_RE = /["'`](DEADLANDS\.[A-Za-z0-9.]*)\$\{[^"'`]*["'`]/g;

const en = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "lang/en.json"), "utf8"));
const knownKeys = new Set(Object.keys(en));

const files = [
  ...collectFiles(path.join(REPO_ROOT, "module"), ".mjs"),
  ...collectFiles(path.join(REPO_ROOT, "templates"), ".hbs"),
];

const missing = [];
const dynamic = new Set();

for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  const rel = path.relative(REPO_ROOT, file);
  src.split("\n").forEach((line, i) => {
    for (const m of line.matchAll(STATIC_KEY_RE)) {
      if (!knownKeys.has(m[1])) {
        missing.push(`${m[1]}  (${rel}:${i + 1})`);
      }
    }
    for (const m of line.matchAll(DYNAMIC_KEY_RE)) {
      dynamic.add(`${m[1]}\${…}`);
    }
  });
}

if (missing.length === 0) {
  console.log("audit-i18n OK — every static DEADLANDS.* key used in code exists in lang/en.json.");
  if (dynamic.size > 0) {
    console.log(`  note: ${dynamic.size} runtime-built key prefix(es) skipped:`);
    for (const d of [...dynamic].sort()) {
      console.log(`    ${d}`);
    }
  }
  process.exit(0);
}

console.error(
  `audit-i18n FAILED — ${missing.length} key(s) used in code but missing from lang/en.json:\n`
);
for (const m of missing.sort()) {
  console.error(`  ${m}`);
}
process.exit(1);
