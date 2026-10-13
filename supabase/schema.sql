-- PROFILES: one row per user (extra info Supabase Auth doesn't store)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

-- TRIPS
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date,
  end_date date,
  organiser_id uuid not null references public.profiles (id),
  invite_code text not null unique default left(replace(gen_random_uuid()::text, '-', ''), 10),
  created_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

-- TRIP_MEMBERS: who is in which trip
create table public.trip_members (
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

-- EXPENSES
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  description text not null,
  amount_pence integer not null check (amount_pence > 0),
  paid_by uuid not null references public.profiles (id),
  created_by uuid not null default auth.uid() references public.profiles (id),
  spent_on date not null default current_date,
  created_at timestamptz not null default now()
);

-- EXPENSE_PARTICIPANTS: who shares each expense, and their share
create table public.expense_participants (
  expense_id uuid not null references public.expenses (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  share_pence integer not null check (share_pence >= 0),
  primary key (expense_id, user_id)
);

-- PAYMENTS: "mark as paid"
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  from_user uuid not null references public.profiles (id),
  to_user uuid not null references public.profiles (id),
  amount_pence integer not null check (amount_pence > 0),
  created_at timestamptz not null default now(),
  check (from_user <> to_user)
);

-- POLLS
create table public.polls (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  question text not null,
  created_by uuid not null default auth.uid() references public.profiles (id),
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls (id) on delete cascade,
  label text not null
);

create table public.poll_votes (
  poll_id uuid not null references public.polls (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  option_id uuid not null references public.poll_options (id) on delete cascade,
  primary key (poll_id, user_id)
);

-- Lock every table. With RLS on and no policies yet, nobody can read or write.
-- Part C adds the rules for who can do what.
alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_participants enable row level security;
alter table public.payments enable row level security;
alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;

-- Create a profile automatically whenever someone signs up
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', 'New user'));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();