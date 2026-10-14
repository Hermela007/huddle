import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabase";
import { fetchMembers, type Member } from "../lib/members";
import { amountError, parsePoundsToPence, splitEqually } from "../lib/money";
import { formatPence } from "../lib/format";

const WARN_ABOVE_PENCE = 100_000; // £1,000


type ExistingExpense = {
  description: string;
  amount_pence: number;
  paid_by: string;
  spent_on: string;
  expense_participants: { user_id: string }[];
};

function todayLocal(): string {
  return new Date().toLocaleDateString("en-CA"); // "YYYY-MM-DD" in your own timezone
}

export function ExpenseForm() {
  const { tripId, expenseId } = useParams<{ tripId: string; expenseId?: string }>();
  const isEditing = Boolean(expenseId);
  const { session } = useAuth();
  const navigate = useNavigate();

  const [members, setMembers] = useState<Member[]>([]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [includedIds, setIncludedIds] = useState<string[]>([]);
  const [spentOn, setSpentOn] = useState(todayLocal());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tripId || !session) return;
    const id = tripId;
    const myId = session.user.id;

    async function load() {
      try {
        const memberList = await fetchMembers(id);
        setMembers(memberList);

        if (expenseId) {
          const { data, error } = await supabase
            .from("expenses")
            .select("description, amount_pence, paid_by, spent_on, expense_participants(user_id)")
            .eq("id", expenseId)
            .single();
          if (error) throw error;

          const existing = data as unknown as ExistingExpense;
          setDescription(existing.description);
          setAmount((existing.amount_pence / 100).toFixed(2));
          setPaidBy(existing.paid_by);
          setSpentOn(existing.spent_on);
          setIncludedIds(existing.expense_participants.map((p) => p.user_id));
        } else {
          setPaidBy(myId);
          setIncludedIds(memberList.map((m) => m.userId));
        }
      } catch (err) {
        setError((err as { message?: string }).message ?? "Couldn't load the expense");
      }
      setLoading(false);
    }

    load();
  }, [tripId, expenseId, session]);

  function toggleIncluded(userId: string) {
    setIncludedIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!tripId) return;
    setError(null);

    const problem = amountError(amount);
    if (problem) {
      setError(problem);
      return;
    }
    const amountPence = parsePoundsToPence(amount)!;
    if (amountPence > WARN_ABOVE_PENCE && !confirm(`That's ${formatPence(amountPence)}. Is that right?`)) {
      return;
    }

    // Keep JOIN ORDER: filter the members list (already sorted) instead of using includedIds directly
    const orderedIncluded = members
      .filter((m) => includedIds.includes(m.userId))
      .map((m) => m.userId);

    if (orderedIncluded.length === 0) {
      setError("Tick at least one person to share this expense");
      return;
    }

    const shares = splitEqually(amountPence, orderedIncluded);

    setSaving(true);
    const { error } = await supabase.rpc("save_expense", {
      p_trip_id: tripId,
      p_expense_id: expenseId ?? null,
      p_description: description,
      p_amount_pence: amountPence,
      p_paid_by: paidBy,
      p_spent_on: spentOn,
      p_shares: Object.entries(shares).map(([user_id, share_pence]) => ({ user_id, share_pence })),
    });
    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }
    navigate(`/trips/${tripId}`);
  }

  async function handleDelete() {
    if (!expenseId || !tripId) return;
    if (!confirm("Delete this expense? This can't be undone.")) return;

    setSaving(true);
    const { data, error } = await supabase.from("expenses").delete().eq("id", expenseId).select("id");
    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }
    if (!data || data.length === 0) {
      setError("You're not allowed to delete this expense");
      return;
    }
    navigate(`/trips/${tripId}`);
  }

  if (loading) return <p>Loading…</p>;

  return (
    <main>
      <Link to={`/trips/${tripId}`}>← Back to trip</Link>
      <h1>{isEditing ? "Edit expense" : "Add expense"}</h1>

      <form onSubmit={handleSubmit}>
        <label>
          What was it for?
          <input value={description} onChange={(e) => setDescription(e.target.value)} required maxLength={100} />
        </label>

        <label>
          Amount (£)
          <input inputMode="decimal" placeholder="12.50" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </label>

        <label>
          Paid by
          <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.displayName}
                {m.userId === session?.user.id ? " (you)" : ""}
              </option>
            ))}
          </select>
        </label>

        <fieldset>
          <legend>Split equally between</legend>
          {members.map((m) => (
            <label key={m.userId}>
              <input type="checkbox" checked={includedIds.includes(m.userId)} onChange={() => toggleIncluded(m.userId)} />
              {m.displayName}
            </label>
          ))}
        </fieldset>

        <label>
          Date
          <input type="date" value={spentOn} onChange={(e) => setSpentOn(e.target.value)} required />
        </label>

        {error && <p role="alert">{error}</p>}

        <button type="submit" disabled={saving}>
          {saving ? "Saving…" : isEditing ? "Save changes" : "Add expense"}
        </button>
        {isEditing && (
          <button type="button" onClick={handleDelete} disabled={saving}>
            Delete expense
          </button>
        )}
      </form>
    </main>
  );
}