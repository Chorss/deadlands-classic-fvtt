#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { catalogDigest, validateRulesCatalog } from "./rules-catalog-lib.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = path.join(ROOT, "rules/source-catalog.json");
const rulesRoot = process.env.DEADLANDS_RULES_PATH;

if (!rulesRoot) {
  console.error("generate-rules-catalog: DEADLANDS_RULES_PATH is required");
  process.exit(64);
}

const privateCatalog = JSON.parse(
  fs.readFileSync(path.join(rulesRoot, "index/catalog.json"), "utf8")
);
const sourceRevision = execFileSync("git", ["-C", rulesRoot, "rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const sources = Object.fromEntries(
  [...privateCatalog.books]
    .sort((left, right) => left.slug.localeCompare(right.slug))
    .map((book) => [book.slug, { pages: book.physicalPages, sha256: book.sourceSha256 }])
);
const generated = { schemaVersion: 1, sourceRevision, sources };
generated.catalogSha256 = catalogDigest(generated);

const issues = validateRulesCatalog(generated);
if (issues.length > 0) {
  console.error(`generate-rules-catalog: ${issues.join("; ")}`);
  process.exit(1);
}

const rendered = `${JSON.stringify(generated, null, 2)}\n`;
if (process.argv.includes("--check")) {
  const current = fs.existsSync(OUTPUT) ? fs.readFileSync(OUTPUT, "utf8") : "";
  if (current !== rendered) {
    console.error("generate-rules-catalog: committed catalog differs from the configured source");
    process.exit(1);
  }
  console.log("generate-rules-catalog OK — committed metadata matches private source.");
} else {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, rendered);
  console.log(`generate-rules-catalog: wrote ${Object.keys(sources).length} sources.`);
}
