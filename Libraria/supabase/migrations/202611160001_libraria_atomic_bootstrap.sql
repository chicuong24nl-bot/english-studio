create or replace function public.libraria_bootstrap_state(p_patch jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_rows integer;
begin
  insert into public.libraria_classroom_state (id, data, updated_at)
  values ('main', coalesce(p_patch, '{}'::jsonb), now())
  on conflict (id) do nothing;

  get diagnostics inserted_rows = row_count;
  return inserted_rows = 1;
end;
$$;

revoke all on function public.libraria_bootstrap_state(jsonb) from public, anon, authenticated;
grant execute on function public.libraria_bootstrap_state(jsonb) to service_role;
