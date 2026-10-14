import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabase";
import { fetchMembers, type Member } from "../lib/members";
import { computeBalances, settleUp, type Expense, type Payment, type Transfer } from "../lib/money";
import { formatPence } from "../lib/format";

type ExpenseRow = {
  amount_pence: number;
  paid_by: string;
  expense_participants: { user_id: string; share_pence: number }[];
};

type PaymentRow = {
  id: string;
  from_user: string;
  to_user: string;
  amount_pence: number;
  created_at: string;
};

export function BalancesTab({ tripId }: { tripId: string }) {
  const { session } = useAuth();
  const myId = session?.user.id;

  const [members, setMembers] = useState<Member[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [plan, setPlan] = useState<Transfer[]>([]);
  const [history, setHistory] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0); // bump this to reload after a change

  useEffect(() => {
    async function load() {
      try {
        const [memberList, expensesRes, paymentsRes] = await Promise.all([
          fetchMembers(tripId),
          supabase
            .from("expenses")
            .select("amount_pence, paid_by, expense_participants(user_id, share_pence)")
            .eq("trip_id", tripId),
          supabase
            .from("payments")
            .select("id, from_user, to_user, amount_pence, created_at")
            .eq("trip_id", tripId)
            .order("created_at", { ascending: false }),
        ]);
        if (expensesRes.error) throw expensesRes.error;
        if (paymentsRes.error) throw paymentsRes.error;

        const expenseRows = expensesRes.data as unknown as ExpenseRow[];
        const paymentRows = paymentsRes.data as PaymentRow[];

        // Convert database rows into the shapes your money module expects
        const expenses: Expense[] = expenseRows.map((e) => ({
          amountPence: e.amount_pence,
          paidBy: e.paid_by,
          shares: Object.fromEntries(e.expense_participants.map((p) => [p.user_id, p.share_pence])),
        }));
        const payments: Payment[] = paymentRows.map((p) => ({
          from: p.from_user,
          to: p.to_user,
          amountPence: p.amount_pence,
        }));

        // Members are in join order, so balances (and the plan) are always built in the same order
        const newBalances = computeBalances(memberList.map((m) => m.userId), expenses, payments);

        setMembers(memberList);
        setBalances(newBalances);
        setPlan(settleUp(newBalances));
        setHistory(paymentRows);
        setError(null);
      } catch (err) {
        setError((err as { message?: string }).message ?? "Couldn't load balances");
      }
      setLoading(false);
    }

    load();
  }, [tripId, version]);

  const nameOf = (userId: string) => members.find((m) => m.userId === userId)?.displayName ?? "Unknown";
  const involvesMe = (t: { from: string; to: string }) => t.from === myId || t.to === myId;

  // "You pay Sam £5.00" / "Jo pays you £12.50" / "Jo pays Sam £3.00"
  function describeTransfer(t: Transfer): string {
    const payer = t.from === myId ? "You pay" : `${nameOf(t.from)} pays`;
    const receiver = t.to === myId ? "you" : nameOf(t.to);
    return `${payer} ${receiver} ${formatPence(t.amountPence)}`;
  }

  function describePayment(p: PaymentRow): string {
    const payer = p.from_user === myId ? "You paid" : `${nameOf(p.from_user)} paid`;
    const receiver = p.to_user === myId ? "you" : nameOf(p.to_user);
    const date = new Date(p.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    return `${payer} ${receiver} ${formatPence(p.amount_pence)} · ${date}`;
  }

  function describeBalance(pence: number): string {
    if (pence > 0) return `is owed ${formatPence(pence)}`;
    if (pence < 0) return `owes ${formatPence(-pence)}`;
    return "is settled up";
  }

  async function markAsPaid(t: Transfer) {
    const ok = confirm(`Record that ${nameOf(t.from)} paid ${nameOf(t.to)} ${formatPence(t.amountPence)}?`);
    if (!ok) return;

    setBusy(true);
    const { error } = await supabase.from("payments").insert({
      trip_id: tripId,
      from_user: t.from,
      to_user: t.to,
      amount_pence: t.amountPence,
    });
    setBusy(false);

    if (error) {
      setError(error.message);
      return;
    }
    setVersion((v) => v + 1);
  }

  async function undoPayment(p: PaymentRow) {
    const ok = confirm(`Undo "${describePayment(p)}"? Balances will go back to how they were.`);
    if (!ok) return;

    setBusy(true);
    const { data, error } = await supabase.from("payments").delete().eq("id", p.id).select("id");
    setBusy(false);

    if (error) {
      setError(error.message);
      return;
    }
    if (!data || data.length === 0) {
      setError("You can only undo payments you sent or received");
      return;
    }
    setVersion((v) => v + 1);
  }

  if (loading) return <p>Loading balances…</p>;
  if (error) return <p role="alert">{error}</p>;

  const myBalance = myId ? balances[myId] ?? 0 : 0;
  // Your own payments first; sort is stable, so the rest keep settleUp's order
  const sortedPlan = [...plan].sort((a, b) => Number(involvesMe(b)) - Number(involvesMe(a)));

  return (
    <section>
      <h2>
        {myBalance > 0 && `You're owed ${formatPence(myBalance)}`}
        {myBalance < 0 && `You owe ${formatPence(-myBalance)} in total`}
        {myBalance === 0 && "You're all settled up"}
      </h2>

      <h3>Everyone</h3>
      <ul>
        {members.map((m) => (
          <li key={m.userId}>
            {m.userId === myId ? (
              <strong>You {describeBalance(balances[m.userId] ?? 0).replace("is ", "are ")}</strong>
            ) : (
              `${m.displayName} ${describeBalance(balances[m.userId] ?? 0)}`
            )}
          </li>
        ))}
      </ul>

      <h3>Settle up</h3>
      {sortedPlan.length === 0 ? (
        <p>Everyone's settled up! 🎉</p>
      ) : (
        <ul>
          {sortedPlan.map((t) => (
            <li key={`${t.from}-${t.to}`}>
              {describeTransfer(t)}
              {involvesMe(t) && (
                <>
                  {" "}
                  <button onClick={() => markAsPaid(t)} disabled={busy}>
                    Mark as paid
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <h3>Payment history</h3>
      {history.length === 0 ? (
        <p>No payments recorded yet.</p>
      ) : (
        <ul>
          {history.map((p) => (
            <li key={p.id}>
              {describePayment(p)}
              {involvesMe({ from: p.from_user, to: p.to_user }) && (
                <>
                  {" "}
                  <button onClick={() => undoPayment(p)} disabled={busy}>
                    Undo
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}