drop policy "Members can add expenses" on public.expenses;
drop policy "Creator or organiser can edit expense" on public.expenses;
drop policy "Creator or organiser can add shares" on public.expense_participants;
drop policy "Creator or organiser can remove shares" on public.expense_participants;

create or replace function public.save_expense(
  p_trip_id uuid, p_expense_id uuid, p_description text, p_amount_pence integer,
  p_paid_by uuid, p_spent_on date, p_shares jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_expense_id uuid;
  v_total bigint;
  v_count integer;
begin
  if v_me is null then raise exception 'You must be logged in'; end if;
  if not public.is_member(p_trip_id, v_me) then raise exception 'You are not in this trip'; end if;
  if not public.is_member(p_trip_id, p_paid_by) then raise exception 'The payer must be in this trip'; end if;

  select coalesce(sum((s ->> 'share_pence')::integer), 0), count(*)
    into v_total, v_count
  from jsonb_array_elements(p_shares) as s;

  if v_count = 0 then raise exception 'At least one person must share the expense'; end if;
  if v_total <> p_amount_pence then
    raise exception 'Shares (%p) must add up to the amount (%p)', v_total, p_amount_pence;
  end if;
  if exists (select 1 from jsonb_array_elements(p_shares) as s
             where not public.is_member(p_trip_id, (s ->> 'user_id')::uuid)) then
    raise exception 'Everyone sharing the expense must be in this trip';
  end if;

  if p_expense_id is null then
    insert into public.expenses (trip_id, description, amount_pence, paid_by, spent_on, created_by)
    values (p_trip_id, trim(p_description), p_amount_pence, p_paid_by, p_spent_on, v_me)
    returning id into v_expense_id;
  else
    update public.expenses
       set description = trim(p_description), amount_pence = p_amount_pence,
           paid_by = p_paid_by, spent_on = p_spent_on
     where id = p_expense_id and trip_id = p_trip_id
       and (created_by = v_me or public.is_trip_organiser(p_trip_id))
    returning id into v_expense_id;

    if v_expense_id is null then
      raise exception 'Expense not found, or you are not allowed to edit it';
    end if;
    delete from public.expense_participants where expense_id = v_expense_id;
  end if;

  insert into public.expense_participants (expense_id, user_id, share_pence)
  select v_expense_id, (s ->> 'user_id')::uuid, (s ->> 'share_pence')::integer
  from jsonb_array_elements(p_shares) as s;

  return v_expense_id;
end;
$$;

drop policy "Sender or receiver can record payment" on public.payments;
create policy "Receiver confirms payment" on public.payments
  for insert to authenticated
  with check (
    to_user = auth.uid()
    and public.is_trip_member(trip_id)
    and public.is_member(trip_id, from_user)
  );