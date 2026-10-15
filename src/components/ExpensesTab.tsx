import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabase";
import { fetchMembers, type Member } from "../lib/members";
import { formatDate, formatPence } from "../lib/format";
import { ChevronRight, ErrorMessage, LoadingRows, PlusIcon } from "./ui";
import { btnPrimary, cardLink } from "../lib/styles";

type ExpenseRow = {
  id: string;
  description: string;
  amount_pence: number;
  paid_by: string;
  created_by: string;
  spent_on: string;
  expense_participants: { user_id: string; share_pence: number }[];
};

export function ExpensesTab({ tripId, organiserId }: { tripId: string; organiserId: string }) {
  const { session } = useAuth();
  const myId = session?.user.id;
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [memberList, expensesRes] = await Promise.all([
          fetchMembers(tripId),
          supabase
            .from("expenses")
            .select("id, description, amount_pence, paid_by, created_by, spent_on, expense_participants(user_id, share_pence)")
            .eq("trip_id", tripId)
            .order("spent_on", { ascending: false })
            .order("created_at", { ascending: false }),
        ]);
        if (expensesRes.error) throw expensesRes.error;

        setMembers(memberList);
        setExpenses(expensesRes.data as unknown as ExpenseRow[]);
      } catch (err) {
        setError((err as { message?: string }).message ?? "Couldn't load expenses");
      }
      setLoading(false);
    }

    load();
  }, [tripId]);

  const nameOf = (userId: string) => members.find((m) => m.userId === userId)?.displayName ?? "Unknown";

  const myShareOf = (e: ExpenseRow) => e.expense_participants.find((p) => p.user_id === myId)?.share_pence;

  const tripTotal = expenses.reduce((sum, e) => sum + e.amount_pence, 0);
  const myShareTotal = expenses.reduce((sum, e) => sum + (myShareOf(e) ?? 0), 0);

  if (loading) return <LoadingRows count={3} />;
  if (error) return <ErrorMessage>{error}</ErrorMessage>;

  return (
    <section className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-card bg-surface px-4 py-3">
          <p className="text-[13px] font-semibold text-muted">Trip total</p>
          <p className="text-xl font-extrabold tabular-nums">{formatPence(tripTotal)}</p>
        </div>
        <div className="rounded-card bg-surface px-4 py-3">
          <p className="text-[13px] font-semibold text-muted">Your share</p>
          <p className="text-xl font-extrabold tabular-nums">{formatPence(myShareTotal)}</p>
        </div>
      </div>

      <Link to={`/trips/${tripId}/expenses/new`} className={btnPrimary}>
        <PlusIcon />
        Add expense
      </Link>

      {expenses.length === 0 ? (
        <div className="rounded-card bg-surface px-5 py-8 text-center">
          <p className="font-bold">No expenses yet</p>
          <p className="mt-1 text-[15px] text-muted">Add the first one, like a booking or a dinner.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {expenses.map((e) => {
            const myShare = myShareOf(e);
            const canEdit = e.created_by === myId || organiserId === myId;
            const content = (
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[15px] font-semibold">{e.description}</span>
                  <span className="text-[13px] text-muted">
                    Paid by {e.paid_by === myId ? "you" : nameOf(e.paid_by)} · {formatDate(e.spent_on)}
                  </span>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="text-[15px] font-bold tabular-nums">{formatPence(e.amount_pence)}</span>
                  <span className="text-[13px] text-muted tabular-nums">
                    {myShare === undefined ? "Not included" : `You: ${formatPence(myShare)}`}
                  </span>
                </div>
                {canEdit && <ChevronRight />}
              </div>
            );
            return (
              <li key={e.id}>
                {canEdit ? (
                  <Link to={`/trips/${tripId}/expenses/${e.id}/edit`} className={cardLink}>
                    {content}
                  </Link>
                ) : (
                  <div className="rounded-card bg-surface">{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
