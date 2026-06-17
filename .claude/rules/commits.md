# Commit conventions

Rules applied to every commit on this repository.

## Message format

- **Conventional commits** — prefix the subject with one of:
  `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`.
- Keep the subject under ~72 characters. Details go in the body.

## Authorship

- **Do not add `Co-Authored-By: Claude <noreply@anthropic.com>`** (or any other AI-tool co-author trailer).
- Commits in this repo are authored solely by the maintainer, regardless of who drafted the change.
- Regular human co-author trailers are fine when the work is genuinely shared.

## Enforcement

- Git-level: `.githooks/commit-msg` rejects any commit whose message contains a `Co-Authored-By:` trailer referencing Claude or `noreply@anthropic.com`. Activate once per clone with:
  ```bash
  git config core.hooksPath .githooks
  ```
- Branch per feature. PRs use `.github/PULL_REQUEST_TEMPLATE.md`.
