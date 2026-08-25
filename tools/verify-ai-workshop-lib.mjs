import fs from "node:fs";
import path from "node:path";

export const REQUIRED_SKILLS = [
  "add-archetype",
  "release",
  "verify-foundry",
  "verify-mechanic",
  "verify-system",
];

export const RELEASE_MANIFESTS = [
  "system.json",
  "package.json",
  "package-lock.json",
  "content/module.json",
];
export const PROJECT_MCP_SERVERS = ["deadlands-rules-ref", "playwright"];

const PRIVATE_PATH_RE =
  /(?:\/home\/[A-Za-z0-9._-]+\/|\/Users\/[A-Za-z0-9._-]+\/|[A-Za-z]:\\Users\\[^\\]+\\)/g;
const FORBIDDEN_BASH_RULES = [
  /^Bash\(node:\*\)$/,
  /^Bash\(npm install(?::|\s).*\)$/,
  /^Bash\((?:python3?|pip3?)(?::|\s|\*)/,
];

function stripTomlComment(line) {
  let quote = null;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if ((char === '"' || char === "'") && line[index - 1] !== "\\") {
      quote = quote === char ? null : quote || char;
    } else if (char === "#" && !quote) {
      return line.slice(0, index);
    }
  }
  return line;
}

function balancedDelimiter(text, open, close) {
  let depth = 0;
  for (const char of text) {
    if (char === open) {
      depth += 1;
    }
    if (char === close) {
      depth -= 1;
    }
    if (depth < 0) {
      return false;
    }
  }
  return depth === 0;
}

function balancedTomlValue(value) {
  const withoutStrings = value.replace(/"(?:\\.|[^"\\])*"/g, "").replace(/'[^']*'/g, "");
  const hasUnclosedQuote = withoutStrings.includes('"') || withoutStrings.includes("'");
  return (
    !hasUnclosedQuote &&
    balancedDelimiter(withoutStrings, "[", "]") &&
    balancedDelimiter(withoutStrings, "{", "}")
  );
}

export function findTomlIssues(text) {
  const issues = [];
  text.split("\n").forEach((raw, index) => {
    const line = stripTomlComment(raw).trim();
    if (!line) {
      return;
    }
    const section = line.match(/^\[([^\]]+)\]$/);
    if (section) {
      if (!/^[A-Za-z0-9_.-]+$/.test(section[1])) {
        issues.push(`line ${index + 1}: invalid section`);
      }
      return;
    }
    const assignment = line.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/);
    if (!assignment || !balancedTomlValue(assignment[2])) {
      issues.push(`line ${index + 1}: invalid assignment`);
    }
  });
  return issues;
}

export function findPrivatePathIssues(file, text) {
  return [...text.matchAll(PRIVATE_PATH_RE)].map(
    (match) => `${file}: private absolute path ${match[0]}`
  );
}

export function findBroadPermissionIssues(settings) {
  const rules = [...(settings.permissions?.allow ?? []), ...(settings.permissions?.ask ?? [])];
  return rules
    .filter((rule) => FORBIDDEN_BASH_RULES.some((pattern) => pattern.test(rule)))
    .map((rule) => `broad shell permission: ${rule}`);
}

export function skillNames(root) {
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter(
      (entry) => entry.isDirectory() && fs.existsSync(path.join(root, entry.name, "SKILL.md"))
    )
    .map((entry) => entry.name)
    .sort();
}

export function findSkillParityIssues(sharedRoot, claudeRoot) {
  const expected = [...REQUIRED_SKILLS].sort();
  const issues = [];
  for (const [label, names] of [
    ["shared", skillNames(sharedRoot)],
    ["Claude", skillNames(claudeRoot)],
  ]) {
    if (JSON.stringify(names) !== JSON.stringify(expected)) {
      issues.push(`${label} skills: expected ${expected.join(", ")}; found ${names.join(", ")}`);
    }
  }
  for (const name of expected) {
    const adapter = fs.readFileSync(path.join(claudeRoot, name, "SKILL.md"), "utf8");
    if (!adapter.includes(`.agents/skills/${name}/SKILL.md`)) {
      issues.push(`Claude skill ${name} does not reference the shared procedure`);
    }
  }
  return issues;
}

export function findWorkflowReferenceIssues(texts, scripts) {
  const issues = [];
  for (const [file, text] of texts) {
    for (const match of text.matchAll(/npm run ([A-Za-z0-9:_-]+)/g)) {
      if (!scripts[match[1]]) {
        issues.push(`${file}: npm workflow does not exist: ${match[1]}`);
      }
    }
  }
  return issues;
}

export function findReleaseManifestIssues(skillText, workflowText) {
  const issues = [];
  for (const manifest of RELEASE_MANIFESTS) {
    if (!skillText.includes(manifest)) {
      issues.push(`release skill omits ${manifest}`);
    }
    if (!workflowText.includes(manifest)) {
      issues.push(`release workflow omits ${manifest}`);
    }
  }
  return issues;
}

export function findLocalIdeMcpIssues(mcp) {
  const issues = [];
  for (const [name, server] of Object.entries(mcp.mcpServers ?? {})) {
    const localUrl =
      typeof server.url === "string" &&
      /https?:\/\/(?:127\.0\.0\.1|localhost):\d+/i.test(server.url);
    if (localUrl || /phpstorm|idea|ide/i.test(name)) {
      issues.push(`shared local IDE MCP: ${name}`);
    }
  }
  return issues;
}

export function findProjectMcpIssues(mcp) {
  const actual = Object.keys(mcp.mcpServers ?? {}).sort();
  const expected = [...PROJECT_MCP_SERVERS].sort();
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    return [];
  }
  return [`project MCP servers: expected ${expected.join(", ")}; found ${actual.join(", ")}`];
}

export function findUnpinnedActionIssues(workflows) {
  const issues = [];
  for (const [file, text] of workflows) {
    for (const match of text.matchAll(/uses:\s*([^\s#]+)@([^\s#]+)/g)) {
      if (!/^[0-9a-f]{40}$/.test(match[2])) {
        issues.push(`${file}: action is not pinned to a full SHA: ${match[1]}@${match[2]}`);
      }
    }
  }
  return issues;
}
