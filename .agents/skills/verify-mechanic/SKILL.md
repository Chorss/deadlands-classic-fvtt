---
name: verify-mechanic
description: Verify a Deadlands mechanic, value, table, or content-pack effect against authoritative rulebook evidence before implementation.
---

# Verify a mechanic

1. State the exact behavior or value to verify.
2. Prefer the registered `deadlands-rules-ref` MCP: search, read only the returned short page
   range, then validate the selected citation.
3. If MCP is unavailable, require `DEADLANDS_RULES_PATH`, run
   `$DEADLANDS_RULES_PATH/scripts/verify-pdf-extract.sh <slug>`, and use `rg`/`awk` against that
   private repository. Stop if the path or quality check is unavailable.
4. Compare evidence with the proposed behavior. On mismatch, stop and fix the proposal; the
   rulebook wins over memory and repository summaries.
5. Paraphrase in code/docs and cite `<slug> p.N`. Never paste rulebook prose or commit private
   paths, extracts, PDFs, or caches.

Return one line per check: `<mechanic> — <slug> p.N — MATCH/MISMATCH — <paraphrase>`.
