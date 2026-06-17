#!/usr/bin/env node
/**
 * verify-documenttypes.mjs — System manifest sanity check.
 *
 * Validates:
 *   - `system.json` parses and declares required fields (type, id, compatibility>=14)
 *   - `esmodules` / `styles` / `languages` paths exist on disk
 *   - Language files parse and keep matching key sets (no orphan EN or PL keys)
 *
 * Used by: Claude Code PostToolUse hook, `/verify-system` slash command,
 *   `.githooks/pre-commit`, and eventually CI.
 *
 * TODO (Phase 1+): import `module/deadlands-classic.mjs` and compare
 *   `documentTypes` against ArchetypeRegistry / ItemRegistry. Registries are
 *   empty in Phase 0, so the comparison is deferred until they exist.
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

const en = readJson("lang/en.json");
const pl = readJson("lang/pl.json");
if (en && pl) {
  const enKeys = new Set(collectKeys(en));
  const plKeys = new Set(collectKeys(pl));
  const missingPl = [...enKeys].filter((k) => !plKeys.has(k));
  const missingEn = [...plKeys].filter((k) => !enKeys.has(k));
  const summarize = (list) =>
    list.slice(0, 5).join(", ") + (list.length > 5 ? ` (+${list.length - 5} more)` : "");
  if (missingPl.length) err(`lang/pl.json missing keys: ${summarize(missingPl)}`);
  if (missingEn.length) err(`lang/en.json missing keys: ${summarize(missingEn)}`);
}

if (errors.length) {
  console.error("verify-documenttypes FAILED:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log("verify-documenttypes OK");
