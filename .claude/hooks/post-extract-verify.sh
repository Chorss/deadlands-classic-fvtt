#!/usr/bin/env bash
# PostToolUse hook — quality gate after extract-pdf.sh calls.
#
# Claude Code passes tool-call JSON on stdin.
# stdout → JSON injected into Claude's context (additionalContext or decision:block)
# stderr → shown to user in terminal
#
# Fires on every Bash tool call; exits early if the command is not extract-pdf.sh.

set -eu

INPUT=$(cat)

# Parse tool name
TOOL=$(node -e "
  let s='';
  process.stdin.on('data', c => s += c);
  process.stdin.on('end', () => {
    try { process.stdout.write(JSON.parse(s).tool_name ?? ''); } catch {}
  });
" <<< "$INPUT")

[[ "$TOOL" == "Bash" ]] || exit 0

# Parse bash command
COMMAND=$(node -e "
  let s='';
  process.stdin.on('data', c => s += c);
  process.stdin.on('end', () => {
    try { process.stdout.write(JSON.parse(s).tool_input?.command ?? ''); } catch {}
  });
" <<< "$INPUT")

# Only trigger when extract-pdf.sh is the actual command being invoked
# (not just mentioned in a string, heredoc, or commit message).
# Matches any path ending in extract-pdf.sh at the start of the command line.
echo "$COMMAND" | grep -qE '^[[:space:]]*[^[:space:]]*/extract-pdf\.sh[[:space:]]|^[[:space:]]*(./)?extract-pdf\.sh[[:space:]]' || exit 0

# Extract slug: the argument that follows the PDF path after extract-pdf.sh
# Expected command form: [<path>/]extract-pdf.sh <pdf-path> <slug>
SLUG=$(echo "$COMMAND" | sed -n 's|.*extract-pdf\.sh[[:space:]]\+[^[:space:]]\+[[:space:]]\+\([^[:space:]]\+\).*|\1|p')

if [[ -z "$SLUG" ]]; then
  echo "post-extract-verify: nie udało się wyodrębnić slug z: $COMMAND" >&2
  exit 0
fi

if [[ -z "${DEADLANDS_RULES_PATH:-}" ]]; then
  echo "post-extract-verify: DEADLANDS_RULES_PATH nie ustawiony — pomijam weryfikację" >&2
  exit 0
fi

VERIFY="$DEADLANDS_RULES_PATH/scripts/verify-pdf-extract.sh"

if [[ ! -x "$VERIFY" ]]; then
  echo "post-extract-verify: skrypt weryfikacji nie znaleziony: $VERIFY" >&2
  exit 0
fi

REPO="$(cd "$(dirname "$0")/../.." && pwd)"

# Run quality gate — stderr goes directly to user's terminal
set +e
(cd "$REPO" && "$VERIFY" "$SLUG")
GATE=$?
set -e

# Inject result into Claude's context via stdout JSON
case $GATE in
  0)
    node -e "
      console.log(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PostToolUse',
          additionalContext: 'Quality gate PASS dla slug \`$SLUG\` — ekstrakt wygląda poprawnie. Możesz kontynuować indeksowanie.'
        }
      }));
    "
    ;;
  1)
    node -e "
      console.log(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PostToolUse',
          additionalContext: 'Quality gate WARN dla slug \`$SLUG\` — ekstrakt nadaje się do użytku, ale są ostrzeżenia. Szczegóły widoczne w terminalu. Sprawdź ostrzeżenia z userem przed kontynuowaniem indeksowania.'
        }
      }));
    "
    ;;
  *)
    node -e "
      console.log(JSON.stringify({
        decision: 'block',
        reason: 'Quality gate FAIL dla slug \`$SLUG\` — ekstrakt jest bezużyteczny.\n\nSzczegóły widoczne w terminalu użytkownika.\n\nNie kontynuuj indeksowania. Poinformuj użytkownika o błędzie i zasugeruj:\n1. Sprawdź czy PDF ma warstwę tekstową (otwórz i spróbuj zaznaczyć tekst).\n2. Jeśli to skan: ocrmypdf books/<plik.pdf> books/<plik.pdf> --output-type pdf\n3. Uruchom ekstrakcję ponownie: \$DEADLANDS_RULES_PATH/scripts/extract-pdf.sh books/<plik.pdf> $SLUG'
      }));
    "
    ;;
esac

exit 0
