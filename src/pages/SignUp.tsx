import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { supabase } from "../lib/supabase";
import { ErrorMessage, PageShell } from "../components/ui";
import { btnPrimary, h1, input, label } from "../lib/styles";

export function SignUp() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Set when Supabase needs the user to confirm their email before logging in
  const [sentTo, setSentTo] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/trips";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName.trim() },
        // The confirmation link brings them back to where they were heading
        // (e.g. an invite link), not just the home page
        emailRedirectTo: `${window.location.origin}${from}`,
      },
    });

    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    // No session means "Confirm email" is on: they must click the link first
    if (!data.session) {
      setSentTo(email);
      return;
    }
    navigate(from, { replace: true });
  }

  if (sentTo) {
    return (
      <PageShell>
        <span className="pt-6 text-2xl font-extrabold tracking-tight text-coral">huddle</span>
        <div className="flex flex-col gap-1.5">
          <h1 className={h1}>Check your email</h1>
          <p className="text-[15px] text-muted">
            We sent a confirmation link to <span className="font-bold text-ink">{sentTo}</span>. Click it to finish
            creating your account. It might be in your spam folder.
          </p>
        </div>
        <p className="text-center text-[15px] text-muted">
          Already confirmed?{" "}
          <Link to="/login" state={{ from }} className="font-bold text-coral">
            Log in
          </Link>
        </p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <span className="pt-6 text-2xl font-extrabold tracking-tight text-coral">huddle</span>
      <div className="flex flex-col gap-1.5">
        <h1 className={h1}>Create your account</h1>
        <p className="text-[15px] text-muted">Plan trips and split costs with friends.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className={label}>
          Your name
          <input className={input} autoComplete="given-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required maxLength={40} />
          <span className="text-[13px] font-medium text-muted">This is what your friends will see.</span>
        </label>
        <label className={label}>
          Email
          <input className={input} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className={label}>
          Password
          <input className={input} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          <span className="text-[13px] font-medium text-muted">At least 6 characters.</span>
        </label>
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <button type="submit" disabled={submitting} className={btnPrimary}>
          {submitting ? "Creating account…" : "Sign up"}
        </button>
      </form>

      <p className="text-center text-[15px] text-muted">
        Already have an account?{" "}
        <Link to="/login" state={{ from }} className="font-bold text-coral">
          Log in
        </Link>
      </p>
    </PageShell>
  );
}
