# Private rules-reference MCP

`deadlands-rules-ref` is a private, local evidence service for contributors who
already hold a legal copy of its corpus. This public repository contains neither
PDFs nor extracts nor generated cache.

In the private clone, run `uv sync`. Register the local stdio service with Codex:

```bash
codex mcp add --env DEADLANDS_RULES_PATH="/absolute/path/to/deadlands-rules-ref" deadlands-rules-ref -- uv --directory "/absolute/path/to/deadlands-rules-ref" run deadlands-rules-mcp
```

For Claude Code, add the equivalent private, uncommitted entry to its local
`.mcp.json`:

```json
{
  "mcpServers": {
    "deadlands-rules-ref": {
      "type": "stdio",
      "command": "uv",
      "args": ["--directory", "/absolute/path/to/deadlands-rules-ref", "run", "deadlands-rules-mcp"],
      "env": {"DEADLANDS_RULES_PATH": "/absolute/path/to/deadlands-rules-ref"}
    }
  }
}
```

Use `rules_search`, then the bounded `rules_read_pages`, then
`rules_validate_citations`. The server never answers a rules question or calls a
model; it supplies evidence. Cite `<slug> p.N` and paraphrase in the language of
the question. If the service is unavailable, use the existing
`DEADLANDS_RULES_PATH`, `rg`/`awk`, and `verify-pdf-extract.sh` fallback.
