@AGENTS.md

# Claude Code integration

Claude Code uses the shared project instructions above. `.claude/settings.json` adds the
fail-closed Bash sandbox, hooks, and project permissions. `.claude/rules/` may provide
path-scoped reminders, but `AGENTS.md` remains authoritative if wording drifts.

Claude adapters under `.claude/skills/` point to the five canonical procedures in
`.agents/skills/`. Do not create a Claude-only implementation workflow. Custom subagents in
`.claude/agents/` are optional helpers and do not replace the evidence, verification, or review
requirements in `AGENTS.md`.

The Bash sandbox requires `bubblewrap` and `socat` on Linux. Because
`sandbox.failIfUnavailable` is true and unsandboxed commands are disabled, Claude must stop at
startup when either dependency is unavailable.
