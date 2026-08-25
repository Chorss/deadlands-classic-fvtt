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

Use `rules_search`, then the bounded `rules_read_pages`, then
`rules_validate_citations`. The server never answers a rules question or calls a
model; it supplies evidence. Cite `<slug> p.N` and paraphrase in the language of
the question. If the service is unavailable, use the existing
`DEADLANDS_RULES_PATH`, `rg`/`awk`, and
`$DEADLANDS_RULES_PATH/scripts/verify-pdf-extract.sh <slug>` fallback.
