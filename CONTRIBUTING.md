# Contributing

## Branching

- `main` is always deployable. No direct pushes — every change lands via PR.
- Branch names: `feat/<short-desc>`, `fix/<short-desc>`, `chore/<short-desc>`,
  `docs/<short-desc>`.
- Rebase (not merge) your branch on `main` before opening a PR to keep
  history linear.

## Commits

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add leaderboard rank rings
fix: correct cart total rounding
docs: update setup instructions
chore: bump vite to 5.4
```

## Pull requests

- Keep PRs scoped to one concern.
- Fill in the PR template (what changed, why, how to test).
- CI (lint + build) must pass before merge.
- Squash-merge into `main` so each PR is one commit in history.

## Local setup

```bash
npm install
npm run dev
```

## Code style

- Functional React components, hooks only (no class components).
- Run `npm run lint` before pushing.
