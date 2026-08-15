# Blade City BLR

Bangalore Beyblade X tournament hub — landing page, tournament timeline,
promo videos, leaderboard, and a buyer/seller/admin marketplace.

## Stack

- [Vite](https://vitejs.dev/) + React 18
- Tailwind CSS
- Live bracket links via [Challonge](https://challonge.com/)

## Getting started

```bash
npm install
npm run dev       # local dev server
npm run build      # production build to dist/
npm run lint        # eslint
```

## Project structure

```
src/
  App.jsx        # all page sections (hero, timeline, videos, leaderboard, marketplace)
  main.jsx       # React entry point
  index.css      # Tailwind entry + global styles
```

## Marketplace data

The marketplace panel persists listings via the host artifact's key-value
storage (`window.storage`) when running inside a Claude artifact. Outside
that environment, swap the calls in `src/App.jsx` (search `window.storage`)
for your own backend/API.

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds the
site and publishes it to GitHub Pages automatically. One-time setup on
GitHub's side: **Settings → Pages → Source → GitHub Actions**.

Live URL: `https://<your-github-username-or-org>.github.io/BBA-SITE/`

## Roadmap / known gaps

- No real authentication — the Buyer / Seller / Admin tabs are a UI
  demonstration of the intended roles, not access control.
- Challonge integration is link-out only. Pulling live match data via the
  Challonge API requires a small backend proxy, since the API key can't be
  exposed client-side.
- No payment processor wired into checkout.

See open issues for tracked work.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT — see [LICENSE](./LICENSE).
