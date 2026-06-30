#!/usr/bin/env node
/**
 * verify-documenttypes.mjs — System manifest sanity check.
 *
 * Validates:
 *   - `system.json` parses and declares required fields (type, id, compatibility>=14)
 *   - `esmodules` / `styles` / `languages` paths exist on disk
 *   - Language files parse and keep matching key sets (no orphan EN or PL keys)
 *   - `documentTypes.Actor` matches ArchetypeRegistry registrations (static grep)
 *   - `documentTypes.Item` covers all ItemRegistry registrations (static grep)
 *
 * Used by: Claude Code PostToolUse hook, `/verify-system` slash command,
 *   `.githooks/pre-commit`, and CI.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

function err(msg) {
  errors.push(msg);
}

function readJson(relPath) {
  const full = path.join(REPO_ROOT, relPath);
  if (!fs.existsSync(full)) {
    err(`missing file: ${relPath}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(full, "utf8"));
  } catch (e) {
    err(`invalid JSON in ${relPath}: ${e.message}`);
    return null;
  }
}

function collectKeys(obj, prefix = "") {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      keys.push(...collectKeys(v, full));
    } else {
      keys.push(full);
    }
  }
  return keys;
}

const manifest = readJson("system.json");
if (manifest) {
  if (manifest.type !== "system") {
    err('system.json: "type" must be "system"');
  }
  if (manifest.id !== "deadlands-classic") {
    err(`system.json: "id" must be "deadlands-classic", got "${manifest.id}"`);
  }
  const minCompat = manifest.compatibility?.minimum;
  if (!minCompat || Number(minCompat) < 14) {
    err(`system.json: compatibility.minimum must be >= 14, got "${minCompat}"`);
  }
  if (!manifest.documentTypes?.Actor || typeof manifest.documentTypes.Actor !== "object") {
    err("system.json: documentTypes.Actor missing or malformed");
  }
  if (!manifest.documentTypes?.Item || typeof manifest.documentTypes.Item !== "object") {
    err("system.json: documentTypes.Item missing or malformed");
  }

  for (const esm of manifest.esmodules ?? []) {
    if (!fs.existsSync(path.join(REPO_ROOT, esm))) {
      err(`esmodule path not found: ${esm}`);
    }
  }
  for (const style of manifest.styles ?? []) {
    if (!fs.existsSync(path.join(REPO_ROOT, style))) {
      err(`style path not found: ${style}`);
    }
  }
  for (const lang of manifest.languages ?? []) {
    if (!fs.existsSync(path.join(REPO_ROOT, lang.path))) {
      err(`language path not found: ${lang.path}`);
    }
  }
}

/**
 * Detect i18n keys that are both a terminal string value and a parent prefix of another key.
 * Foundry merges flat dot-notation keys into a nested object at runtime, so
 * "FOO.Bar": "x" + "FOO.Bar.Baz": "y" causes a TypeError ("cannot set property 'Baz' on string").
 */
function checkI18nParentConflicts(langFile, flatJson) {
  const keys = Object.keys(flatJson);
  const _keySet = new Set(keys);
  for (const key of keys) {
    const child = keys.find((k) => k.startsWith(`${key}.`));
    if (child) {
      err(
        `${langFile}: "${key}" is a string value but also a parent of "${child}" — rename to "${key}.Label"`
      );
    }
  }
}

const LANG_FILES = ["lang/en.json", "lang/pl.json"];
const [en, pl] = LANG_FILES.map(readJson);

for (const [file, data] of LANG_FILES.map((f, i) => [f, [en, pl][i]])) {
  if (data) {
    checkI18nParentConflicts(file, data);
  }
}

if (en && pl) {
  const enKeys = new Set(collectKeys(en));
  const plKeys = new Set(collectKeys(pl));
  const summarize = (list) =>
    list.slice(0, 5).join(", ") + (list.length > 5 ? ` (+${list.length - 5} more)` : "");
  const missingPl = [...enKeys].filter((k) => !plKeys.has(k));
  const missingEn = [...plKeys].filter((k) => !enKeys.has(k));
  if (missingPl.length) {
    err(`lang/pl.json missing keys: ${summarize(missingPl)}`);
  }
  if (missingEn.length) {
    err(`lang/en.json missing keys: ${summarize(missingEn)}`);
  }
}

// ── Registry vs documentTypes cross-check (static source analysis) ───────────
//
// We cannot import module/deadlands-classic.mjs in Node because it uses
// browser globals (foundry, game, CONFIG, etc.). Instead, grep the source for
// ArchetypeRegistry.register / ItemRegistry.register calls and extract the
// `id:` field from the line immediately following each call. This is a
// lightweight static check — it catches the most common drift (adding an
// archetype file but forgetting to update system.json, or vice-versa).

/** Extract the `id: "..."` from the lines immediately following a register call. */
function extractIdFromLines(lines, callLine) {
  for (let j = callLine + 1; j < Math.min(callLine + 6, lines.length); j++) {
    const m = lines[j].match(/id:\s*["']([^"']+)["']/);
    if (m) {
      return m[1];
    }
  }
  return null;
}

/** Collect all mjs files under dir recursively. */
function collectMjsFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectMjsFiles(full, acc);
    } else if (entry.name.endsWith(".mjs")) {
      acc.push(full);
    }
  }
  return acc;
}

function grepRegisteredIds(registry) {
  const moduleDir = path.join(REPO_ROOT, "module");
  const pattern = new RegExp(`${registry}\\.register\\(`);
  const ids = new Set();

  for (const file of collectMjsFiles(moduleDir)) {
    const lines = fs.readFileSync(file, "utf8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) {
        const id = extractIdFromLines(lines, i);
        if (id) {
          ids.add(id);
        }
      }
    }
  }

  return ids;
}

if (manifest) {
  const archetypeIds = grepRegisteredIds("ArchetypeRegistry");
  const actorTypes = new Set(Object.keys(manifest.documentTypes?.Actor ?? {}));
  for (const id of archetypeIds) {
    if (!actorTypes.has(id)) {
      err(`ArchetypeRegistry registers "${id}" but system.json documentTypes.Actor is missing it`);
    }
  }
  for (const id of actorTypes) {
    if (!archetypeIds.has(id)) {
      err(
        `system.json documentTypes.Actor has "${id}" but no ArchetypeRegistry.register call found`
      );
    }
  }

  const itemIds = grepRegisteredIds("ItemRegistry");
  const itemTypes = new Set(Object.keys(manifest.documentTypes?.Item ?? {}));
  for (const id of itemIds) {
    if (!itemTypes.has(id)) {
      err(`ItemRegistry registers "${id}" but system.json documentTypes.Item is missing it`);
    }
  }
  // Note: documentTypes.Item may contain untyped items (weapon, armor, gear, ammo)
  // that have no registered data model — that is intentional (plain TypeDataModel).
  // We only flag Item types that ARE registered but missing from system.json.
}

if (errors.length) {
  console.error("verify-documenttypes FAILED:");
  for (const e of errors) {
    console.error(`  - ${e}`);
  }
  process.exit(1);
}
console.log("verify-documenttypes OK");
