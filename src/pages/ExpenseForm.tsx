import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabase";
import { fetchMembers, type Member } from "../lib/members";
import { amountError, parsePoundsToPence, splitEqually } from "../lib/money";
import { formatPence } from "../lib/format";
import { BackLink, ErrorMessage, LoadingRows, PageShell } from "../components/ui";
import { btnDanger, btnPrimary, chip, h1Small, input, label } from "../lib/styles";

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

  // Keep JOIN ORDER: filter the members list (already sorted) instead of using includedIds directly
  const orderedIncluded = members.filter((m) => includedIds.includes(m.userId)).map((m) => m.userId);

  // Live preview of each person's share, using the same splitEqually that saves it
  const previewPence = amountError(amount) === null ? parsePoundsToPence(amount) : null;
  const previewShares: Record<string, number> =
    previewPence !== null && orderedIncluded.length > 0 ? splitEqually(previewPence, orderedIncluded) : {};

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

  if (loading) {
    return (
      <PageShell>
        <LoadingRows count={4} />
      </PageShell>
    );
  }

  const myId = session?.user.id;
  const eachText =
    previewPence !== null && orderedIncluded.length > 0
      ? `${formatPence(Math.floor(previewPence / orderedIncluded.length))} each · split ${orderedIncluded.length} ${orderedIncluded.length === 1 ? "way" : "ways"}`
      : "Typed in pounds, like 12.50";

  return (
    <PageShell>
      <BackLink to={`/trips/${tripId}`}>Back to trip</BackLink>
      <h1 className={h1Small}>{isEditing ? "Edit expense" : "Add expense"}</h1>

      <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4">
        <label className={label}>
          Amount
          <span className="flex h-16 items-center gap-1.5 rounded-card bg-surface px-4 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-coral">
            <span aria-hidden="true" className="text-[30px] font-bold text-muted">£</span>
            <input
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="w-full min-w-0 bg-transparent text-[30px] font-extrabold tabular-nums text-ink outline-none placeholder:text-muted/50"
            />
          </span>
          <span className="text-[13px] font-medium text-muted tabular-nums">{eachText}</span>
        </label>

        <label className={label}>
          What was it for?
          <input className={input} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Dinner, train tickets…" required maxLength={100} />
        </label>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Paid by</legend>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => {
              const active = paidBy === m.userId;
              return (
                <button
                  key={m.userId}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setPaidBy(m.userId)}
                  className={`${chip} ${active ? "border-coral bg-coral text-white" : "border-surface bg-surface text-ink"}`}
                >
                  {m.userId === myId ? "You" : m.displayName}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Split equally between</legend>
          <div className="flex flex-col divide-y divide-divider overflow-hidden rounded-card bg-surface">
            {members.map((m) => {
              const included = includedIds.includes(m.userId);
              return (
                <label key={m.userId} className="flex h-11 items-center gap-3 px-3.5 text-[15px] font-medium">
                  <input type="checkbox" checked={included} onChange={() => toggleIncluded(m.userId)} className="size-5 accent-coral" />
                  <span className="flex-1">{m.userId === myId ? "You" : m.displayName}</span>
                  <span className="text-muted tabular-nums">
                    {included && previewShares[m.userId] !== undefined ? formatPence(previewShares[m.userId]) : ""}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <label className={label}>
          Date
          <input className={input} type="date" value={spentOn} onChange={(e) => setSpentOn(e.target.value)} required />
        </label>

        {error && <ErrorMessage>{error}</ErrorMessage>}

        <div className="mt-auto flex flex-col gap-1 pt-2">
          <button type="submit" disabled={saving} className={btnPrimary}>
            {saving ? "Saving…" : isEditing ? "Save changes" : "Add expense"}
          </button>
          {isEditing && (
            <button type="button" onClick={handleDelete} disabled={saving} className={`${btnDanger} self-center`}>
              Delete expense
            </button>
          )}
        </div>
      </form>
    </PageShell>
  );
}
