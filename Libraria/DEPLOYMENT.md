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

## Before using real classrooms

The demo currently uses browser storage for teacher and student data. Before inviting students, replace that storage path with a shared database and authenticated teacher/student access, then deploy that production workflow. The project includes Clerk/Neon environment-variable placeholders in `.env.example`; real keys and a Neon connection string must be created in those services and added as encrypted Vercel project environment variables. Never put secret values in source files, commits, screenshots, or chat.

### Teacher sign-in for the demo

The `/demo` teacher workspace can be gated with a single shared teacher password. In Vercel, add `LIBRARIA_TEACHER_PASSWORD` and `LIBRARIA_TEACHER_SESSION_SECRET` as encrypted environment variables, then redeploy. Use a long unique password and generate the session secret with `openssl rand -hex 32`. The teacher session uses an HTTP-only, same-site cookie and expires after 12 hours. If these variables are missing, teacher sign-in stays locked.

The demo still saves materials and classroom data in each browser's local storage. The sign-in gate protects the teacher interface from casual access, but it does not turn browser storage into a shared or server-secured database. For real student accounts and cross-device material access, complete the authenticated database setup above before inviting a class.

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
