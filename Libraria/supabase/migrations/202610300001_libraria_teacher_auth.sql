-- A Supabase Auth user is a Libraria teacher only when explicitly allowlisted here.
create table if not exists public.libraria_teacher_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.libraria_teacher_accounts enable row level security;
revoke all on public.libraria_teacher_accounts from anon, authenticated;
grant select on public.libraria_teacher_accounts to service_role;
