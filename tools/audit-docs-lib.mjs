/**
 * Pure helpers for audit-docs.mjs. Kept free of filesystem and process access so
 * the gate's parsing rules can be covered by node:test.
 *
 * @license MIT
 */

// A rulebook citation: `slug` p.NNN, `slug p.NNN`, or slug p.NNN.
// Unknown bare words are ignored because ordinary prose such as "levels p.139"
// is not citation-shaped unless the alleged slug is explicitly backticked.
const CITE_RE =
  /(?:(`)([a-z][a-z0-9-]{1,24})`?\s+p\.(\d{1,4})(?:-(\d{1,4}))?`?|\b([a-z][a-z0-9-]{1,24})\s+p\.(\d{1,4})(?:-(\d{1,4}))?)/g;

/**
 * Validate every citation-shaped token in one line.
 *
 * Prose page references must use the word "page". The compact `slug p.N` form
 * is reserved for rulebook citations, which lets a typo such as `dcl p.29`
 * fail deterministically instead of being mistaken for prose.
 *
 * @param {string} line
 * @param {Map<string, number>} catalog slug -> physical page count
 * @returns {Array<
 *   | {type: "unknown-slug", slug: string}
 *   | {type: "out-of-range", slug: string, page: number, pages: number}
 * >}
 */
export function findCitationIssues(line, catalog) {
  const issues = [];
  for (const match of line.matchAll(CITE_RE)) {
    const [, quoted, quotedSlug, quotedFrom, quotedTo, bareSlug, bareFrom, bareTo] = match;
    const slug = quotedSlug ?? bareSlug;
    const from = quotedFrom ?? bareFrom;
    const to = quotedTo ?? bareTo;
    const pages = catalog.get(slug);
    if (pages === undefined) {
      if (quoted) {
        issues.push({ type: "unknown-slug", slug });
      }
      continue;
    }
    for (const page of [from, to].filter(Boolean).map(Number)) {
      if (page < 1 || page > pages) {
        issues.push({ type: "out-of-range", slug, page, pages });
      }
    }
  }
  return issues;
}

/**
 * Return only CLAUDE.md's Sources of truth table, not incidental references to
 * docs elsewhere in the file.
 *
 * @param {string} markdown
 * @returns {{line: number, text: string}}
 */
export function extractSourcesOfTruthTable(markdown) {
  const lines = markdown.split("\n");
  const heading = lines.findIndex((line) => /^## Sources of truth\s*$/.test(line));
  if (heading < 0) {
    return { line: 1, text: "" };
  }

  const sectionEnd = lines.findIndex((line, index) => index > heading && /^##\s+/.test(line));
  const boundary = sectionEnd < 0 ? lines.length : sectionEnd;
  const header = lines.findIndex(
    (line, index) => index > heading && index < boundary && line.includes("| Topic | Location |")
  );
  if (header < 0) {
    return { line: heading + 1, text: "" };
  }

  let end = header;
  while (end < lines.length && lines[end].trimStart().startsWith("|")) {
    end += 1;
  }
  return { line: header + 1, text: lines.slice(header, end).join("\n") };
}
