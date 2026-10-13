-- English Studio: student code sign-in and synced learning progress.
-- Admins and student records are added privately after setup; no personal roster data is seeded here.
create extension if not exists pgcrypto;

create table if not exists public.hris_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.student_accounts (
  student_no text primary key,
  display_name text not null,
  access_code_hash text unique,
  code_issued_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.student_sessions (
  token_hash text primary key,
  student_no text not null references public.student_accounts(student_no) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.student_progress (
  student_no text primary key references public.student_accounts(student_no) on delete cascade,
  progress jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.hris_admins enable row level security;
alter table public.student_accounts enable row level security;
alter table public.student_sessions enable row level security;
alter table public.student_progress enable row level security;

create or replace function public.hris_is_admin()
returns boolean language sql stable security definer set search_path = public, auth, pg_temp as $$
  select exists(select 1 from public.hris_admins where user_id = (select auth.uid()));
$$;
revoke all on function public.hris_is_admin() from public;
grant execute on function public.hris_is_admin() to authenticated;

drop policy if exists "Admin manages student roster" on public.student_accounts;
create policy "Admin manages student roster" on public.student_accounts
  for select to authenticated using ((select public.hris_is_admin()));
drop policy if exists "Admin views student progress" on public.student_progress;
create policy "Admin views student progress" on public.student_progress
  for select to authenticated using ((select public.hris_is_admin()));

grant usage on schema public to anon, authenticated;
grant select on public.student_accounts to authenticated;
grant select on public.student_progress to authenticated;

create or replace function public.admin_add_student(p_student_no text,p_display_name text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.hris_is_admin() then raise exception 'Admin access required'; end if;
  if coalesce(p_student_no,'') !~ '^[A-Za-z0-9_-]{3,32}$' then raise exception 'Student ID must be 3–32 letters or numbers'; end if;
  if length(trim(coalesce(p_display_name,''))) not between 1 and 100 then raise exception 'Enter a student name'; end if;
  insert into public.student_accounts(student_no,display_name) values(trim(p_student_no),trim(p_display_name));
  return jsonb_build_object('created',true,'student_no',trim(p_student_no));
end; $$;

create or replace function public.admin_set_student_code(p_student_no text,p_code_hash text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.hris_is_admin() then raise exception 'Admin access required'; end if;
  if p_code_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid code hash'; end if;
  update public.student_accounts set access_code_hash=p_code_hash,code_issued_at=now()
    where student_no=p_student_no and active;
  if not found then raise exception 'Student account not found'; end if;
  delete from public.student_sessions where student_no=p_student_no;
  return jsonb_build_object('issued',true,'student_no',p_student_no);
end; $$;

create or replace function public.student_code_login(p_code text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_student public.student_accounts; v_token text;
begin
  if length(trim(coalesce(p_code,''))) < 8 or length(trim(p_code)) > 80 then
    raise exception 'Invalid access code';
  end if;
  select * into v_student from public.student_accounts
    where access_code_hash=encode(extensions.digest(upper(trim(p_code)),'sha256'),'hex') and active;
  if not found then raise exception 'Invalid access code'; end if;
  v_token := encode(extensions.gen_random_bytes(32),'hex');
  insert into public.student_sessions(token_hash,student_no,expires_at)
    values(encode(extensions.digest(v_token,'sha256'),'hex'),v_student.student_no,now()+interval '30 days');
  return jsonb_build_object('student_no',v_student.student_no,'display_name',v_student.display_name,'session_token',v_token);
end; $$;

create or replace function public.student_load_progress(p_session_token text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_student_no text; v_progress jsonb;
begin
  select s.student_no into v_student_no from public.student_sessions s
    join public.student_accounts a on a.student_no=s.student_no
    where s.token_hash=encode(extensions.digest(coalesce(p_session_token,''),'sha256'),'hex')
      and s.expires_at>now() and a.active;
  if v_student_no is null then raise exception 'Session expired. Sign in again.'; end if;
  select progress into v_progress from public.student_progress where student_no=v_student_no;
  return coalesce(v_progress,'{}'::jsonb);
end; $$;

create or replace function public.student_save_progress(p_session_token text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_student_no text;
begin
  select s.student_no into v_student_no from public.student_sessions s
    join public.student_accounts a on a.student_no=s.student_no
    where s.token_hash=encode(extensions.digest(coalesce(p_session_token,''),'sha256'),'hex')
      and s.expires_at>now() and a.active;
  if v_student_no is null then raise exception 'Session expired. Sign in again.'; end if;
  if octet_length(coalesce(p_payload,'{}'::jsonb)::text)>1000000 then raise exception 'Progress payload is too large'; end if;
  insert into public.student_progress(student_no,progress,updated_at)
    values(v_student_no,coalesce(p_payload,'{}'::jsonb),now())
    on conflict(student_no) do update set progress=excluded.progress,updated_at=now();
  return jsonb_build_object('saved',true,'updated_at',now());
end; $$;

revoke all on function public.admin_add_student(text,text) from public;
revoke all on function public.student_code_login(text) from public;
revoke all on function public.student_load_progress(text) from public;
revoke all on function public.student_save_progress(text,jsonb) from public;
revoke all on function public.admin_set_student_code(text,text) from public;
grant execute on function public.admin_add_student(text,text) to authenticated;
grant execute on function public.student_code_login(text) to anon, authenticated;
grant execute on function public.student_load_progress(text) to anon, authenticated;
grant execute on function public.student_save_progress(text,jsonb) to anon, authenticated;
grant execute on function public.admin_set_student_code(text,text) to authenticated;
