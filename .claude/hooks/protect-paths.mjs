#!/usr/bin/env node

import path from "node:path";

export const PROTECTED_PATHS = [
  ".git",
  ".agents",
  ".codex",
  "vendor",
  "books",
  ".pdf-extract",
  "LICENSE",
];

const MUTATING_GIT_RE =
  /(?:^|[;&|]\s*)git(?:\s+-\S+)*\s+(?:add|am|apply|bisect|branch\s+(?:-[dDmM]|--delete|--move)|checkout|cherry-pick|clean|commit|config|fetch|gc|merge|mv|pull|push|rebase|reset|restore|revert|rm|stash|switch|tag|worktree\s+(?:add|move|remove|prune))/;
const MUTATING_COMMAND_RE =
  /(?:^|[;&|]\s*)(?:sudo\s+)?(?:chmod|chown|cp|install|ln|mkdir|mv|node|npm|perl|python3?|rm|rmdir|sed|tee|truncate|touch)\b|(?:^|[^<])>{1,2}(?!>)/;

function normalizeCandidate(candidate, cwd) {
  if (!candidate) return "";
  return path.resolve(cwd, candidate);
}

export function isProtectedFile(candidate, cwd = process.cwd()) {
  const absolute = normalizeCandidate(candidate, cwd);
  return PROTECTED_PATHS.some((entry) => {
    const protectedPath = path.resolve(cwd, entry);
    return absolute === protectedPath || absolute.startsWith(`${protectedPath}${path.sep}`);
  });
}

function namesProtectedPath(command, cwd) {
  return PROTECTED_PATHS.some((entry) => {
    const absolute = path.resolve(cwd, entry);
    const escaped = entry.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const relativePattern = new RegExp(`(^|[\\s'\"=;|&()])(?:\\./)?${escaped}(?:/|[\\s'\";|&)]|$)`);
    return command.includes(absolute) || relativePattern.test(command);
  });
}

export function bashMayWriteProtectedPath(command, cwd = process.cwd()) {
  if (MUTATING_GIT_RE.test(command)) return true;
  return namesProtectedPath(command, cwd) && MUTATING_COMMAND_RE.test(command);
}

export function deniedReason(input, cwd = process.cwd()) {
  const tool = input.tool_name;
  if (tool === "Write" || tool === "Edit") {
    const candidate = input.tool_input?.file_path;
    if (isProtectedFile(candidate, cwd)) {
      return `Protected path is read-only: ${candidate}`;
    }
  }
  if (tool === "Bash" && bashMayWriteProtectedPath(input.tool_input?.command ?? "", cwd)) {
    return "Command may write repository metadata or another protected path";
  }
  return null;
}

async function main() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;

  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    process.stderr.write("protect-paths: invalid hook JSON\n");
    process.exitCode = 2;
    return;
  }

  const reason = deniedReason(input, input.cwd || process.cwd());
  if (!reason) return;

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    })
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
