#!/usr/bin/env bash
# Claude Code PostToolUse hook for Write|Edit.
# Reads the tool-call JSON on stdin, validates the touched file, and fails
# with a pointer to the offending file so Claude gets immediate feedback.

set -eu

FILE_PATH=$(node -e "
  let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>{
    try { const d=JSON.parse(s); process.stdout.write(d.tool_input?.file_path ?? ''); }
    catch { process.stdout.write(''); }
  });
")

[ -z "$FILE_PATH" ] && exit 0
[ -f "$FILE_PATH" ] || exit 0

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
REL="${FILE_PATH#${REPO_ROOT}/}"

fail() { echo "post-write: $1" >&2; exit 1; }

case "$REL" in
  *.mjs)
    node --check "$FILE_PATH" || fail "syntax error in $REL"
    ;;
  system.json | lang/*.json)
    node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" "$FILE_PATH" \
      || fail "invalid JSON in $REL"
    ( cd "$REPO_ROOT" && node tools/verify-documenttypes.mjs ) \
      || fail "verify-documenttypes failed after edit of $REL"
    ;;
  *.json)
    node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" "$FILE_PATH" \
      || fail "invalid JSON in $REL"
    ;;
esac

# Non-blocking reminder: game-mechanics files must be checked against the rulebook
# source (deadlands-rules-ref). Path-scoped `.claude/rules` don't fire on Write
# (Claude Code #23478), so nudge here — on save — via additionalContext.
case "$REL" in
  module/core/config.mjs|module/core/dice/*|module/core/chips/*|module/core/wounds/*|module/core/cards/*|module/archetypes/*/mechanics.mjs)
    node -e '
      const rel = process.argv[1];
      const msg = "Mechanics file saved: " + rel +
        ". Verify every rule/value against deadlands-rules-ref before trusting it — run the " +
        "verify-mechanic skill or the pdf-reference-lookup subagent and cite <slug> p.NNN. " +
        "The rulebook is the source of truth, not docs/mechanics-reference.md.";
      process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:msg}}));
    ' "$REL" 2>/dev/null || true
    ;;
esac

exit 0
