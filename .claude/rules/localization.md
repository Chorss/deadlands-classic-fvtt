---
paths:
  - "lang/**/*.json"
  - "module/**/*.mjs"
  - "templates/**/*.hbs"
---

# Localization rules

Every user-facing string is localized from v0.1. **No hardcoded strings in UI code.**

## Supported locales

- `lang/en.json` — English (authoritative source of keys)
- `lang/pl.json` — Polski (maintainer's primary language)

Both files MUST have identical key sets. `.claude/hooks/post-write.sh` and `.githooks/pre-commit` enforce parity via `tools/verify-documenttypes.mjs`.

## Key naming

- Top-level namespace: `DEADLANDS.*` for anything system-specific.
- Document-type labels follow Foundry convention: `TYPES.Actor.<typeKey>`, `TYPES.Item.<typeKey>`.
- Per-archetype strings: `DEADLANDS.Archetype.<Id>.*` where `<Id>` is PascalCase (see `.claude/rules/naming.md`).
- Sheet/UI strings: `DEADLANDS.Sheet.<Context>.<Label>`.
- Chat / roll messages: `DEADLANDS.Chat.*`.

## Adding a new string

Both `en.json` AND `pl.json` get the same key in the same commit — partial commits are rejected by the hook. Use `{placeholder}`-style interpolation (`game.i18n.format(key, {title})`); avoid string concatenation at call sites.

## PL specifics

- Use proper diacritics: `ą ć ę ł ń ó ś ź ż`.
- Mind grammatical gender in generated messages — prefer full sentences over templated fragments when gender matters.
- `BN` = "Bohater Niezależny" (NPC); `Statysta` = mook.
