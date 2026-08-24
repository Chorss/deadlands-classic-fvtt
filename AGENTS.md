# Rulebook evidence

For any Deadlands mechanic, number, table, or page citation, prefer the local
`deadlands-rules-ref` MCP server when it is registered. Its tools are evidence
only: search first, read only the returned short page range, and validate the
final citations. Paraphrase the result and cite `<slug> p.N`; never copy book
prose into this public repository.

If MCP is not available, use `$DEADLANDS_RULES_PATH`, `rg`/`awk`, and
`scripts/verify-pdf-extract.sh` as the established fallback. The workflow is:
question → source/pages → comparison → implementation → test. Private extracts,
SQLite cache, PDFs, and absolute local paths must never be committed here.

See [docs/rules-reference-mcp.md](docs/rules-reference-mcp.md) for collaborator setup.
