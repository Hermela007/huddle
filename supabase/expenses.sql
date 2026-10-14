-- Technical limit: £20,000,000 (just under what an integer column can hold)
alter table public.expenses
  add constraint amount_max check (amount_pence <= 2000000000);

-- Save an expense and its shares in ONE transaction (all or nothing).
-- p_expense_id = null  -> create a new expense
-- p_expense_id = <id>  -> edit that expense
-- p_shares = [{"user_id": "...", "share_pence": 334}, ...]
create function public.save_expense(
  p_trip_id uuid,
  p_expense_id uuid,
  p_description text,
  p_amount_pence integer,
  p_paid_by uuid,
  p_spent_on date,
  p_shares jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_expense_id uuid;
  v_total integer;
  v_count integer;
begin
  -- 1. Check the shares before touching anything
  select coalesce(sum((s ->> 'share_pence')::integer), 0), count(*)
    into v_total, v_count
  from jsonb_array_elements(p_shares) as s;

  if v_count = 0 then
    raise exception 'At least one person must share the expense';
  end if;

  if v_total <> p_amount_pence then
    raise exception 'Shares (%p) must add up to the amount (%p)', v_total, p_amount_pence;
  end if;

  -- 2. Create or update the expense
  if p_expense_id is null then
    insert into public.expenses (trip_id, description, amount_pence, paid_by, spent_on)
    values (p_trip_id, trim(p_description), p_amount_pence, p_paid_by, p_spent_on)
    returning id into v_expense_id;
  else
    update public.expenses
       set description = trim(p_description),
           amount_pence = p_amount_pence,
           paid_by = p_paid_by,
           spent_on = p_spent_on
     where id = p_expense_id and trip_id = p_trip_id
    returning id into v_expense_id;

    if v_expense_id is null then
      raise exception 'Expense not found, or you are not allowed to edit it';
    end if;

    delete from public.expense_participants where expense_id = v_expense_id;
  end if;

  -- 3. Save the shares
  insert into public.expense_participants (expense_id, user_id, share_pence)
  select v_expense_id, (s ->> 'user_id')::uuid, (s ->> 'share_pence')::integer
  from jsonb_array_elements(p_shares) as s;

  return v_expense_id;
end;
$$;