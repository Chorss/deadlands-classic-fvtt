#!/usr/bin/env bash

set -eu

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
FIXTURE=$(mktemp -d /tmp/deadlands-stop-hook.XXXXXX)
trap 'rm -rf "$FIXTURE"' EXIT

mkdir -p "$FIXTURE/.claude/hooks" "$FIXTURE/bin" "$FIXTURE/vendor"
cp "$ROOT/.claude/hooks/stop-verify.sh" "$FIXTURE/.claude/hooks/stop-verify.sh"
cp "$ROOT/.claude/hooks/protect-paths.mjs" "$FIXTURE/.claude/hooks/protect-paths.mjs"

printf '%s\n' '#!/usr/bin/env bash' \
  'printf "called:%s\n" "${AI_HOOK_RESULT:-pass}" >> "$AI_HOOK_LOG"' \
  'case "${AI_HOOK_RESULT:-pass}" in' \
  '  fail-lint) echo "lint fixture failed" >&2; exit 1 ;;' \
  '  fail-tests) echo "test fixture failed" >&2; exit 1 ;;' \
  'esac' > "$FIXTURE/bin/npm"
chmod +x "$FIXTURE/bin/npm" "$FIXTURE/.claude/hooks/stop-verify.sh"

git -C "$FIXTURE" init -q
git -C "$FIXTURE" config user.email test@example.invalid
git -C "$FIXTURE" config user.name "Hook Test"
printf '%s\n' 'clean' > "$FIXTURE/tracked.txt"
printf '%s\n' 'vendor/' > "$FIXTURE/.gitignore"
git -C "$FIXTURE" add tracked.txt .gitignore .claude bin
git -C "$FIXTURE" commit -qm init

HOOK_LOG="$FIXTURE/hook.log"
run_stop() {
  PATH="$FIXTURE/bin:$PATH" AI_HOOK_LOG="$HOOK_LOG" AI_HOOK_RESULT="$1" \
    "$FIXTURE/.claude/hooks/stop-verify.sh" <<< "$2"
}

clean_output=$(run_stop pass '{"stop_hook_active":false}')
test -z "$clean_output"
test ! -e "$HOOK_LOG"

printf '%s\n' 'dirty' >> "$FIXTURE/tracked.txt"
lint_output=$(run_stop fail-lint '{"stop_hook_active":false}')
printf '%s' "$lint_output" | grep -q '"decision":"block"'
printf '%s' "$lint_output" | grep -q 'lint fixture failed'

test_output=$(run_stop fail-tests '{"stop_hook_active":false}')
printf '%s' "$test_output" | grep -q 'test fixture failed'

retry_output=$(run_stop fail-tests '{"stop_hook_active":true}')
printf '%s' "$retry_output" | grep -q 'Repeated Stop verification is still red'
test "$(wc -l < "$HOOK_LOG")" -eq 3

pass_output=$(run_stop pass '{"stop_hook_active":true}')
test -z "$pass_output"
test "$(wc -l < "$HOOK_LOG")" -eq 4

protected_output=$(printf '%s' \
  "{\"cwd\":\"$FIXTURE\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"touch vendor/ignored.txt\"}}" \
  | node "$FIXTURE/.claude/hooks/protect-paths.mjs")
printf '%s' "$protected_output" | grep -q '"permissionDecision":"deny"'

echo "stop-hook tests OK — clean, lint, tests, retry, pass, protected ignored path."
