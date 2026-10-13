-- Add teacher-only student record management RPCs to an existing English Studio database.
-- Run this once in Supabase SQL Editor after deploying the matching app version.

alter table public.student_sessions
  add column if not exists last_seen_at timestamptz not null default now();
alter table public.student_sessions
  add column if not exists is_online boolean not null default false;

create or replace function public.admin_update_student(p_student_no text,p_display_name text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.hris_is_admin() then raise exception 'Teacher access required'; end if;
  if length(trim(coalesce(p_display_name,''))) not between 1 and 100 then raise exception 'Enter a student name'; end if;
  update public.student_accounts set display_name=trim(p_display_name) where student_no=p_student_no;
  if not found then raise exception 'Student record not found'; end if;
  return jsonb_build_object('updated',true,'student_no',p_student_no);
end; $$;

create or replace function public.admin_set_student_active(p_student_no text,p_active boolean)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.hris_is_admin() then raise exception 'Teacher access required'; end if;
  update public.student_accounts set active=coalesce(p_active,false) where student_no=p_student_no;
  if not found then raise exception 'Student record not found'; end if;
  if not coalesce(p_active,false) then delete from public.student_sessions where student_no=p_student_no; end if;
  return jsonb_build_object('updated',true,'active',coalesce(p_active,false),'student_no',p_student_no);
end; $$;

create or replace function public.admin_delete_student(p_student_no text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.hris_is_admin() then raise exception 'Teacher access required'; end if;
  -- Delete dependants explicitly so removal also works if older tables lack ON DELETE CASCADE.
  delete from public.student_sessions where student_no=p_student_no;
  delete from public.student_progress where student_no=p_student_no;
  delete from public.student_accounts where student_no=p_student_no;
  if not found then raise exception 'Student record not found'; end if;
  return jsonb_build_object('deleted',true,'student_no',p_student_no);
end; $$;

create or replace function public.student_heartbeat(p_session_token text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.student_sessions s set last_seen_at=now(),is_online=true
    from public.student_accounts a
    where s.student_no=a.student_no
      and s.token_hash=encode(extensions.digest(coalesce(p_session_token,''),'sha256'),'hex')
      and s.expires_at>now() and a.active;
  if not found then raise exception 'Session expired. Sign in again.'; end if;
  return jsonb_build_object('online',true,'last_seen_at',now());
end; $$;

create or replace function public.student_end_session(p_session_token text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.student_sessions set is_online=false,last_seen_at=now()
    where token_hash=encode(extensions.digest(coalesce(p_session_token,''),'sha256'),'hex');
  return jsonb_build_object('online',false);
end; $$;

create or replace function public.admin_student_presence()
returns table(student_no text,online boolean)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.hris_is_admin() then raise exception 'Teacher access required'; end if;
  return query
    select a.student_no,exists(
      select 1 from public.student_sessions s
      where s.student_no=a.student_no and s.is_online and s.expires_at>now()
        and s.last_seen_at>now()-interval '75 seconds'
    ) as online
    from public.student_accounts a;
end; $$;

revoke all on function public.admin_update_student(text,text) from public;
revoke all on function public.admin_set_student_active(text,boolean) from public;
revoke all on function public.admin_delete_student(text) from public;
revoke all on function public.student_heartbeat(text) from public;
revoke all on function public.student_end_session(text) from public;
revoke all on function public.admin_student_presence() from public;
grant execute on function public.admin_update_student(text,text) to authenticated;
grant execute on function public.admin_set_student_active(text,boolean) to authenticated;
grant execute on function public.admin_delete_student(text) to authenticated;
grant execute on function public.student_heartbeat(text) to anon, authenticated;
grant execute on function public.student_end_session(text) to anon, authenticated;
grant execute on function public.admin_student_presence() to authenticated;

notify pgrst, 'reload schema';
