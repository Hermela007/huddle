import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabase";
import { BackLink, ErrorMessage, PageShell } from "../components/ui";
import { btnPrimary, h1Small, input, label } from "../lib/styles";

export function NewTrip() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!session) return;

    if (startDate && endDate && endDate < startDate) {
      setError("End date can't be before the start date");
      return;
    }

    setError(null);
    setSubmitting(true);

    const { data, error } = await supabase
      .from("trips")
      .insert({
        name: name.trim(),
        start_date: startDate || null,
        end_date: endDate || null,
        organiser_id: session.user.id,
      })
      .select("id")
      .single();

    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    navigate(`/trips/${data.id}`);
  }

  return (
    <PageShell>
      <BackLink to="/trips">My trips</BackLink>
      <h1 className={h1Small}>New trip</h1>

      <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4">
        <label className={label}>
          Trip name
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Lisbon long weekend" required maxLength={60} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>
            Start date
            <input className={input} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label className={label}>
            End date
            <input className={input} type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} />
          </label>
        </div>
        <p className="-mt-2 text-[13px] font-medium text-muted">Dates are optional.</p>
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <button type="submit" disabled={submitting} className={`${btnPrimary} mt-auto`}>
          {submitting ? "Creating…" : "Create trip"}
        </button>
      </form>
    </PageShell>
  );
}
