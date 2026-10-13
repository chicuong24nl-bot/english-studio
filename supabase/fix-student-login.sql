-- Apply this once in Supabase SQL Editor to fix code login on existing projects.
-- Supabase installs pgcrypto in the extensions schema; qualify it because these
-- SECURITY DEFINER functions intentionally use a restricted search_path.

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
