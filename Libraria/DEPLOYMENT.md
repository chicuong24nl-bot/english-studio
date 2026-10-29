# Deploy Libraria

## What is ready now

This Next.js project can be deployed to Vercel. In production, if Clerk is not configured, `proxy.ts` sends `/` to `/demo` and limits the site to that demo route. The demo stores student profiles, reading progress, teacher materials, assignments, grades, and teacher settings in the current browser's `localStorage`.

That means a public demo URL is useful for trying the interface, but each visitor has separate data. Teacher and student devices will not share a classroom, and browser data is not a durable database. Do not use this demo mode for real student records or exams. A shared classroom needs authenticated accounts and server-side persistence; the existing local demo does not gain that just by adding a database URL.

## Publish the demo with Vercel

1. Review the project and make sure `.env.local` and other secrets are not committed. Keep `.env*` ignored; `.env.example` contains placeholders only.
2. Push the project to a GitHub repository you control. Review `git status` first and stage only the files you intend to publish.
3. In [Vercel](https://vercel.com/new), sign in, choose **Add New → Project**, and import that GitHub repository.
4. Keep the detected Next.js framework and set **Root Directory** to `Libraria`. The build command is `pnpm build`; Vercel uses the package manager lockfile in that folder to install dependencies.
5. For the demo-only deployment, do not add placeholder Clerk or database credentials. Deploy, then open the generated URL; `/` should redirect to `/demo`.
6. Vercel will build on pushes to the connected production branch. Use the deployment's **Visit** link to confirm the published build.

Vercel's Git integration creates deployments from connected GitHub repositories and can redeploy on pushes. Environment-variable changes apply to new deployments, so redeploy after changing them.

## Connect the demo to Supabase

The `/demo` classroom can use a private Supabase table through server-side API routes. The browser never receives the Supabase secret key. Run the migration in `supabase/migrations/202610290001_libraria_classroom_state.sql` from the Supabase SQL Editor, then add these encrypted Vercel environment variables and redeploy:

- `SUPABASE_URL` — the project URL, such as `https://your-project-ref.supabase.co` (no `/rest/v1/` suffix).
- `SUPABASE_SECRET_KEY` — create a Supabase **Secret key** for server-side use. Never use a publishable key here, and never add this value to `NEXT_PUBLIC_*` variables, source files, screenshots, or chat.
- `LIBRARIA_TEACHER_PASSWORD` and `LIBRARIA_TEACHER_SESSION_SECRET` — required for the teacher workspace. Generate the session secret with `openssl rand -hex 32`.

After deploy, sign in as the teacher from the device that currently contains the classroom data. The app seeds the empty Supabase classroom from that browser once. Subsequent teacher changes and student progress sync through server routes. Students enter their 9-digit codes on their own devices. Keep a backup of any local data before clearing browser storage.

The publishable key is designed for browser-side Supabase clients and is not used by this server-only setup. The server secret is powerful: only the authenticated teacher session can change classroom-wide materials; student sessions can read their assigned materials and update their own progress and exam submissions.

### Teacher sign-in

The teacher session uses an HTTP-only, same-site cookie and expires after 12 hours. Student-code sessions are also HTTP-only and expire after 30 days. Student codes are access codes, not full user passwords; share each code only with its student.

Stripe variables are only needed if you enable billing. Review the database schema and migration workflow before touching a production database; do not run the destructive seed script against real student data.

## Local check before publishing

From the `Libraria` folder:

```powershell
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
pnpm build
```

Then run `pnpm start` and open `http://localhost:3000/demo` to inspect the production build locally.

## Official references

- [Deploying GitHub projects with Vercel](https://vercel.com/docs/git/vercel-for-github)
- [Vercel environment variables](https://vercel.com/docs/environment-variables)
- [Next.js deployment options](https://nextjs.org/docs/app/getting-started/deploying)
