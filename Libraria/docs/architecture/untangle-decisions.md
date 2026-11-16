# Libraria structure and behavior decisions

This log records the cross-feature problems found during the untangle pass and the design changes made to address them. Existing local and Supabase classroom data remains untouched.

## Decisions

- Keep reading-material publication and audience visibility in `features/reading/data/material-policy.ts` so the student library, assigned-exam list, teacher assignment picker, teacher activity summary, and deep links use one rule.
  - Before this change, some screens treated any status except `draft` as published while others required exactly `published`.
  - Student direct links now require a published, student-visible, non-exam reading test. Exam links require the current student's assignment and a published test. Starting or reviewing an exam repeats the ownership and publication check.
- Keep route parsing and validation in `features/reading/navigation/routes.ts` so path allowlists, encoded path segments, legacy practice query steps, and generated practice paths do not drift apart.
  - Malformed percent-encoding previously threw during client route restoration.
  - The browser-history listener previously closed over the first render's tests and assignments. It now reads the latest route handler, and route restoration waits for initial local/cloud student state hydration.
- Keep the classroom key protocol in `features/classroom/state-keys.ts` so browser bootstrap collection and server write authorization share one allowlist and one student-owned-key rule.
- Make empty-classroom bootstrap an atomic database operation. A new Supabase migration adds `libraria_bootstrap_state`; concurrent first-time teacher requests can no longer overwrite one another after both observe an empty classroom.
- Keep assigned-exam filtering and its time-sensitive screen in `features/reading/components/student-exams-page.tsx`, separate from the app shell and its session, teacher, settings, and reading-library concerns.
- Keep the reading player, answer controls, passage highlight rendering, notes, and flashcard review in `features/reading/components/reading-experience.tsx`; the app shell now composes those views instead of owning their interaction state.
- Keep student profile entry and remembered-device controls in `features/reading/components/student-home-page.tsx`, separate from the authenticated reading experience.
- Remove the unused scheduled-assessment duplicate and exam-reminder generator. The current exam list and assignment cards already provide the live exam flows; the removed functions had no callers.
- Keep comments only when they describe behavior outside the code or a failure-mode fallback. The remaining comments describe local reading fallback and sign-out fallback behavior; there were no comments that only restated their implementation.
- There were no existing test files in `Libraria`, so there were no tests to remove or repair under the selected test-cleanup option.

## Deliberate constraints and follow-up risks

- The current database is a single shared classroom row (`id = 'main'`). Teacher accounts therefore share the same classroom data. Converting this into separately owned classrooms needs an explicit ownership map for the existing row and matching student-session changes; this refactor does not guess an owner or move live student records.
- Student-code rate limiting currently uses a process-local map, which is not durable across serverless instances. A durable limiter requires a database-backed policy and deployment of its SQL migration; it remains a production-hardening item.
- The main `reading-app.tsx` still coordinates several workflows. The exams screen has been extracted, and routing/publication/data-key rules now have feature modules, but the reading player and app shell remain candidates for incremental component and hook extraction.
- The browser uses local storage as a cache and the server stores classroom collections as JSON values. Assignment submissions already use a row-locked merge function; other concurrent edits to the same collection can still be last-write-wins. Normalized domain tables need a separate, data-preserving migration plan.

## Applying the database change

Apply `supabase/migrations/202611160001_libraria_atomic_bootstrap.sql` to the Libraria Supabase project before relying on first-time classroom bootstrap from the updated application. The migration adds an RPC function and does not modify the existing classroom row.
