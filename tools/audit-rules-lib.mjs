import path from "node:path";
import { findCitationIssues } from "./audit-docs-lib.mjs";
import { catalogPageMap } from "./rules-catalog-lib.mjs";

const CITE_RE = /`?\b[a-z][a-z0-9-]{1,40}`?\s+p\.\d{1,4}/;
const MECHANIC_TYPES = new Set([
  "ammo",
  "armor",
  "edge",
  "favor",
  "gear",
  "gizmo",
  "hex",
  "hindrance",
  "miracle",
  "weapon",
]);

export function findRuleIssues(file, text, catalog) {
  const issues = [];
  const pages = catalogPageMap(catalog);
  text.split("\n").forEach((line, index) => {
    for (const issue of findCitationIssues(line, pages)) {
      if (issue.type === "unknown-slug") {
        issues.push(`${file}:${index + 1}: unknown rulebook slug ${issue.slug}`);
      } else {
        issues.push(
          `${file}:${index + 1}: ${issue.slug} p.${issue.page} exceeds ${issue.pages} pages`
        );
      }
    }
  });

  if (file.startsWith("content/_source/") && file.endsWith(".json")) {
    const parsed = JSON.parse(text);
    const mechanicFile = MECHANIC_TYPES.has(parsed.type) || file.includes("/hit-location/");
    if (mechanicFile && !CITE_RE.test(text)) {
      issues.push(`${file}: mechanic JSON has no <slug> p.N citation`);
    }
  }
  return issues;
}

export function isRuleAuditFile(file) {
  const extension = path.extname(file);
  if (extension === ".md") {
    return !file.endsWith(".pl.md");
  }
  if (extension === ".mjs") {
    const citationFixture = /tests\/audit-(?:docs|rules)\.test\.mjs$/.test(file);
    return !citationFixture && (file.startsWith("module/") || file.startsWith("tests/"));
  }
  if (extension === ".json") {
    return file.startsWith("content/_source/") || file.startsWith("packs/_source/");
  }
  return false;
}
