#!/usr/bin/env bash

set -eu

if [ -z "${DEADLANDS_RULES_PATH:-}" ]; then
  echo "deadlands-rules-ref: DEADLANDS_RULES_PATH is not set" >&2
  exit 64
fi

if [ ! -d "$DEADLANDS_RULES_PATH" ]; then
  echo "deadlands-rules-ref: DEADLANDS_RULES_PATH is not a readable directory" >&2
  exit 66
fi

if ! command -v uv >/dev/null 2>&1; then
  echo "deadlands-rules-ref: uv is required to start the MCP server" >&2
  exit 69
fi

exec uv --directory "$DEADLANDS_RULES_PATH" run deadlands-rules-mcp
