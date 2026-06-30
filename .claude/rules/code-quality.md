---
# No `paths:` — applies everywhere (auto-loaded via CLAUDE.md)
---

# Code quality standards — JavaScript / .mjs

Rules are grounded in three sources, each cited explicitly:
- **Biome** — tool-enforced, zero tolerance (blocks commit via pre-commit hook)
- **SOLID** — design-level principles (Feathers, Martin; widely accepted beyond Clean Code)
- **OWASP ASVS / Top 10** — security, verifiable patterns
- **ISO/IEC 25010** — quality attributes that are measurable, not opinion-based

"Clean Code" style opinions (short functions, no else, guard clauses) are **not** rules here
— they are style preferences and should not be enforced as requirements.

---

## 1. Tooling — enforced by Biome (`npm run lint`)

These are not guidelines. Biome rejects them and the pre-commit hook blocks the commit.

| Rule | What it catches |
|---|---|
| `correctness/noUnusedVariables` | Dead variables and imports |
| `correctness/noUnusedFunctionParameters` | Parameters that are never read (prefix `_` if intentional) |
| `style/useConst` | `let` where `const` suffices |
| `style/useTemplate` | String concatenation where a template literal fits |
| `style/noVar` | `var` declarations |
| `suspicious/noDoubleEquals` | `==` / `!=` instead of `===` / `!==` |
| `complexity/noExcessiveCognitiveComplexity` | Cognitive complexity > 15 per function |
| `style/useBlockStatements` | `if`/`for`/`while` without `{}` — all control blocks require braces |
| `assist/source/organizeImports` | Unsorted imports |

Run `npx biome check --write --unsafe` to auto-fix the majority of these.

---

## 2. SOLID — design-level principles

Applied when designing modules, classes, and registries. Not a style checklist.

**S — Single Responsibility (ISO 25010: Maintainability / Modularity)**
A module has one reason to change. `core/` knows nothing about archetypes;
archetypes know nothing about other archetypes. Crossing this boundary is a
design smell, not a formatting issue.

**O — Open / Closed**
The system is already built around this: add a new archetype by registering it,
not by editing `core/`. Never add `if (type === "huckster")` inside `core/`.

**D — Dependency Inversion**
High-level modules (`core/`) depend on abstractions (registry contracts), not on
concrete archetype implementations. Archetypes depend on `core/` utilities, never
on each other.

LSP and ISP are less applicable to duck-typed JavaScript but apply to TypeDataModel
subclasses: a subclass must not break contracts expected of its superclass.

---

## 3. Security — OWASP ASVS L1 patterns applicable to browser JS

**Never use `eval()`, `new Function()`, or `innerHTML` with unsanitized input.**
Foundry's `TextEditor.enrichHTML` sanitizes — use it. Raw `element.innerHTML = userInput`
is an XSS vector even in a local app (browser extensions, imported compendiums).

**Validate at system boundaries only.**
Validate user input (sheet form values, dialog params) and external data (compendium
imports, network responses) at the point of entry. Do not add defensive checks inside
pure core functions for states that cannot occur — that is not security, it is noise.

**No hardcoded secrets or credentials** in any committed file.
Tokens, API keys, and passwords belong in environment variables or Foundry settings,
never in `.mjs` source.

---

## 4. Measurable quality metrics (ISO/IEC 25010)

**Cognitive complexity ≤ 15 per function** — enforced by Biome.
Cognitive complexity (Sonar metric) measures how hard a function is to understand,
penalising nesting and control-flow breaks more heavily than simple branching.
A function that exceeds 15 is a refactor signal, not a style violation.

**Magic values → named constants.**
Any literal that appears in logic (not in i18n strings or data definitions) and
whose meaning is not obvious from context must be extracted to a `const` with a
descriptive name. This is a maintainability metric (ISO 25010 §8.5.2).

```js
// ❌ — what does 5 mean?
if (severity >= 5) applyMaimed();

// ✅ — self-documenting and single point of change
const WOUND_MAX = 5;
if (severity >= WOUND_MAX) applyMaimed();
```

**DRY — single source of truth** (*The Pragmatic Programmer*, Hunt & Thomas, 1999).
Every piece of knowledge must have a single, unambiguous, authoritative representation.
Duplication is not a style problem — it is a reliability problem: two copies diverge.
Use data arrays + loops, not repeated calls with different arguments.

---

## 5. Error handling (ISO 25010: Reliability / Fault Tolerance)

- **Never swallow errors silently.** Either re-throw, surface to the user via
  `ui.notifications.error()`, or log with `console.error()`. An empty `catch {}` is
  always wrong.
- **Errors at boundaries, not inside pure functions.** A pure function with valid
  inputs should not throw. Validate inputs before calling it.
- **Async errors must be awaited or caught.** An un-handled promise rejection is a
  silent failure. `async` functions called as event handlers must be wrapped or
  the rejection forwarded to Foundry's error hook.

---

## 6. Testing (ISO 25010: Reliability / Testability)

**What requires a `node:test` unit test:**
pure functions in `core/` — dice, chips, wounds, cards, poker evaluator.
Any function whose output depends only on its inputs and has no Foundry API calls.

**What is verified manually (Playwright):**
Foundry-dependent code — sheets, hooks, socket events.

**Test structure — AAA (Arrange / Act / Assert):**
```js
// Arrange
const pool = { white: 3, red: 1 };
// Act
const result = canSpend("red", pool, { higherAlreadySpent: null });
// Assert
assert.strictEqual(result, true);
```

Test names describe behaviour, not implementation:
```js
// ❌  "test canSpend red"
// ✅  "allows red when no higher chip already spent"
```

---

## 7. CSS/Template coverage rule

**Every `dlc-*` class introduced in a `.hbs` template MUST have a corresponding CSS rule in `styles/`.**

This is enforced by `tools/audit-css.mjs` (run via `/verify-system`, pre-commit hook on `.hbs`/`.css` changes, and CI). A commit that adds a template class without a CSS rule is rejected.

**Workflow when adding a new template section:**
1. Write the `.hbs` markup with `dlc-*` classes.
2. Immediately add matching rules to the appropriate `styles/*.css` file.
3. Run `node tools/audit-css.mjs` — must exit 0 before committing.

Dynamic Handlebars fragments (e.g. `dlc-chip-{{color}}`) are exempt from static checking but must be documented in a CSS comment listing the possible values.

---

## Language

All identifiers, comments, and string literals in `.mjs` files are in **English**.
Polish appears only in `lang/pl.json` and in planning documents outside the repo.
