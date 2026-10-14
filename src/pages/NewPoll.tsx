import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { supabase } from "../lib/supabase";
import { MAX_OPTIONS, MIN_OPTIONS, pollFormError } from "../lib/polls";

export function NewPoll() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function updateOption(index: number, value: string) {
    setOptions((current) => current.map((o, i) => (i === index ? value : o)));
  }

  function addOption() {
    setOptions((current) => [...current, ""]);
  }

  function removeOption(index: number) {
    setOptions((current) => current.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!tripId) return;

    const problem = pollFormError(question, options);
    if (problem) {
      setError(problem);
      return;
    }

    setError(null);
    setSaving(true);
    const { error } = await supabase.rpc("create_poll", {
      p_trip_id: tripId,
      p_question: question,
      p_options: options,
    });
    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }
    navigate(`/trips/${tripId}?tab=polls`);
  }

  return (
    <main>
      <Link to={`/trips/${tripId}?tab=polls`}>← Back to trip</Link>
      <h1>New poll</h1>

      <form onSubmit={handleSubmit}>
        <label>
          Question
          <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Which weekend works?" maxLength={200} />
        </label>

        <fieldset>
          <legend>Options</legend>
          {options.map((option, i) => (
            <div key={i}>
              <input
                value={option}
                onChange={(e) => updateOption(i, e.target.value)}
                placeholder={`Option ${i + 1}`}
                aria-label={`Option ${i + 1}`}
                maxLength={100}
              />
              {options.length > MIN_OPTIONS && (
                <button type="button" onClick={() => removeOption(i)}>
                  Remove
                </button>
              )}
            </div>
          ))}
          {options.length < MAX_OPTIONS && (
            <button type="button" onClick={addOption}>
              + Add option
            </button>
          )}
        </fieldset>

        {error && <p role="alert">{error}</p>}

        <button type="submit" disabled={saving}>
          {saving ? "Creating…" : "Create poll"}
        </button>
      </form>
    </main>
  );
}