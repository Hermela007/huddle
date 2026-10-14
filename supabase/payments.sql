-- Let the sender or receiver undo a payment recorded by mistake
create policy "Sender or receiver can undo payment" on public.payments
  for delete to authenticated
  using (from_user = auth.uid() or to_user = auth.uid());