#!/usr/bin/env node

import { findPrBodyIssues } from "./pr-body-lib.mjs";

const issues = findPrBodyIssues(process.env.PR_BODY ?? "");
if (issues.length > 0) {
  console.error(`PR readiness failed with ${issues.length} error(s):`);
  for (const issue of issues) {
    console.error(`  - ${issue}`);
  }
  process.exit(1);
}

console.log("PR readiness OK — required impact, evidence, verification, and untested fields set.");
