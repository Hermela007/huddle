import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router";
import { supabase } from "../lib/supabase";
import { MAX_OPTIONS, MIN_OPTIONS, pollFormError } from "../lib/polls";
import { BackLink, ErrorMessage, PageShell, PlusIcon } from "../components/ui";
import { btnPrimary, btnQuiet, btnText, h1Small, input, label } from "../lib/styles";

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
    <PageShell>
      <BackLink to={`/trips/${tripId}?tab=polls`}>Back to trip</BackLink>
      <h1 className={h1Small}>New poll</h1>

      <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4">
        <label className={label}>
          Question
          <input className={input} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Which weekend works?" maxLength={200} />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-semibold">Options</legend>
          {options.map((option, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                className={input}
                value={option}
                onChange={(e) => updateOption(i, e.target.value)}
                placeholder={`Option ${i + 1}`}
                aria-label={`Option ${i + 1}`}
                maxLength={100}
              />
              {options.length > MIN_OPTIONS && (
                <button type="button" onClick={() => removeOption(i)} className={btnText} aria-label={`Remove option ${i + 1}`}>
                  Remove
                </button>
              )}
            </div>
          ))}
          {options.length < MAX_OPTIONS && (
            <button type="button" onClick={addOption} className={`${btnQuiet} self-start`}>
              <PlusIcon />
              Add option
            </button>
          )}
          <p className="text-[13px] font-medium text-muted">Between {MIN_OPTIONS} and {MAX_OPTIONS} options.</p>
        </fieldset>

        {error && <ErrorMessage>{error}</ErrorMessage>}

        <button type="submit" disabled={saving} className={`${btnPrimary} mt-auto`}>
          {saving ? "Creating…" : "Create poll"}
        </button>
      </form>
    </PageShell>
  );
}
