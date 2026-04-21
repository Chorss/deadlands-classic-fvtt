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

- [Foundry VTT](https://foundryvtt.com/) (license required), version 13.351 or higher
- [Node.js](https://nodejs.org/) v18+ (for any build tooling)
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
├── .github/                    # GitHub configuration
│   ├── ISSUE_TEMPLATE/         # Issue templates
│   └── PULL_REQUEST_TEMPLATE.md
├── lang/                       # Localization files (e.g., en.json)
├── module/                     # ES module source files
│   ├── actors/                 # Actor document classes & sheets
│   ├── items/                  # Item document classes & sheets
│   ├── dice/                   # Dice rolling logic (Aces, raises)
│   ├── cards/                  # Poker-card initiative deck
│   └── deadlands-classic.mjs   # Main entry point
├── styles/                     # CSS/LESS stylesheets
├── templates/                  # Handlebars HTML templates
│   ├── actors/
│   └── items/
├── packs/                      # Compendium pack data
├── system.json                 # Foundry VTT manifest
├── CHANGELOG.md
├── CONTRIBUTING.md
├── LICENSE
└── README.md
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

- [ ] Code tested locally in Foundry VTT V13
- [ ] No unrelated files changed
- [ ] CHANGELOG.md updated under `[Unreleased]`
- [ ] `system.json` version bumped if this is a release PR

---

## Code Style Guidelines

- **JavaScript:** ES2022+, ES modules (`.mjs`). No CommonJS `require()`.
- **Formatting:** 2-space indentation, single quotes for strings.
- **Naming:** `camelCase` for variables/functions, `PascalCase` for classes.
- **Comments:** Only when the *why* is non-obvious — not what the code does.
- **No build step required** for core functionality. Keep tooling optional.

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
