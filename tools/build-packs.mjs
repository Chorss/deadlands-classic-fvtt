#!/usr/bin/env node
/**
 * build-packs.mjs — build every compendium a manifest declares, from its JSON source.
 *
 * Usage: node tools/build-packs.mjs <manifest.json> <sourceRoot> <packRoot>
 *   node tools/build-packs.mjs system.json         packs/_source   packs
 *   node tools/build-packs.mjs content/module.json content/_source content/packs
 *
 * `fvtt package pack` builds exactly ONE compendium per invocation and requires
 * `-n <name>`; the bare `--in packs/_source --out packs` form that package.json
 * carried until 0.4.1 fails with "No compendium name provided" and builds nothing.
 * That, plus the release workflow never calling it at all, is why every published
 * release through 0.4.0 shipped source JSON and zero LevelDB — six compendiums
 * that Foundry silently recreated as empty.
 *
 * Driving the loop off `manifest.packs[]` keeps the build honest: a pack added to
 * the manifest is built without touching this file, and a pack whose source folder
 * is missing fails loudly here rather than silently shipping empty.
 *
 * @license MIT
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const [manifestPath, sourceRoot, packRoot] = process.argv.slice(2);
if (!manifestPath || !sourceRoot || !packRoot) {
  console.error("usage: node tools/build-packs.mjs <manifest.json> <sourceRoot> <packRoot>");
  process.exit(2);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const packs = manifest.packs ?? [];
if (packs.length === 0) {
  console.error(`build-packs: ${manifestPath} declares no packs`);
  process.exit(1);
}

const missing = packs.filter((p) => !fs.existsSync(path.join(sourceRoot, p.name)));
if (missing.length) {
  console.error("build-packs FAILED — no JSON source for:");
  for (const p of missing) {
    console.error(`  - ${p.name} (expected ${path.join(sourceRoot, p.name)})`);
  }
  process.exit(1);
}

fs.mkdirSync(packRoot, { recursive: true });

for (const pack of packs) {
  const src = path.join(sourceRoot, pack.name);
  const entries = fs.readdirSync(src).filter((f) => f.endsWith(".json"));
  if (entries.length === 0) {
    console.error(`build-packs FAILED — ${src} contains no .json documents`);
    process.exit(1);
  }
  // Rebuild from scratch: LevelDB is append-only, so packing over a stale store
  // would keep documents that have since been deleted from the JSON source.
  fs.rmSync(path.join(packRoot, pack.name), { recursive: true, force: true });
  execFileSync(
    "npx",
    ["fvtt", "package", "pack", "-n", pack.name, "--in", src, "--out", packRoot],
    {
      stdio: "inherit",
    }
  );
  console.log(`  built ${pack.name} (${entries.length} documents)`);
}

console.log(`build-packs OK — ${packs.length} compendium(s) from ${sourceRoot} into ${packRoot}`);
