# Contributing to Deadlands Classic — Community Edition

Thank you for your interest in contributing! This is a community-driven project and every contribution matters — whether it's a bug report, a feature suggestion, a documentation fix, or a pull request.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Setting Up a Local Dev Environment](#setting-up-a-local-dev-environment)
- [Folder Structure](#folder-structure)
- [Submitting Pull Requests](#submitting-pull-requests)
- [Code Style Guidelines](#code-style-guidelines)
- [Reporting Bugs](#reporting-bugs)
- [Feature Requests](#feature-requests)
- [Community & Resources](#community--resources)

---

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold these standards.

---

## Setting Up a Local Dev Environment

### Prerequisites

- [Foundry VTT](https://foundryvtt.com/) (license required), **V14+** (V13 not supported; verified 14.364)
- [Node.js](https://nodejs.org/) **24+** (required by Foundry V14)
- [Git](https://git-scm.com/)

### Steps

1. **Fork** this repository on GitHub and clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/deadlands-classic-fvtt.git
   cd deadlands-classic-fvtt
   ```

2. **Symlink** (or copy) the repository into your Foundry VTT `Data/systems/` directory:
   ```bash
   # Linux / macOS
   ln -s /path/to/deadlands-classic-fvtt ~/.local/share/FoundryVTT/Data/systems/deadlands-classic

   # Windows (PowerShell, run as Administrator)
   New-Item -ItemType Junction -Path "$env:LOCALAPPDATA\FoundryVTT\Data\systems\deadlands-classic" -Target "C:\path\to\deadlands-classic-fvtt"
   ```

3. **Launch Foundry VTT**. The system should appear in the Game Systems list.

4. Create a test World using the **Deadlands Classic** system and begin testing.

---

## Folder Structure

```
deadlands-classic-fvtt/
├── module/
│   ├── deadlands-classic.mjs   # entry — init/ready hooks, registries wired here
│   ├── core/                   # archetype-agnostic: dice, cards, chips, wounds, registries, documents, items
│   └── archetypes/             # self-contained per-archetype modules (_base/ + cowboy/, huckster/, …, _overlays/harrowed/, npc/, mook/)
├── templates/                  # Handlebars partials per sheet section
├── styles/                     # CSS entry + partials
├── lang/                       # en.json, pl.json (EN/PL key parity mandatory)
├── packs/                      # compendium packs — built from packs/_source/ via `fvtt package pack`
├── tools/                      # repo tooling (verify-documenttypes.mjs, …)
├── tests/                      # node:test unit tests for pure core logic
├── docs/                       # implementation-plan.md, notes.md
├── .github/                    # issue templates + PULL_REQUEST_TEMPLATE.md
├── system.json                 # Foundry VTT manifest (documentTypes, V14)
└── CHANGELOG.md, CONTRIBUTING.md, LICENSE, README.md
```

---

## Submitting Pull Requests

1. **Create a branch** from `main` for your work:
   ```bash
   git checkout -b feature/poker-initiative
   ```

2. Make your changes. Keep commits focused and atomic.

3. **Test your changes** in Foundry VTT before submitting.

4. Push your branch and open a **Pull Request** against `main`.

5. Fill out the PR template completely — describe what changed and why.

6. Be responsive to review feedback. PRs that go stale for more than 30 days may be closed.

### PR Checklist

- [ ] Code tested locally in Foundry VTT V14
- [ ] No unrelated files changed
- [ ] CHANGELOG.md updated under `[Unreleased]`
- [ ] `system.json` version bumped if this is a release PR

---

## Code Style Guidelines

- **JavaScript:** ES2022+, ES modules (`.mjs`). No CommonJS `require()`.
- **Formatting:** run `npm run fmt` (Biome owns indentation, quotes, etc.); `npm run lint` to check.
- **Naming:** `camelCase` for variables/functions, `PascalCase` for classes. Full casing matrix in `.claude/rules/naming.md`.
- **Comments:** Only when the *why* is non-obvious — not what the code does.
- **No build step** for core code (`.mjs` runs directly). Compendium packs are built from `packs/_source/` via `fvtt package pack`.
- **Commits:** conventional-commit prefixes (`feat:`/`fix:`/`docs:`/`chore:`/`refactor:`/`test:`). Do **not** add a `Co-Authored-By: Claude` trailer — `.githooks/commit-msg` rejects it. Run `git config core.hooksPath .githooks` once per clone to enable the hooks.

---

## Reporting Bugs

Please use the [Bug Report](.github/ISSUE_TEMPLATE/bug_report.md) issue template. Include:

- Your Foundry VTT version
- Your system version
- A clear list of steps to reproduce the issue
- What you expected vs. what actually happened
- Any relevant console errors (F12 in Foundry)

---

## Feature Requests

Use the [Feature Request](.github/ISSUE_TEMPLATE/feature_request.md) template. Check existing issues first to avoid duplicates.

---

## Community & Resources

- [Foundry VTT Developer Discord](https://discord.gg/foundryvtt) — `#system-development` channel
- [Foundry VTT API Documentation](https://foundryvtt.com/api/)
- [Pinnacle Entertainment Group](https://peginc.com/) — Deadlands publisher
