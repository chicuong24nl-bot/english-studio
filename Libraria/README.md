# Libraria

An English reading app with short stories, three comprehension tests, bookmarks, and customizable reading settings.

## Project structure

```text
app/                 Next.js routes, layouts, and API endpoints
components/          Shared UI components
features/
  classroom/         Teacher tools, student/classroom state, and sync
  reading/           Reading experience, IELTS test builder, and study decks
content/             Shared curriculum content
lib/                 Shared application utilities and service clients
supabase/migrations/ Database schema changes
```

Feature-specific UI and data live together under `features/`; `app/` stays focused on routing and API entry points.

## Run locally

1. Install Node.js and pnpm.
2. Install packages with `pnpm install`.
3. Start the app with `pnpm dev` and open `http://localhost:3000`.

The public landing page runs without service credentials. Account sign-in requires Clerk; saved lessons and course progress require Clerk plus a Neon Postgres database. See `.env.example` for configuration. Stripe keys are only needed for subscription features.

## Load English lesson content

Set up a disposable Neon database, configure `DATABASE_URL`, and run:

```sh
pnpm db:push
ALLOW_DESTRUCTIVE_SEED=true pnpm db:prod
```

**The seed command clears learner progress, subscriptions, and existing course content in the configured database. Use it only with a disposable database.**

## Source and license

Based on [sanidhyy/duolingo-clone](https://github.com/sanidhyy/duolingo-clone). See [LICENSE](LICENSE) for the MIT license.
