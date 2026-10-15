import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { supabase } from "../lib/supabase";
import { ErrorMessage, PageShell } from "../components/ui";
import { btnPrimary, h1, input, label } from "../lib/styles";

export function LogIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/trips";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    navigate(from, { replace: true });
  }

  return (
    <PageShell>
      <span className="pt-6 text-2xl font-extrabold tracking-tight text-coral">huddle</span>
      <div className="flex flex-col gap-1.5">
        <h1 className={h1}>Welcome back</h1>
        <p className="text-[15px] text-muted">Log in to see your trips.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className={label}>
          Email
          <input className={input} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className={label}>
          Password
          <input className={input} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <button type="submit" disabled={submitting} className={btnPrimary}>
          {submitting ? "Logging in…" : "Log in"}
        </button>
      </form>

      <p className="text-center text-[15px] text-muted">
        New here?{" "}
        <Link to="/signup" state={{ from }} className="font-bold text-coral">
          Create an account
        </Link>
      </p>
    </PageShell>
  );
}
