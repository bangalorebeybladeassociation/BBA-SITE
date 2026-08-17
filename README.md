# Bangalore Beyblade Association

Official site for the Bangalore Beyblade Association (BBA) — a Beyblade X
tournament hub with event brackets, an event registration system, a
seasonal leaderboard, a rulebook, an Instagram gallery, and a
buyer/seller/admin marketplace.

## Stack

- [Vite](https://vitejs.dev/) + React 18
- Tailwind CSS
- [Firebase](https://firebase.google.com/) — Authentication (email/password +
  Google) and Cloud Firestore (all app data)
- [Lenis](https://lenis.darkroom.engineering/) for smooth scrolling
- Live bracket links via [Challonge](https://challonge.com/)

## Features

- **Real roles** — `user` / `seller` / `admin`, backed by Firestore and
  enforced server-side via `firestore.rules`, not just UI. Admins nominate
  sellers/admins from the Admin dashboard.
- **Events** — admin-managed tournament timeline with live Challonge
  brackets, age categories, and per-category 1st/2nd/3rd prizes. Signed-in
  users can register in-app (matches the club's official registration form).
- **Leaderboard** — seasonal standings with standard competition ranking
  (ties share a rank), admin bulk-import from a pasted spreadsheet, and a
  season switcher so old seasons stay archived instead of being overwritten.
- **Rulebook** — plain-text, admin-editable, publicly readable.
- **Media gallery** — featured Instagram posts embedded via Instagram's
  public `/embed` iframe (no API key required).
- **Marketplace** — sellers list Beyblades/Stadiums/Launchers/Parts for
  approval; buyers checkout to a manual UPI handoff per seller (no payment
  gateway integration).
- **Dark / light theme** — toggle in the nav, persisted per device via
  `localStorage`.

## Getting started

```bash
npm install
cp .env.example .env   # fill in your Firebase project's config, see below
npm run dev             # local dev server
npm run build            # production build to dist/
npm run lint               # eslint
```

## Firebase setup (one-time)

1. Create a Firebase project, then **Build → Authentication** and enable the
   Email/Password and Google sign-in providers.
2. **Build → Firestore Database → Create database.**
3. **Project settings → General → Your apps** → add a web app, copy its
   config into `.env` (see `.env.example`).
4. Set `VITE_ADMIN_EMAILS` in `.env` to a comma-separated list of bootstrap
   admin emails — these become admins on first sign-in and can promote
   others from the Admin dashboard afterward.
5. Paste the contents of [`firestore.rules`](./firestore.rules) into
   **Firestore Database → Rules** and publish. **This is a manual step you
   must repeat every time `firestore.rules` changes** — it isn't deployed
   automatically by CI.

## Project structure

```
firestore.rules          # Firestore security rules — publish manually, see above
public/
  favicon.png              # browser tab icon, served at the site root
src/
  App.jsx                 # nearly all page sections + admin/seller/buyer panels
  main.jsx                 # React entry point
  index.css                 # Tailwind entry
  auth/
    AuthProvider.jsx          # Firebase Auth wiring, exposes user/role/isAdmin/isSeller
    context.jsx
  components/
    AccountMenu.jsx            # signed-in account dropdown (nav)
    Icon.jsx                    # small hand-drawn stroke icon set
  lib/
    firebase.js                  # Firebase app/Auth/Firestore init from env vars
    firestore.js                  # thin wrappers around every Firestore read/write
    authRoute.js                   # ?auth=login|signup query-param routing
    pageRoute.js                    # ?page=seller|admin query-param routing
  pages/
    AuthPage.jsx                     # sign in / sign up screen
  assets/
    beyblade.png                      # hero bey render, spun by SpinningBey
    bba-logo.png                       # association logo (nav + footer)
```

Theming: colors are CSS custom properties (`--bg`, `--surface`, `--text`,
`--accent`, etc.) defined once in the global `<style>` block in `App.jsx` and
flipped via a `data-theme` attribute on `<html>`. Use `var(--token)` instead
of a hardcoded hex when styling something new so it stays correct in both
themes — see the block's comments for which tokens invert and which
(brand accents, medal colors) intentionally stay constant.

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds the
site and publishes it to GitHub Pages automatically. The workflow needs the
same variables as your `.env` set as **repository secrets** (Settings →
Secrets and variables → Actions): `VITE_FIREBASE_API_KEY`,
`VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
`VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`,
`VITE_FIREBASE_APP_ID`, `VITE_ADMIN_EMAILS`. One-time setup on GitHub's
side: **Settings → Pages → Source → GitHub Actions**.

Live URL: `https://<your-github-username-or-org>.github.io/BBA-SITE/`

## Known gaps

- No payment gateway — checkout and event registration payment are both a
  manual UPI handoff, by design (no PCI/merchant-account overhead for a
  community club).
- Challonge integration is link-out only. Pulling live match data via the
  Challonge API would need a small backend proxy, since the API key can't
  be exposed client-side.
- "Remove from directory" for a user deletes their Firestore profile, not
  their underlying Firebase Auth account — true account revocation needs
  the Admin SDK on a backend, which this project doesn't have.

See open issues for tracked work.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT — see [LICENSE](./LICENSE).
