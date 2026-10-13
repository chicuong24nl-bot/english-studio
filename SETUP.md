# English Studio — setup guide

This app follows the supplied Stage 1 Reading & Writing material. It contains six English passages, their six-layer analysis, flashcards, MCQs, writing prompts, and a grammar reference based on the provided PDF. Practice has no attempt limit.

## 1. Run the website locally

1. Install Node.js LTS.
2. Open PowerShell in the project folder.
3. Run `npm run dev`.
4. Open `http://localhost:4173`.
5. Stop the local server with `Ctrl+C`.

No `npm install` is required.

## 2. Install or update the Supabase schema

1. Open the Supabase project used by the site.
2. Go to **SQL Editor → New query**.
3. Open `supabase/schema.sql` from this project, copy the entire file into the query, then click **Run**.
4. For an existing project where student code login shows `function digest(text, unknown) does not exist`, run `supabase/fix-student-login.sql` in a new SQL query. This updates the three existing RPC functions and keeps student data intact.
5. Run (or re-run after an app update) `supabase/manage-student-records.sql` in a new query to enable teacher-side editing, activation/deactivation, deletion, and online/offline presence. Deletion explicitly removes a student's sessions and progress before the roster row, including on databases where the older foreign keys do not cascade. Students send a heartbeat while the page is visible; closing the page, switching away, or logging out marks them offline. The teacher roster refreshes presence every 15 seconds.

Supabase installs `pgcrypto` in the `extensions` schema. The functions use a restricted `search_path`, so the fixed SQL explicitly calls `extensions.digest()` and `extensions.gen_random_bytes()`.

## 3. Create the teacher account and grant access

1. Go to **Authentication → Providers → Email** and turn off **Allow new users to sign up**.
2. Go to **Authentication → Users → Add user**.
3. Create the teacher using the intended teacher email and set a password. Keep the email/password and class roster in a private channel; do not add them to this public repository.
4. Copy the user's **UID** from the Users list.
5. In **SQL Editor**, run this statement after replacing the sample UUID:

   ```sql
   insert into public.hris_admins (user_id)
   values ('PASTE-TEACHER-USER-UID-HERE');
   ```

If Supabase reports a duplicate key for `hris_admins_pkey`, that UID already has teacher access; do not insert it again.

## 4. Add five students and issue access codes

1. Open the site, choose **Teacher**, and sign in with the teacher email and password.
2. Select **Manage students**.
3. Open **Manage student records**. Add each student's ID and display name from your private class roster. Personal roster details are deliberately not stored in this public repository.

   Add all five student records individually in the teacher dashboard. Each record shows reading completion, practice rounds, answer accuracy, and the last progress sync. Use **Edit name**, **Deactivate/Reactivate**, and **Delete record** to manage it. Deactivating immediately revokes the student's active session; deleting permanently removes the record and cascades to its progress and sessions.

4. Click **Issue code** beside each student. Copy the `ENG-...` code and send it privately to that student. The code is displayed once.
5. Students choose **Student** and sign in with the access code. Their Student ID is a roster identifier, not the login code.
6. If a code is exposed, click **Replace code**. The old code and its active session are revoked.

## 5. Data and access notes

- Student reading progress, quiz results, missed questions, card reviews, and writing drafts are saved through Supabase RPC functions.
- RLS restricts roster and progress reads to the teacher. Student code login and progress RPCs validate a server-side session token.
- Public sign-up stays disabled. Teacher access is granted by UID in `hris_admins`.
- The browser uses only the Supabase publishable key in `supabase-config.js`. Never put a Supabase secret or service-role key in this project.
- This is a practice app: answers and explanations are shown after a learner chooses an option. Do not use its client-side question bank as a secure high-stakes exam.

## 6. Deploy to Vercel

1. Push the project to the connected GitHub repository.
2. In Vercel, import the repository and use the **Other** framework preset.
3. Serve the repository root; no build command is needed for this static site.
4. Wait for the deployment to finish, open the Vercel URL, and hard-refresh with `Ctrl+Shift+R`.
5. Confirm `supabase-config.js` contains the right project URL and its publishable key. The key may be public; secret keys may not.
