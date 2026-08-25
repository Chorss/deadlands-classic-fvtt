#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findRuleIssues, isRuleAuditFile } from "./audit-rules-lib.mjs";
import { validateRulesCatalog } from "./rules-catalog-lib.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CATALOG_FILE = path.join(ROOT, "rules/source-catalog.json");
const SKIP_DIRS = new Set([".git", "node_modules", "vendor", "books", ".pdf-extract"]);

function walk(relative = "") {
  const files = [];
  for (const entry of fs.readdirSync(path.join(ROOT, relative), { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) {
      continue;
    }
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(child));
    } else if (isRuleAuditFile(child)) {
      files.push(child);
    }
  }
  return files;
}

if (!fs.existsSync(CATALOG_FILE)) {
  console.error("audit-rules: rules/source-catalog.json is required");
  process.exit(1);
}

let catalog;
try {
  catalog = JSON.parse(fs.readFileSync(CATALOG_FILE, "utf8"));
} catch (error) {
  console.error(`audit-rules: invalid catalog JSON (${error.message})`);
  process.exit(1);
}

const errors = validateRulesCatalog(catalog);
const files = walk();
for (const file of files) {
  try {
    errors.push(...findRuleIssues(file, fs.readFileSync(path.join(ROOT, file), "utf8"), catalog));
  } catch (error) {
    errors.push(`${file}: cannot audit rules (${error.message})`);
  }
}

if (errors.length > 0) {
  console.error(`audit-rules: ${errors.length} error(s):`);
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

console.log(
  `audit-rules OK — ${Object.keys(catalog.sources).length} sources, ${files.length} files.`
);
