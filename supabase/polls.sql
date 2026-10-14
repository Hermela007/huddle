-- 1. Keep options in the order they were typed
alter table public.poll_options
  add column sort_order integer not null default 0;

-- 2. Create a poll and its options in ONE transaction (all or nothing)
create function public.create_poll(
  p_trip_id uuid,
  p_question text,
  p_options text[]
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_poll_id uuid;
  v_options text[];
  v_count integer;
begin
  -- Trim every option, keeping their order
  select coalesce(array_agg(trim(o) order by i), '{}')
    into v_options
  from unnest(p_options) with ordinality as t(o, i);

  v_count := coalesce(array_length(v_options, 1), 0);

  if trim(coalesce(p_question, '')) = '' then
    raise exception 'The poll needs a question';
  end if;
  if v_count < 2 then
    raise exception 'A poll needs at least 2 options';
  end if;
  if v_count > 6 then
    raise exception 'A poll can have at most 6 options';
  end if;
  if exists (select 1 from unnest(v_options) as o where o = '') then
    raise exception 'Options can''t be blank';
  end if;
  if (select count(distinct lower(o)) from unnest(v_options) as o) <> v_count then
    raise exception 'Each option must be different';
  end if;

  insert into public.polls (trip_id, question)
  values (p_trip_id, trim(p_question))
  returning id into v_poll_id;

  insert into public.poll_options (poll_id, label, sort_order)
  select v_poll_id, o, i
  from unnest(v_options) with ordinality as t(o, i);

  return v_poll_id;
end;
$$;

-- 3. The creator OR the organiser can close a poll (replaces the creator-only rule)
drop policy "Creator can close poll" on public.polls;

create policy "Creator or organiser can close poll" on public.polls
  for update to authenticated
  using (created_by = auth.uid() or public.is_trip_organiser(trip_id))
  with check (created_by = auth.uid() or public.is_trip_organiser(trip_id));

-- 4. Closed polls are final, and polls can only ever be closed, never edited
create function public.only_allow_closing_polls()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.closed_at is not null then
    raise exception 'This poll is closed and can''t be changed';
  end if;

  if new.question is distinct from old.question
     or new.trip_id is distinct from old.trip_id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Polls can''t be edited, only closed';
  end if;

  return new;
end;
$$;

create trigger polls_only_close
  before update on public.polls
  for each row execute function public.only_allow_closing_polls();

-- 5. The creator or organiser can delete a poll (its options and votes go with it)
create policy "Creator or organiser can delete poll" on public.polls
  for delete to authenticated
  using (created_by = auth.uid() or public.is_trip_organiser(trip_id));