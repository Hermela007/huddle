import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabase";

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
    <main>
      <h1>New trip</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Trip name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Start date (optional)
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>
        <label>
          End date (optional)
          <input type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? "Creating…" : "Create trip"}
        </button>
      </form>
      <Link to="/trips">Cancel</Link>
    </main>
  );
}