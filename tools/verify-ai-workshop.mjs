#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  findBroadPermissionIssues,
  findLocalIdeMcpIssues,
  findPrivatePathIssues,
  findReleaseManifestIssues,
  findSkillParityIssues,
  findTomlIssues,
  findWorkflowReferenceIssues,
} from "./verify-ai-workshop-lib.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), "utf8");
}

function parseJson(relative) {
  try {
    return JSON.parse(read(relative));
  } catch (error) {
    errors.push(`${relative}: invalid JSON (${error.message})`);
    return {};
  }
}

function filesBelow(relative, predicate) {
  const base = path.join(ROOT, relative);
  const files = [];
  if (!fs.existsSync(base)) {
    return files;
  }
  for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) {
      files.push(...filesBelow(child, predicate));
    } else if (predicate(child)) {
      files.push(child);
    }
  }
  return files;
}

function checkShellFiles() {
  const shellFiles = [
    ...filesBelow(".claude/hooks", (file) => file.endsWith(".sh")),
    ...filesBelow(".githooks", (file) => !path.basename(file).includes(".")),
    "tools/deadlands-rules-mcp.sh",
  ];
  for (const file of shellFiles) {
    const result = spawnSync("bash", ["-n", path.join(ROOT, file)], { encoding: "utf8" });
    if (result.error || result.status !== 0) {
      errors.push(`${file}: invalid shell (${result.stderr || result.error?.message})`);
    }
  }
}

function checkPrivatePaths() {
  const files = [
    "AGENTS.md",
    "CLAUDE.md",
    ".mcp.json",
    ".codex/config.toml",
    ...filesBelow(".agents", (file) => file.endsWith(".md")),
    ...filesBelow(".claude", (file) => file !== ".claude/settings.local.json"),
    ...filesBelow("docs", (file) => file.endsWith(".md") && !file.endsWith(".pl.md")),
  ];
  for (const file of files) {
    errors.push(...findPrivatePathIssues(file, read(file)));
  }
}

function checkSkillsAndWorkflows(packageJson) {
  errors.push(
    ...findSkillParityIssues(path.join(ROOT, ".agents/skills"), path.join(ROOT, ".claude/skills"))
  );
  const skillFiles = filesBelow(".agents/skills", (file) => file.endsWith("SKILL.md"));
  const skillTexts = skillFiles.map((file) => [file, read(file)]);
  errors.push(...findWorkflowReferenceIssues(skillTexts, packageJson.scripts ?? {}));
  errors.push(
    ...findReleaseManifestIssues(
      read(".agents/skills/release/SKILL.md"),
      read(".github/workflows/release.yml")
    )
  );
}

const settings = parseJson(".claude/settings.json");
const mcp = parseJson(".mcp.json");
const packageJson = parseJson("package.json");
errors.push(
  ...findTomlIssues(read(".codex/config.toml")).map((issue) => `.codex/config.toml: ${issue}`)
);
errors.push(...findBroadPermissionIssues(settings));
errors.push(...findLocalIdeMcpIssues(mcp));
checkShellFiles();
checkPrivatePaths();
checkSkillsAndWorkflows(packageJson);

if (errors.length > 0) {
  console.error(`verify-ai: ${errors.length} error(s):`);
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

console.log("verify-ai OK — config, hooks, skills, MCP, permissions, and release workflow valid.");
