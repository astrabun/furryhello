# @furryhello/bluesky-standard-site

Publishes/updates `site.standard.publication` and `site.standard.document`
records (the [standard.site](https://standard.site/docs) lexicons) on the
site's Bluesky/atproto account, so link embeds render a rich "publication"
card. See `scripts/sync-standard-site.mts` for the full explanation.

## Credentials

Requires a [Bluesky app password](https://bsky.app/settings/app-passwords)
(not your main account password) for the account that should own these
records.

- **Locally**: create a `.env` file in this package's directory
  (`packages/bluesky-standard-site/.env`, already gitignored) with:

  ```
  BSKY_HANDLE=furryhello.com
  BSKY_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
  ```

- **CI**: set `BSKY_HANDLE` and `BSKY_APP_PASSWORD` as repository secrets in
  GitHub (Settings --> Secrets and variables --> Actions). The production
  deploy workflow (`.github/workflows/cloudflare-pages.yml`) reads them from
  there.

## Usage

```
pnpm --filter @furryhello/bluesky-standard-site sync:standard-site
```

This reads every `apps/website/src/content/**/*.md` page (each must have
`permalink` and `publishedAt` front matter), upserts the corresponding
records, and writes the resulting AT-URIs back to
`apps/website/src/_data/standard_site*.{json,txt}` - those files are
committed to git so the Eleventy build needs no network call.
