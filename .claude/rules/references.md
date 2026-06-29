---
paths:
  - "vendor/**"
---

# Reference projects — READ, don't COPY

The repo vendors two upstream projects for pattern research under `vendor/`:

- `vendor/DeadlandsClassic/` — Dulux-Oz, **GPL-3.0**, newer
- `vendor/Deadlands-Classic/` — RhombusWeasel, **MIT**, older (Foundry v9-era)

## Rules

- **Read freely** — study structure, data-model shapes, sheet wiring, mechanic interpretations.
- **Never copy code** — architectural ideas aren't copyrighted, but source files are. Our system ships under MIT; pulling GPL source in would relicense us.
- **No literal paste** — not into `module/`, not into comments, not into packs, not into commit messages. If you spotted a clever approach, re-implement it in your own code against V14 APIs.
- **Attribution, not lifting** — if a non-trivial technique came from these references, mention the fact (but not the code) in the PR description.
- **Never modify the reference trees** — read-only. All edits target `module/` or other editable-surface paths (see CLAUDE.md §Editable surface).

## Practical workflow

- `Read` / `Grep` these directories to understand approach.
- When reaching for `Edit` / `Write`, the target is always our own code, never the reference trees.
