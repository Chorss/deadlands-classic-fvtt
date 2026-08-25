# Private rules-reference MCP

`deadlands-rules-ref` is a private, local evidence service for contributors who
already hold a legal copy of its corpus. This public repository contains neither
PDFs nor extracts nor generated cache.

In the private clone, run `uv sync`, then export its location before starting Claude or Codex:

```bash
export DEADLANDS_RULES_PATH=/path/to/deadlands-rules-ref
```

The tracked Claude and Codex configurations both call `tools/deadlands-rules-mcp.sh`. The launcher
resolves the environment variable at runtime and exits with a clear setup error when it is missing;
no local path is persisted in shared configuration.

The shared MCP profile intentionally contains only this evidence launcher and the repository's
Playwright browser bridge. IDE servers and other localhost integrations belong in untracked
user-level configuration; never commit their ports or installation paths.

## Public metadata catalog

`rules/source-catalog.json` is the CI-safe index of the evidence corpus. It contains only a
schema version, the private repository revision, and each source's slug, physical page count,
and SHA-256. It contains no rulebook text, PDF data, extracts, cache, or local filesystem paths.

CI runs `npm run verify:rules` against this committed catalog, so citation validation never
disappears when the private repository is unavailable. Maintainers refresh the metadata locally:

```bash
DEADLANDS_RULES_PATH=/path/to/deadlands-rules-ref npm run rules:catalog
DEADLANDS_RULES_PATH=/path/to/deadlands-rules-ref npm run rules:catalog:check
```

Review the catalog diff before committing it. A changed source hash or revision records a corpus
update; it does not authorize copying any corpus content into this repository.

## Evidence workflow

Use `rules_search`, then the bounded `rules_read_pages`, then
`rules_validate_citations`. The server never answers a rules question or calls a
model; it supplies evidence. Cite `<slug> p.N` and paraphrase in the language of
the question. If the service is unavailable, use the existing
`DEADLANDS_RULES_PATH`, `rg`/`awk`, and
`$DEADLANDS_RULES_PATH/scripts/verify-pdf-extract.sh <slug>` fallback.
