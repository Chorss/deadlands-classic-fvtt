#!/usr/bin/env bash
# Stop hook — last-resort verification gate before Claude ends its turn.
#
# PostToolUse on Write|Edit does not fire when a Bash command rewrites a file
# (sed -i, a heredoc, an output redirection), so files written that way skip
# every syntax and parity check. This hook is the only thing that catches them.
#
# stdin  → hook JSON (stop_hook_active tells us we already blocked once)
# stdout → {"decision":"block","reason":...} keeps the turn going with a reason

set -eu

INPUT=$(cat)

# Loop guard: if we already blocked and Claude is stopping again, let it stop.
# Claude Code also force-ends the turn after 8 consecutive blocks, but bailing
# out on the first re-entry keeps the failure legible.
ACTIVE=$(node -e "
  let s='';
  process.stdin.on('data', c => s += c);
  process.stdin.on('end', () => {
    try { process.stdout.write(String(JSON.parse(s).stop_hook_active === true)); }
    catch { process.stdout.write('false'); }
  });
" <<< "$INPUT")

[[ "$ACTIVE" == "true" ]] && exit 0

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO"

# Nothing was changed — nothing to verify.
[[ -z "$(git status --porcelain 2>/dev/null)" ]] && exit 0

set +e
OUTPUT=$(npm run verify:all 2>&1)
GATE=$?
set -e

[[ $GATE -eq 0 ]] && exit 0

TAIL=$(echo "$OUTPUT" | tail -15)

REASON="$TAIL" node -e '
  const tail = process.env.REASON;
  process.stdout.write(JSON.stringify({
    decision: "block",
    reason:
      "npm run verify:all failed — the working tree is not green, so the turn " +
      "cannot end yet. Last 15 lines:\n\n" + tail +
      "\n\nFix the cause and re-run `npm run verify:all`. Do not narrow the " +
      "command to make it pass."
  }));
'

exit 0
