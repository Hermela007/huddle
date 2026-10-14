import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabase";
import { fetchMembers, type Member } from "../lib/members";
import { formatDate, formatPence } from "../lib/format";

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

  if (loading) return <p>Loading expenses…</p>;
  if (error) return <p role="alert">{error}</p>;

  return (
    <section>
      <Link to={`/trips/${tripId}/expenses/new`}>+ Add expense</Link>
      <p>
        Trip total: {formatPence(tripTotal)} · Your share: {formatPence(myShareTotal)}
      </p>

      {expenses.length === 0 ? (
        <p>No expenses yet.</p>
      ) : (
        <ul>
          {expenses.map((e) => {
            const myShare = myShareOf(e);
            const canEdit = e.created_by === myId || organiserId === myId;
            return (
              <li key={e.id}>
                <strong>{e.description}</strong> · {formatPence(e.amount_pence)} · {formatDate(e.spent_on)}
                <br />
                Paid by {e.paid_by === myId ? "you" : nameOf(e.paid_by)} ·{" "}
                {myShare === undefined ? "You're not included" : `Your share: ${formatPence(myShare)}`}
                {canEdit && (
                  <>
                    {" "}· <Link to={`/trips/${tripId}/expenses/${e.id}/edit`}>Edit</Link>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}