# slides-web

`share.birdsatfive.dk` — internal file sharing. Drop in an HTML file, a whole
folder of pages, raw HTML or a PDF and get a link that opens in any browser,
with an optional password and expiry.

The repo keeps its `slides-web` name (and the `slides` Postgres schema) from
when this app was the AI deck builder — that half was removed on 2026-08-10.
`slides.birdsatfive.dk` stays attached to the app and 308-redirects to
`share.birdsatfive.dk`, so links already sent to clients keep resolving.

## Stack

- Next.js 16.1 (App Router) + React 19 + TypeScript
- Tailwind CSS v4 + vendored Birdie design system (see `.birdie-design.json`)
- Supabase SSR auth (self-hosted at `supabase.birdsatfive.dk`), gated to
  `@birdsatfive.dk` / `@birdie.studio`. Cookies are host-only (no `domain` is
  set), so this host does its own OAuth round trip rather than inheriting a
  session from ops. That means the origin must appear in
  `ADDITIONAL_REDIRECT_URLS` on the `baf-supabase` Coolify service, or GoTrue
  drops `redirect_to` and lands the user on `GOTRUE_SITE_URL` (ops)
- Storage: one `slides-html` bucket, keyed `{fileId}/{versionId}[/relPath]`
- Deployed on Coolify (Hetzner), auto-deploys from `main`

## Routes

| Route | Who | What |
| --- | --- | --- |
| `/` | team | Library of shared files: link state, views, copy, delete |
| `/share/new` | team | Upload → link, with password + expiry |
| `/f/[id]` | team | One file: its links, view sessions, comments |
| `/s/[slug]` | public | The viewer. Password gate, then the file in an iframe |
| `/api/share/[slug]/render` | public | Streams the file with the right Content-Type |
| `/api/share/[slug]/f/[...path]` | public | Serves a folder share; this path is its document root |
| `/api/share/[slug]/asset` | public | The raw bytes behind a PDF share |

## Local dev

```sh
cp .env.local.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
# AZURE_CLIENT_SECRET
npm install
npm run dev   # http://127.0.0.1:3001
```

Migrations live in `supabase/migrations` and are applied with psql against the
self-hosted database.
