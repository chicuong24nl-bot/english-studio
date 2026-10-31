# Libraria

An English reading app with short stories, three comprehension tests, bookmarks, and customizable reading settings.

## Project structure

```text
app/
  (reader)/          Main Libraria route at /
  api/               Teacher session, student session, classroom sync
features/
  classroom/
    components/      Teacher dashboard and sign-in
    client-sync.ts   Browser-side classroom synchronization
    data-model.ts    Shared classroom types and defaults
    server-state.ts  Supabase persistence and signed sessions
  reading/
    components/      Reading app, test builder, test follow-up
    data/            IELTS passages, questions, and vocabulary decks
components/          Shared UI primitives
content/             Curriculum content
db/                  Drizzle schema, queries, and database client
actions/             Server actions for the legacy course modules
lib/                 Shared utilities and integrations
supabase/migrations/ Supabase classroom and teacher-auth schema
```

Feature-specific code lives under `features/`; `app/` stays focused on routes and API entry points. The old `/demo` URL redirects to `/`.

## Run locally

1. Install Node.js and pnpm.
2. Install packages with `pnpm install`.
3. Start the app with `pnpm dev` and open `http://localhost:3000`.

The reading app runs at `http://localhost:3000/`. Teacher sign-in and shared classroom sync require Supabase variables from `.env.example`. Stripe keys are only needed if billing is enabled.

## Load English lesson content

Set up a disposable Neon database, configure `DATABASE_URL`, and run:

```sh
pnpm db:push
ALLOW_DESTRUCTIVE_SEED=true pnpm db:prod
```

**The seed command clears learner progress, subscriptions, and existing course content in the configured database. Use it only with a disposable database.**

## Source and license

Based on [sanidhyy/duolingo-clone](https://github.com/sanidhyy/duolingo-clone). See [LICENSE](LICENSE) for the MIT license.
