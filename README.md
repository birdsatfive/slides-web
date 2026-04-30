# slides-web

`slides.birdsatfive.dk` — AI deck & presentation product. Pairs with the
`slides-api` Python render service (refactored from `/Users/marius/slides-server`)
which handles extraction, generation, screenshot rendering and PDF export.

## Stack

- Next.js 16.1 (App Router) + React 19 + TypeScript
- Tailwind CSS v4 + custom design tokens (mirrors ops)
- Supabase SSR auth (self-hosted at `supabase.birdsatfive.dk`) — cookies on
  `.birdsatfive.dk` give SSO across all BAF apps
- Radix UI primitives + lucide-react icons
- Tanstack Query for client-side data
- Deployed on Vercel; render service deploys to Coolify on Hetzner

## Local dev

```sh
cp .env.local.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
# AZURE_CLIENT_SECRET, SLIDES_API_JWT_SECRET (any 256-bit random string)
npm install
npm run dev   # http://localhost:3001
```

The first time you run, apply the Supabase migration:

```sh
psql "$DATABASE_URL" -f supabase/migrations/20260430_slides_schema.sql
```

## Architecture

```
slides.birdsatfive.dk     →  Vercel (this repo)
                              auth, library, editor, template gallery, share viewer
slides-api.birdsatfive.dk →  Coolify/Hetzner (refactored slides-server)
                              extract → generate → render endpoints, stateless
Supabase (studio-api)     →  shared with ops; `slides` schema + storage buckets
```

The render service does not have public auth. Next.js server actions sign a
short-lived HS256 JWT with `SLIDES_API_JWT_SECRET` carrying `{ user_id, org_id }`
and call `SLIDES_API_URL` directly. The API uploads artifacts to Supabase
storage with the service-role key.

## Plan

Full delivery plan at
`/Users/marius/.claude/plans/sequential-inventing-parrot.md`. We are
mid-Phase-1.
