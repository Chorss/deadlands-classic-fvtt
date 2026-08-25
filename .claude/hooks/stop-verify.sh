#!/usr/bin/env bash
# Stop hook — run the canonical gate whenever the working tree is dirty.
# A repeated Stop event re-runs the gate; it never converts a red result to success.

set -eu

INPUT=$(cat)
ACTIVE=$(node -e '
  let input = "";
  process.stdin.on("data", (chunk) => (input += chunk));
  process.stdin.on("end", () => {
    try {
      process.stdout.write(String(JSON.parse(input).stop_hook_active === true));
    } catch {
      process.stdout.write("false");
    }
  });
' <<< "$INPUT")

REPO=$(cd "$(dirname "$0")/../.." && pwd)
cd "$REPO"

if [ -z "$(git status --porcelain 2>/dev/null)" ]; then
  exit 0
fi

set +e
OUTPUT=$(npm run verify:ci 2>&1)
GATE=$?
set -e

if [ "$GATE" -eq 0 ]; then
  exit 0
fi

TAIL=$(printf '%s\n' "$OUTPUT" | tail -20)
REASON="$TAIL" ACTIVE="$ACTIVE" node -e '
  const retry = process.env.ACTIVE === "true";
  const prefix = retry
    ? "Repeated Stop verification is still red."
    : "npm run verify:ci failed; the working tree is not green.";
  process.stdout.write(JSON.stringify({
    decision: "block",
    reason:
      prefix + " Last 20 lines:\n\n" + process.env.REASON +
      "\n\nFix the cause and let Stop run `npm run verify:ci` again. " +
      "Do not narrow or bypass the command.",
  }));
'

exit 0
