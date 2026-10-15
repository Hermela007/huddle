import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabase";
import { fetchMembers, type Member } from "../lib/members";
import { computeBalances, settleUp, type Expense, type Payment, type Transfer } from "../lib/money";
import { formatPence } from "../lib/format";
import { Avatar, ErrorMessage, LoadingRows } from "./ui";
import { btnQuiet, btnText, h2 } from "../lib/styles";

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
  const [tripTotal, setTripTotal] = useState(0);
  const [myShareTotal, setMyShareTotal] = useState(0);
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
        setTripTotal(expenses.reduce((sum, e) => sum + e.amountPence, 0));
        setMyShareTotal(expenses.reduce((sum, e) => sum + (myId ? e.shares[myId] ?? 0 : 0), 0));
        setError(null);
      } catch (err) {
        setError((err as { message?: string }).message ?? "Couldn't load balances");
      }
      setLoading(false);
    }

    load();
  }, [tripId, version, myId]);

  const nameOf = (userId: string) => members.find((m) => m.userId === userId)?.displayName ?? "Unknown";
  const involvesMe = (t: { from: string; to: string }) => t.from === myId || t.to === myId;

  // "You pay Sam" / "Jo pays you" / "Jo pays Sam" (the amount is shown separately)
  function describeTransfer(t: Transfer): string {
    const payer = t.from === myId ? "You pay" : `${nameOf(t.from)} pays`;
    const receiver = t.to === myId ? "you" : nameOf(t.to);
    return `${payer} ${receiver}`;
  }

  function describePayment(p: PaymentRow): string {
    const payer = p.from_user === myId ? "You paid" : `${nameOf(p.from_user)} paid`;
    const receiver = p.to_user === myId ? "you" : nameOf(p.to_user);
    return `${payer} ${receiver} ${formatPence(p.amount_pence)}`;
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

  if (loading) return <LoadingRows count={4} />;
  if (error) return <ErrorMessage>{error}</ErrorMessage>;

  const myBalance = myId ? balances[myId] ?? 0 : 0;
  // Your own payments first; sort is stable, so the rest keep settleUp's order
  const sortedPlan = [...plan].sort((a, b) => Number(involvesMe(b)) - Number(involvesMe(a)));

  return (
    <section className="flex flex-col gap-5">
      {/* Your summary */}
      <div className="flex flex-col gap-0.5 rounded-card bg-coral-soft px-5 py-4">
        <span className="text-sm font-semibold text-muted">
          {myBalance > 0 ? "You're owed" : myBalance < 0 ? "You owe" : "You're all settled up"}
        </span>
        {myBalance !== 0 && (
          <span className="text-[38px] font-extrabold leading-tight tracking-tight tabular-nums">
            {formatPence(Math.abs(myBalance))}
          </span>
        )}
        <span className="text-sm text-muted tabular-nums">
          Trip total {formatPence(tripTotal)} · your share {formatPence(myShareTotal)}
        </span>
      </div>

      {/* Settle-up plan */}
      <div className="flex flex-col gap-2">
        <h2 className={h2}>Settle up</h2>
        {sortedPlan.length === 0 ? (
          <p className="rounded-card bg-surface px-4 py-4 text-[15px] font-semibold">Everyone's settled up!</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sortedPlan.map((t, i) => {
              const other = t.from === myId ? t.to : t.from;
              return (
                <li key={`${t.from}-${t.to}-${i}`} className="flex items-center gap-3 rounded-card bg-surface py-1.5 pl-3 pr-1.5">
                  <Avatar name={nameOf(other)} seed={other} size={34} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm text-muted">{describeTransfer(t)}</span>
                    <span className="text-base font-bold tabular-nums">{formatPence(t.amountPence)}</span>
                  </div>
                  {t.to === myId ? (
                    <button type="button" onClick={() => markAsPaid(t)} disabled={busy} className={btnQuiet}>
                      Mark received
                    </button>
                  ) : (
                    <span className="h-11" />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Everyone's balance */}
      <div className="flex flex-col gap-1">
        <h2 className={`${h2} mb-1`}>Everyone</h2>
        {members.map((m) => {
          const pence = balances[m.userId] ?? 0;
          const colour = pence > 0 ? "text-owed" : pence < 0 ? "text-owes" : "text-muted";
          const isMe = m.userId === myId;
          return (
            <div key={m.userId} className="flex min-h-8 items-center justify-between text-[15px]">
              <span className={isMe ? "font-bold" : "font-medium"}>{isMe ? "You" : m.displayName}</span>
              <span className={`font-semibold tabular-nums ${colour}`}>
                {isMe ? describeBalance(pence).replace("is ", "are ") : describeBalance(pence)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Payment history */}
      <div className="flex flex-col gap-1">
        <h2 className={`${h2} mb-1`}>Payment history</h2>
        {history.length === 0 ? (
          <p className="text-[15px] text-muted">No payments recorded yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-divider">
            {history.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-1.5">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-[15px] font-medium tabular-nums">{describePayment(p)}</span>
                  <span className="text-[13px] text-muted">
                    {new Date(p.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </span>
                </div>
                {involvesMe({ from: p.from_user, to: p.to_user }) && (
                  <button type="button" onClick={() => undoPayment(p)} disabled={busy} className={btnText}>
                    Undo
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
