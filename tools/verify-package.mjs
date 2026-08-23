#!/usr/bin/env node
/**
 * verify-package.mjs — positive content gate for a built distribution archive.
 *
 * Usage: node tools/verify-package.mjs <manifest.json> <archive.zip>
 *                                        [--require-pinned-download]
 *
 * Every other check in this repo validates the *working tree*. This one validates
 * the artifact a user actually installs, by resolving every declared path **inside
 * the archive** — never on the CI disk. That distinction is the whole point: the
 * 0.2.0-0.4.0 releases shipped with zero built compendium packs and zero fonts,
 * and every disk-based check stayed green throughout, because the files existed in
 * the checkout and simply never made it into the zip.
 *
 * Checks (all are errors — exit 1):
 *   1. The manifest itself sits at the archive root (`system.json` / `module.json`).
 *   2. Every `esmodules[]`, `styles[]` and `languages[].path` entry exists in the archive.
 *   3. Every `packs[].path` exists AND contains a `CURRENT` file. `CURRENT` is the
 *      LevelDB sentinel written by `fvtt package pack`; a bare directory of source
 *      JSON is not a built pack, and Foundry silently creates an empty compendium
 *      rather than erroring, so this is otherwise invisible until a user opens it.
 *   4. Every `url(...)` target in every shipped stylesheet resolves to a file in the
 *      archive. Resolution is relative to the **containing stylesheet**, not the
 *      entry point (`styles/_variables.css` → `../fonts/x.woff2` → `fonts/x.woff2`).
 *   5. With --require-pinned-download: `download` points at a release tag rather
 *      than `latest`. Opt-in because the committed manifest legitimately carries
 *      the `latest` URL, which release.yml rewrites at build time.
 *
 * Deliberately generic over the manifest so the system zip and the content-module
 * zip share one gate — the module's paths are relative to the module root, which is
 * the archive root in both cases.
 *
 * Used by: `.github/workflows/release.yml` (both build steps).
 *
 * @license MIT
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const errors = [];

function err(msg) {
  errors.push(msg);
}

/** List every entry path in the archive, normalised (no `./`, no trailing slash). */
function listArchive(zipPath) {
  const raw = execFileSync("unzip", ["-Z1", zipPath], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  return raw
    .split("\n")
    .map((line) => line.trim().replace(/^\.\//, "").replace(/\/$/, ""))
    .filter(Boolean);
}

/** Read one file out of the archive as text. */
function readFromArchive(zipPath, entry) {
  return execFileSync("unzip", ["-p", zipPath, entry], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
}

/** Assert a declared path is present in the archive. */
function requireEntry(entries, target, label) {
  if (!entries.has(target)) {
    err(`${label}: "${target}" is declared in the manifest but missing from the archive`);
    return false;
  }
  return true;
}

/** Manifest-declared code, style and language paths. */
function checkDeclaredPaths(manifest, entries) {
  for (const esm of manifest.esmodules ?? []) {
    requireEntry(entries, esm, "esmodule");
  }
  for (const style of manifest.styles ?? []) {
    requireEntry(entries, style, "style");
  }
  for (const lang of manifest.languages ?? []) {
    requireEntry(entries, lang.path, "language");
  }
}

/**
 * Compendium packs must be built LevelDB stores, not source directories.
 * `CURRENT` is the sentinel `fvtt package pack` writes next to the MANIFEST and log files.
 */
function checkPacks(manifest, entries) {
  for (const pack of manifest.packs ?? []) {
    const dir = pack.path.replace(/\/$/, "");
    const sentinel = `${dir}/CURRENT`;
    if (!entries.has(sentinel)) {
      err(
        `pack "${pack.name}": no built LevelDB at "${dir}" (missing "${sentinel}"). ` +
          "Did the build run `fvtt package pack`?"
      );
    }
  }
}

/**
 * The published `download` must point at a specific tag, not `latest`.
 *
 * The registry stores one manifest per released version, so a `download` on
 * `releases/latest/download/…` makes installing an older version from the
 * version history fetch whatever is newest instead. `manifest` deliberately
 * stays on `latest` — that is the URL Foundry re-checks for updates.
 *
 * Only enforced with --require-pinned-download, because the committed manifest
 * legitimately carries the `latest` URL; release.yml rewrites it at build time
 * and passes the flag, so a reordered or broken pin step fails the build.
 */
function checkPinnedDownload(manifest) {
  const url = manifest.download ?? "";
  if (!/\/releases\/download\/[^/]+\/[^/]+$/.test(url)) {
    err(
      `download is not pinned to a release tag: "${url}" — ` +
        "expected .../releases/download/<tag>/<asset>"
    );
  }
}

/** True for URLs that are not archive-relative file references. */
function isExternalUrl(url) {
  return /^(data:|https?:|\/\/|\/)/.test(url);
}

/** Extract every `url(...)` target from a stylesheet's text. */
function extractCssUrls(css) {
  const urls = [];
  const re = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;
  let m = re.exec(css);
  while (m !== null) {
    urls.push(m[2].trim());
    m = re.exec(css);
  }
  return urls;
}

/**
 * Every asset a shipped stylesheet points at must travel with it.
 *
 * Globs the CSS actually present in the archive rather than walking `@import`
 * from the entry point — a stylesheet that ships but is unreachable still 404s
 * for anything it references, and the glob cannot miss a new directory.
 */
function checkCssAssets(zipPath, entries) {
  for (const entry of [...entries].filter((e) => e.endsWith(".css"))) {
    const baseDir = path.posix.dirname(entry);
    for (const url of extractCssUrls(readFromArchive(zipPath, entry))) {
      if (isExternalUrl(url)) {
        continue;
      }
      const clean = url.split(/[?#]/)[0];
      const resolved = path.posix.normalize(path.posix.join(baseDir, clean));
      if (!entries.has(resolved)) {
        err(`${entry}: url("${url}") resolves to "${resolved}", which is not in the archive`);
      }
    }
  }
}

// ── main ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const requirePinnedDownload = args.includes("--require-pinned-download");
const [manifestPath, zipPath] = args.filter((a) => !a.startsWith("--"));
if (!manifestPath || !zipPath) {
  console.error(
    "usage: node tools/verify-package.mjs <manifest.json> <archive.zip> [--require-pinned-download]"
  );
  process.exit(2);
}
for (const p of [manifestPath, zipPath]) {
  if (!fs.existsSync(p)) {
    console.error(`verify-package: no such file: ${p}`);
    process.exit(2);
  }
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const entries = new Set(listArchive(zipPath));

requireEntry(entries, path.basename(manifestPath), "manifest");
checkDeclaredPaths(manifest, entries);
checkPacks(manifest, entries);
checkCssAssets(zipPath, entries);
if (requirePinnedDownload) {
  checkPinnedDownload(manifest);
}

if (errors.length) {
  console.error(`verify-package FAILED for ${path.basename(zipPath)}:`);
  for (const e of errors) {
    console.error(`  - ${e}`);
  }
  process.exit(1);
}
console.log(
  `verify-package OK — ${path.basename(zipPath)} contains every path declared in ` +
    `${path.basename(manifestPath)} (${entries.size} entries checked)`
);
