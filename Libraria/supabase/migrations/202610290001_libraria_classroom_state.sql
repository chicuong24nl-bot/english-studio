-- Shared classroom state for Libraria's reading demo.
-- The table is intentionally private: browser clients never query it directly.
create table if not exists public.libraria_classroom_state (
  id text primary key check (id = 'main'),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.libraria_classroom_state enable row level security;
revoke all on public.libraria_classroom_state from anon, authenticated;
grant all on public.libraria_classroom_state to service_role;

insert into public.libraria_classroom_state (id, data)
values ('main', '{}'::jsonb)
on conflict (id) do nothing;

-- Atomic top-level key merge so two students saving at once do not overwrite
-- each other's progress. Only the server's secret key can execute this RPC.
create or replace function public.libraria_apply_state_patch(p_patch jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.libraria_classroom_state (id, data, updated_at)
  values ('main', coalesce(p_patch, '{}'::jsonb), now())
  on conflict (id) do update
    set data = libraria_classroom_state.data || excluded.data,
        updated_at = now();
$$;

revoke all on function public.libraria_apply_state_patch(jsonb) from public, anon, authenticated;
grant execute on function public.libraria_apply_state_patch(jsonb) to service_role;

-- Merge a student's submission fields into only that student's assignments,
-- under one row lock, so concurrent submissions cannot overwrite one another.
create or replace function public.libraria_merge_student_assignments(p_student_id text, p_updates jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  update public.libraria_classroom_state as state
  set data = jsonb_set(
    state.data,
    '{libaria-exam-assignments}',
    coalesce((
      select jsonb_agg(
        case
          when assignment.value->>'studentId' = p_student_id then
            assignment.value || coalesce((
              select
                (case when jsonb_typeof(candidate.value->'startedAt') = 'string' then jsonb_build_object('startedAt', candidate.value->'startedAt') else '{}'::jsonb end) ||
                (case when jsonb_typeof(candidate.value->'completedAt') = 'string' then jsonb_build_object('completedAt', candidate.value->'completedAt') else '{}'::jsonb end) ||
                (case when jsonb_typeof(candidate.value->'answers') = 'object' then jsonb_build_object('answers', candidate.value->'answers') else '{}'::jsonb end) ||
                (case when jsonb_typeof(candidate.value->'reviewedAt') = 'string' then jsonb_build_object('reviewedAt', candidate.value->'reviewedAt') else '{}'::jsonb end)
              from jsonb_array_elements(coalesce(p_updates, '[]'::jsonb)) as candidate(value)
              where candidate.value->>'id' = assignment.value->>'id'
                and candidate.value->>'studentId' = p_student_id
              limit 1
            ), '{}'::jsonb)
          else assignment.value
        end
      )
      from jsonb_array_elements(coalesce(state.data->'libaria-exam-assignments', '[]'::jsonb)) as assignment(value)
    ), '[]'::jsonb),
    true
  ),
  updated_at = now()
  where state.id = 'main';
$$;

revoke all on function public.libraria_merge_student_assignments(text, jsonb) from public, anon, authenticated;
grant execute on function public.libraria_merge_student_assignments(text, jsonb) to service_role;
