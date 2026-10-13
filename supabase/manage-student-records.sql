-- Add teacher-only student record management RPCs to an existing English Studio database.
-- Run this once in Supabase SQL Editor after deploying the matching app version.

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
  delete from public.student_accounts where student_no=p_student_no;
  if not found then raise exception 'Student record not found'; end if;
  return jsonb_build_object('deleted',true,'student_no',p_student_no);
end; $$;

revoke all on function public.admin_update_student(text,text) from public;
revoke all on function public.admin_set_student_active(text,boolean) from public;
revoke all on function public.admin_delete_student(text) from public;
grant execute on function public.admin_update_student(text,text) to authenticated;
grant execute on function public.admin_set_student_active(text,boolean) to authenticated;
grant execute on function public.admin_delete_student(text) to authenticated;
