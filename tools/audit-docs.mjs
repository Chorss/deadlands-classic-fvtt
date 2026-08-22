#!/usr/bin/env node
/**
 * audit-docs.mjs — documentation integrity check.
 *
 * Four checks over the Markdown that ships in git. All of them are static: this
 * tool reads text, it does not judge whether a sentence is still true. Prose
 * drift is a review problem; what is mechanised here is the subset a script can
 * decide.
 *
 * ERRORS (exit 1)
 *   1. A tracked file points at a **gitignored file** as if a reader could open
 *      it. This is the concrete bug the tool exists for: docs/*.pl.md are
 *      gitignored, yet the plan linked to one and the /new-phase skill ran awk
 *      over another, so both were dead after a fresh clone. Only paths that name
 *      a file (i.e. carry an extension) count — CLAUDE.md deliberately discusses
 *      the ignored `vendor/`, `books/` and `.pdf-extract/` directories, and
 *      saying "do not touch this" is not a broken pointer. IGNORED_OK holds the
 *      handful of ignored files that are named on purpose.
 *   2. A relative Markdown link in docs/, README.md or CONTRIBUTING.md whose
 *      target does not exist on disk.
 *   3. A `<slug> p.NNN` rulebook citation whose slug is absent from the
 *      deadlands-rules-ref catalog, or whose page is past the end of that book.
 *      **Skipped entirely when $DEADLANDS_RULES_PATH is unset** — CI and a fresh
 *      clone do not have the private rules repo, and this degrades rather than
 *      failing, the same way audit-css treats module/ more leniently than
 *      templates/.
 *
 * WARNINGS (never affect the exit code)
 *   4. A `docs/*.md` file missing from CLAUDE.md's "Sources of truth" table.
 *      Deliberately not an error: CLAUDE.md is outside the editable surface, so
 *      a hard failure here would leave verify:all permanently red — and the Stop
 *      hook runs verify:all on every dirty tree, which would block every turn.
 *      Promote to an error once that table is corrected.
 *   5. A backticked path that does not exist. Warning-only because
 *      implementation-plan.md deliberately names things that do not exist yet
 *      (docs/claude-workflow.md, module/core/migration.mjs) — a decision recorded
 *      in commit 745320f. ASPIRATIONAL_OK holds those.
 *
 * EN/PL parity is deliberately not checked: repo docs are English, the only
 * Polish file is a natively-Polish note with no English counterpart, and CI
 * never sees a .pl.md at all.
 *
 * Exit 0 — no errors (warnings may still be printed).
 * Exit 1 — at least one error.
 *
 * Used by: `npm run verify:all` — hence CI (`.github/workflows/ci.yml`) and the
 *   Stop hook (`.claude/hooks/stop-verify.sh`), which runs `verify:all` before a
 *   turn ends with a dirty tree. Not in `.githooks/pre-commit`: that hook runs
 *   individual tools gated on the extensions in the staged diff, and no Markdown
 *   gate is wired there.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Gitignored files a tracked document names on purpose. Each is a file a reader
 * is told to *create* or *configure*, not one they are told to open.
 */
const IGNORED_OK = new Set([
  // Told to create it, not to open it (CLAUDE.md, CONTRIBUTING.md).
  ".claude/settings.local.json",
  // The documented fallback when $DEADLANDS_RULES_PATH is unset — local by design.
  ".pdf-extract/dlc/full.txt",
  // The release artifact CI builds; local builds are deliberately untracked.
  "deadlands-classic.zip",
]);

/**
 * Paths that documentation names aspirationally — planned, not present. Keeping
 * them listed here is the disclosure: an unexplained missing path stays a
 * warning, these do not warn at all.
 */
const ASPIRATIONAL_OK = new Set([
  "docs/claude-workflow.md",
  "module/core/migration.mjs",
  "module/ui/",
  "packs/aptitudes/",
]);

const errors = [];
const warnings = [];

function err(file, line, msg) {
  errors.push(`${file}:${line} — ${msg}`);
}

function warn(file, line, msg) {
  warnings.push(`${file}:${line} — ${msg}`);
}

/** Every Markdown file tracked by git. */
function trackedMarkdown() {
  const out = execFileSync("git", ["ls-files", "-z", "*.md"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return out.split("\0").filter(Boolean);
}

/**
 * Batch `git check-ignore` over candidate paths.
 * @param {string[]} candidates
 * @returns {Set<string>} the subset git considers ignored
 */
function gitIgnored(candidates) {
  if (candidates.length === 0) {
    return new Set();
  }
  try {
    const out = execFileSync("git", ["check-ignore", "--stdin"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      input: candidates.join("\n"),
    });
    return new Set(out.split("\n").filter(Boolean));
  } catch (e) {
    // git exits 1 when nothing matched — that is a valid answer, not a failure.
    if (e.status === 1) {
      return new Set(
        String(e.stdout ?? "")
          .split("\n")
          .filter(Boolean)
      );
    }
    throw e;
  }
}

// A Markdown link with a relative target: [text](path) — skips URLs and anchors.
const LINK_RE = /\[[^\]]*\]\((?!https?:|mailto:|#)([^)\s]+)\)/g;
// A backticked token that looks like a repo path: has a slash or a file extension.
const BACKTICK_PATH_RE =
  /`([A-Za-z0-9_./-]+\.[A-Za-z0-9]{1,5}|[A-Za-z0-9_.-]+\/[A-Za-z0-9_./-]*)`/g;
// A sentence asserting that something is absent. Naming a path in order to say
// it does not exist is the opposite of a broken pointer, so check 5 stays quiet.
const NEGATED_RE =
  /\bthere is no\b|\bdoes not exist\b|\bno longer\b|\bwas removed\b|\bnever created\b/i;
// A rulebook citation: `slug p.NNN` or `slug p.NNN-MMM`, slug usually backticked.
const CITE_RE = /`?\b([a-z][a-z0-9-]{1,24})`?\s+p\.(\d{1,4})(?:-(\d{1,4}))?/g;

/** Top-level entries that actually exist, used to tell a repo path from prose. */
const ROOT_ENTRIES = new Set(fs.readdirSync(REPO_ROOT));

/**
 * Verbatim `.gitignore` patterns. Documentation quotes these constantly when
 * explaining what is ignored (`.claude/cache/`, `test-results/`); quoting a
 * pattern is not a claim that the path exists.
 */
const GITIGNORE_PATTERNS = new Set(
  fs
    .readFileSync(path.join(REPO_ROOT, ".gitignore"), "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
);

/** A placeholder rather than a real path: tutorial stand-ins and glob patterns. */
const PLACEHOLDER_RE = /foo-bar|<|>|\{|\}|\*|NNN/;

/**
 * Does this token refer to a path *in this repository*?
 *
 * Backticks in these docs wrap plenty of slash-separated things that are not
 * repo paths at all: Biome rule ids (`style/useConst`), Foundry API names
 * (`deal/pass/draw`), git refs (`origin/main`), and paths inside Foundry's own
 * installation (`client/documents/user.mjs`). The discriminator that holds up is
 * the first segment: a genuine repo path starts at something that exists at the
 * repo root. That also keeps `git check-ignore` from being handed a path outside
 * the repo, which it treats as fatal rather than as a miss.
 */
function isRepoPath(p) {
  if (p.startsWith("/") || p.startsWith("~") || p.startsWith("http")) {
    return false;
  }
  if (PLACEHOLDER_RE.test(p)) {
    return false;
  }
  const normalized = path.normalize(p);
  if (normalized.startsWith("..")) {
    return false;
  }
  return ROOT_ENTRIES.has(normalized.split("/")[0]);
}

/** Strip fenced code blocks, which are samples rather than claims about the repo. */
function withoutFences(lines) {
  let inFence = false;
  return lines.map((line) => {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      return "";
    }
    return inFence ? "" : line;
  });
}

// ── Load the rulebook catalog, if it is reachable ────────────────────────────

/** @returns {Map<string, number>|null} slug → physical page count, or null when unavailable */
function loadCatalog() {
  const root = process.env.DEADLANDS_RULES_PATH;
  if (!root) {
    return null;
  }
  const file = path.join(root, "index", "catalog.json");
  if (!fs.existsSync(file)) {
    return null;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return new Map(parsed.books.map((b) => [b.slug, b.physicalPages]));
  } catch {
    return null;
  }
}

const catalog = loadCatalog();

// ── Per-line checks, one concern each ───────────────────────────────────────

/** Check 2 — every relative Markdown link resolves to something on disk. */
function checkLinks(file, lineNo, line, dir) {
  for (const m of line.matchAll(LINK_RE)) {
    const target = m[1].split("#")[0];
    if (!target) {
      continue;
    }
    const resolved = path.normalize(path.join(dir, target));
    if (!fs.existsSync(path.join(REPO_ROOT, resolved))) {
      err(file, lineNo, `link target does not exist: ${target}`);
    }
  }
}

/** Every repo path this line refers to, whether linked or backticked. */
function collectReferences(line, dir) {
  const referenced = new Set();
  for (const m of line.matchAll(LINK_RE)) {
    const t = m[1].split("#")[0];
    if (t && !t.startsWith("/")) {
      referenced.add(path.normalize(path.join(dir, t)));
    }
  }
  for (const m of line.matchAll(BACKTICK_PATH_RE)) {
    referenced.add(m[1]);
  }
  return referenced;
}

/** Check 5 — a referenced path that is not on disk, minus the known exemptions. */
function shouldWarnMissing(file, line, target) {
  if (file === "CHANGELOG.md" || NEGATED_RE.test(line)) {
    return false;
  }
  if (GITIGNORE_PATTERNS.has(target)) {
    return false;
  }
  return !fs.existsSync(path.join(REPO_ROOT, target));
}

/** Check 3 — rulebook citations point at a real book and a page inside it. */
function checkCitations(file, lineNo, line) {
  if (!catalog) {
    return;
  }
  for (const m of line.matchAll(CITE_RE)) {
    const [, slug, from, to] = m;
    // Only slugs the catalog knows are treated as citation attempts. An unknown
    // word before "p." is far more likely to be prose than a mis-cite.
    const pages = catalog.get(slug);
    if (pages === undefined) {
      continue;
    }
    for (const page of [from, to].filter(Boolean).map(Number)) {
      if (page < 1 || page > pages) {
        err(
          file,
          lineNo,
          `citation out of range: \`${slug} p.${page}\` — ${slug} has ${pages} pages`
        );
      }
    }
  }
}

// ── Walk the tracked Markdown ────────────────────────────────────────────────

const files = trackedMarkdown();
/** @type {Array<{file: string, line: number, target: string}>} */
const ignoredCandidates = [];

for (const file of files) {
  const raw = fs.readFileSync(path.join(REPO_ROOT, file), "utf8").split("\n");
  const lines = withoutFences(raw);
  const dir = path.dirname(file);
  const linksChecked = /^(docs\/|README\.md|CONTRIBUTING\.md)/.test(file);

  lines.forEach((line, i) => {
    const lineNo = i + 1;

    if (linksChecked) {
      checkLinks(file, lineNo, line, dir);
    }
    checkCitations(file, lineNo, line);

    for (const target of collectReferences(line, dir)) {
      if (ASPIRATIONAL_OK.has(target) || IGNORED_OK.has(target) || !isRepoPath(target)) {
        continue;
      }
      // Only a path naming a file can be a broken pointer; a directory mentioned
      // in prose ("never modify vendor/") is a prohibition, not a link.
      if (/\.[A-Za-z0-9]{1,5}$/.test(target)) {
        ignoredCandidates.push({ file, line: lineNo, target });
      }
      if (shouldWarnMissing(file, line, target)) {
        warn(file, lineNo, `path does not exist: ${target}`);
      }
    }
  });
}

// ── Check 1: which of the referenced files are gitignored? ───────────────────

const ignoredSet = gitIgnored([...new Set(ignoredCandidates.map((c) => c.target))]);
for (const { file, line, target } of ignoredCandidates) {
  if (ignoredSet.has(target)) {
    err(file, line, `references a gitignored file: ${target} (absent after a fresh clone)`);
  }
}

// ── Check 4: CLAUDE.md's "Sources of truth" table covers every doc ───────────

const claudeMd = path.join(REPO_ROOT, "CLAUDE.md");
if (fs.existsSync(claudeMd)) {
  const text = fs.readFileSync(claudeMd, "utf8");
  const tableLine = text.split("\n").findIndex((l) => l.includes("| Topic | Location |")) + 1;
  const docs = fs
    .readdirSync(path.join(REPO_ROOT, "docs"))
    .filter((f) => f.endsWith(".md") && !f.endsWith(".pl.md"));
  for (const doc of docs) {
    if (!text.includes(`docs/${doc}`) && !text.includes(`\`${doc}\``)) {
      warn(
        "CLAUDE.md",
        tableLine,
        `docs/${doc} is not in the Sources of truth table (warning by design — CLAUDE.md is outside the editable surface)`
      );
    }
  }
}

// ── Report ───────────────────────────────────────────────────────────────────

if (!catalog) {
  console.log(
    "audit-docs: DEADLANDS_RULES_PATH unset or unreadable — skipping rulebook citation checks."
  );
}

if (warnings.length > 0) {
  console.log(`\naudit-docs: ${warnings.length} warning(s):`);
  for (const w of warnings) {
    console.log(`  ⚠ ${w}`);
  }
}

if (errors.length > 0) {
  console.error(`\naudit-docs: ${errors.length} error(s):`);
  for (const e of errors) {
    console.error(`  ✗ ${e}`);
  }
  process.exit(1);
}

console.log(`\naudit-docs: OK — ${files.length} tracked Markdown files checked.`);
