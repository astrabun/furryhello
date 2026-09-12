# furryhello

A small site making the case for not sending bare "hello"/"hi"/"how are you" DMs with no follow-up — please just ask the question.

## Structure

pnpm monorepo:

- `apps/website` — the Eleventy (11ty) site. TypeScript config, Markdown content, Tailwind CSS for styling, i18n-ready.
- `packages/tsconfig` — shared base `tsconfig.json`.
- `packages/bluesky-standard-site` — publishes `site.standard.*` (Bluesky/atproto) records for the site; see its own README for setup.

## Getting started

```
pnpm install
pnpm dev      # start the website's dev server
pnpm build    # build all packages
pnpm lint
pnpm fmt      # oxfmt --write
pnpm fmt:check
pnpm typecheck
```

Linting/formatting: [oxlint](https://oxc.rs/docs/guide/usage/linter.html) and [oxfmt](https://oxc.rs/docs/guide/usage/formatter.html), configured at the repo root (`oxlint.config.ts`, `oxfmt.config.ts`). A husky pre-commit hook runs lint-staged (lint + format on staged files) and a full typecheck.

## Deployment

Deployed to Cloudflare Pages from GitHub via `.github/workflows/cloudflare-pages.yml`:

- Pull requests get a preview deployment, with a PR comment (created once, then edited on later pushes) linking both the branch alias and the per-commit preview URL.
- Pushes to `main` deploy to production, and also run the `site.standard.*` sync (see `packages/bluesky-standard-site/README.md` for the required `BSKY_HANDLE`/`BSKY_APP_PASSWORD` secrets).

Required repo secrets/variables (GitHub --> Settings --> Secrets and variables --> Actions):

| Name                            | Type     | Purpose                                 |
| ------------------------------- | -------- | --------------------------------------- |
| `CLOUDFLARE_API_TOKEN`          | secret   | Cloudflare Pages deploy                 |
| `CLOUDFLARE_ACCOUNT_ID`         | secret   | Cloudflare Pages deploy                 |
| `CLOUDFLARE_PAGES_PROJECT_NAME` | variable | Cloudflare Pages deploy                 |
| `SWETRIX_BASE_URL`              | secret   | optional self-hosted analytics          |
| `SWETRIX_PROJECT_ID`            | secret   | optional self-hosted analytics          |
| `BSKY_HANDLE`                   | secret   | optional Bluesky `site.standard.*` sync |
| `BSKY_APP_PASSWORD`             | secret   | optional Bluesky `site.standard.*` sync |
