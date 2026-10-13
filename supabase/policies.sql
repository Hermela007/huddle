-- =========================================================
-- HELPER FUNCTIONS
-- "security definer" = runs with admin rights, so policies can
-- check membership without getting stuck in an RLS loop.
-- =========================================================

-- Is user u a member of trip t?
create function public.is_member(t uuid, u uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = t and user_id = u
  );
$$;

-- Is the logged-in user a member of trip t?
create function public.is_trip_member(t uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_member(t, auth.uid());
$$;

-- Is the logged-in user the organiser of trip t?
create function public.is_trip_organiser(t uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.trips
    where id = t and organiser_id = auth.uid()
  );
$$;

-- =========================================================
-- PROFILES: see yourself + people you share a trip with
-- =========================================================
create policy "See own and tripmates' profiles" on public.profiles
  for select to authenticated
  using (
    profiles.id = auth.uid()
    or exists (
      select 1 from public.trip_members me
      join public.trip_members them on me.trip_id = them.trip_id
      where me.user_id = auth.uid() and them.user_id = profiles.id
    )
  );

create policy "Update own profile" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- =========================================================
-- TRIPS
-- =========================================================
create policy "Members can see trip" on public.trips
  for select to authenticated
  using (public.is_trip_member(id) or organiser_id = auth.uid());

create policy "Create a trip as yourself" on public.trips
  for insert to authenticated
  with check (organiser_id = auth.uid());

create policy "Organiser can edit trip" on public.trips
  for update to authenticated
  using (organiser_id = auth.uid())
  with check (organiser_id = auth.uid());

create policy "Organiser can delete trip" on public.trips
  for delete to authenticated
  using (organiser_id = auth.uid());

-- The organiser automatically becomes a member of their new trip
create function public.add_organiser_as_member()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.trip_members (trip_id, user_id)
  values (new.id, new.organiser_id);
  return new;
end;
$$;

create trigger on_trip_created
  after insert on public.trips
  for each row execute function public.add_organiser_as_member();

-- =========================================================
-- TRIP MEMBERS (joining goes through join_trip below)
-- =========================================================
create policy "Members can see members" on public.trip_members
  for select to authenticated
  using (public.is_trip_member(trip_id));

-- =========================================================
-- EXPENSES
-- =========================================================
create policy "Members can see expenses" on public.expenses
  for select to authenticated
  using (public.is_trip_member(trip_id));

create policy "Members can add expenses" on public.expenses
  for insert to authenticated
  with check (
    public.is_trip_member(trip_id)
    and created_by = auth.uid()
    and public.is_member(trip_id, paid_by)
  );

create policy "Creator or organiser can edit expense" on public.expenses
  for update to authenticated
  using (created_by = auth.uid() or public.is_trip_organiser(trip_id))
  with check (public.is_member(trip_id, paid_by));

create policy "Creator or organiser can delete expense" on public.expenses
  for delete to authenticated
  using (created_by = auth.uid() or public.is_trip_organiser(trip_id));

-- =========================================================
-- EXPENSE PARTICIPANTS (the shares)
-- =========================================================
create policy "Members can see shares" on public.expense_participants
  for select to authenticated
  using (exists (
    select 1 from public.expenses e
    where e.id = expense_id and public.is_trip_member(e.trip_id)
  ));

create policy "Creator or organiser can add shares" on public.expense_participants
  for insert to authenticated
  with check (exists (
    select 1 from public.expenses e
    where e.id = expense_id
      and (e.created_by = auth.uid() or public.is_trip_organiser(e.trip_id))
      and public.is_member(e.trip_id, user_id)
  ));

create policy "Creator or organiser can remove shares" on public.expense_participants
  for delete to authenticated
  using (exists (
    select 1 from public.expenses e
    where e.id = expense_id
      and (e.created_by = auth.uid() or public.is_trip_organiser(e.trip_id))
  ));

-- =========================================================
-- PAYMENTS ("mark as paid" - only the sender or receiver)
-- =========================================================
create policy "Members can see payments" on public.payments
  for select to authenticated
  using (public.is_trip_member(trip_id));

create policy "Sender or receiver can record payment" on public.payments
  for insert to authenticated
  with check (
    public.is_trip_member(trip_id)
    and (from_user = auth.uid() or to_user = auth.uid())
    and public.is_member(trip_id, from_user)
    and public.is_member(trip_id, to_user)
  );

-- =========================================================
-- POLLS
-- =========================================================
create policy "Members can see polls" on public.polls
  for select to authenticated
  using (public.is_trip_member(trip_id));

create policy "Members can create polls" on public.polls
  for insert to authenticated
  with check (public.is_trip_member(trip_id) and created_by = auth.uid());

create policy "Creator can close poll" on public.polls
  for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create policy "Members can see options" on public.poll_options
  for select to authenticated
  using (exists (
    select 1 from public.polls p
    where p.id = poll_id and public.is_trip_member(p.trip_id)
  ));

create policy "Poll creator can add options" on public.poll_options
  for insert to authenticated
  with check (exists (
    select 1 from public.polls p
    where p.id = poll_id and p.created_by = auth.uid()
  ));

create policy "Members can see votes" on public.poll_votes
  for select to authenticated
  using (exists (
    select 1 from public.polls p
    where p.id = poll_id and public.is_trip_member(p.trip_id)
  ));

create policy "Vote on open polls" on public.poll_votes
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.polls p
      where p.id = poll_id and p.closed_at is null and public.is_trip_member(p.trip_id)
    )
    and exists (
      select 1 from public.poll_options o
      where o.id = option_id and o.poll_id = poll_votes.poll_id
    )
  );

create policy "Change own vote on open polls" on public.poll_votes
  for update to authenticated
  using (
    user_id = auth.uid()
    and exists (select 1 from public.polls p where p.id = poll_id and p.closed_at is null)
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.poll_options o
      where o.id = option_id and o.poll_id = poll_votes.poll_id
    )
  );

-- =========================================================
-- JOINING BY INVITE CODE
-- =========================================================

-- Preview a trip before joining (the Join page shows its name)
create function public.get_trip_by_code(code text)
returns table (id uuid, name text, organiser_name text)
language sql stable security definer set search_path = ''
as $$
  select t.id, t.name, p.display_name
  from public.trips t
  join public.profiles p on p.id = t.organiser_id
  where t.invite_code = code;
$$;

-- Join a trip; returns the trip id so the app can open it
create function public.join_trip(code text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  found_trip uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be logged in to join a trip';
  end if;

  select id into found_trip from public.trips where invite_code = code;

  if found_trip is null then
    raise exception 'Invalid invite code';
  end if;

  insert into public.trip_members (trip_id, user_id)
  values (found_trip, auth.uid())
  on conflict do nothing;

  return found_trip;
end;
$$;