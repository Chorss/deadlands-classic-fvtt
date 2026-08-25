#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  findBroadPermissionIssues,
  findLocalIdeMcpIssues,
  findPrivatePathIssues,
  findProjectMcpIssues,
  findReleaseManifestIssues,
  findReleaseVersionIssues,
  findSkillParityIssues,
  findTomlIssues,
  findUnpinnedActionIssues,
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

function checkRulesLauncher() {
  const launcher = path.join(ROOT, "tools/deadlands-rules-mcp.sh");
  const env = { ...process.env };
  delete env.DEADLANDS_RULES_PATH;
  const result = spawnSync("bash", [launcher], { encoding: "utf8", env });
  if (result.status !== 64 || !result.stderr.includes("DEADLANDS_RULES_PATH is not set")) {
    errors.push("deadlands-rules MCP launcher lacks the missing-environment diagnostic");
  }
}

function checkSharedRulesLauncher(mcp, codexText) {
  const expected = "./tools/deadlands-rules-mcp.sh";
  if (mcp.mcpServers?.["deadlands-rules-ref"]?.command !== expected) {
    errors.push(".mcp.json: deadlands-rules-ref does not use the portable launcher");
  }
  if (!codexText.includes("[mcp_servers.deadlands-rules-ref]") || !codexText.includes(expected)) {
    errors.push(".codex/config.toml: deadlands-rules-ref does not use the portable launcher");
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
const codexConfig = read(".codex/config.toml");
const releaseVersions = [
  ["system.json", parseJson("system.json")],
  ["package.json", packageJson],
  ["package-lock.json", parseJson("package-lock.json")],
  ["content/module.json", parseJson("content/module.json")],
].map(([file, manifest]) => ({ file, version: manifest.version }));
errors.push(...findTomlIssues(codexConfig).map((issue) => `.codex/config.toml: ${issue}`));
errors.push(...findBroadPermissionIssues(settings));
errors.push(...findLocalIdeMcpIssues(mcp));
errors.push(...findProjectMcpIssues(mcp));
errors.push(...findReleaseVersionIssues(releaseVersions));
errors.push(
  ...findUnpinnedActionIssues(
    filesBelow(".github/workflows", (file) => file.endsWith(".yml")).map((file) => [
      file,
      read(file),
    ])
  )
);
checkShellFiles();
checkRulesLauncher();
checkSharedRulesLauncher(mcp, codexConfig);
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
