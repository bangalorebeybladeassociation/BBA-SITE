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
cp .env.example .env   # fill in a Firebase project's config — see README.md
npm run dev
```

Without a filled-in `.env`, the site still renders but Firebase-backed
features (auth, events, leaderboard, marketplace, everything) silently
no-op — see [README.md](./README.md#firebase-setup-one-time) for the
one-time Firebase project setup.

If your change touches `firestore.rules`, note that it isn't deployed by
CI — whoever has access to the Firebase console needs to paste the updated
file into **Firestore Database → Rules** and publish it manually after the
PR merges.

## Code style

- Functional React components, hooks only (no class components).
- Colors are CSS custom properties (`var(--bg)`, `var(--text)`,
  `var(--accent)`, etc.), defined once in the global `<style>` block in
  `App.jsx` for both the dark and light themes. Use the existing tokens
  instead of a hardcoded hex value so new UI stays correct in both themes.
- Run `npm run lint` before pushing.
