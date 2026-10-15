import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { supabase } from "../lib/supabase";
import { ErrorMessage, PageShell, Skeleton, TripCover } from "../components/ui";
import { btnPrimary, btnQuiet, h1Small } from "../lib/styles";

type Preview = { id: string; name: string; organiser_name: string };

export function JoinTrip() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    const inviteCode = code;

    async function load() {
      const { data, error } = await supabase.rpc("get_trip_by_code", { code: inviteCode });
      if (error) {
        setError(error.message);
      } else {
        setPreview((data as Preview[] | null)?.[0] ?? null);
      }
      setLoading(false);
    }

    load();
  }, [code]);

  async function handleJoin() {
    if (!code) return;
    setJoining(true);
    const { data, error } = await supabase.rpc("join_trip", { code });
    setJoining(false);

    if (error) {
      setError(error.message);
      return;
    }
    navigate(`/trips/${data}`, { replace: true });
  }

  if (loading) {
    return (
      <PageShell>
        <Skeleton className="mt-10 h-72" />
      </PageShell>
    );
  }

  if (!preview) {
    return (
      <PageShell>
        <span className="pt-6 text-2xl font-extrabold tracking-tight text-coral">huddle</span>
        <h1 className={h1Small}>Invite not found</h1>
        <p className="text-[15px] text-muted">This link may be wrong, or the organiser may have reset it. Ask them for a new one.</p>
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <Link to="/trips" className={btnQuiet}>
          Go to my trips
        </Link>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <span className="pt-6 text-2xl font-extrabold tracking-tight text-coral">huddle</span>
      <div className="overflow-hidden rounded-card bg-surface">
        <TripCover name={preview.name} height={120} />
        <div className="flex flex-col gap-1.5 p-5">
          <p className="text-sm font-semibold text-muted">{preview.organiser_name} invited you to</p>
          <h1 className={h1Small}>{preview.name}</h1>
        </div>
      </div>
      <p className="text-[15px] text-muted">Join to see the trip, add expenses, split costs and vote on plans together.</p>
      {error && <ErrorMessage>{error}</ErrorMessage>}
      <button type="button" onClick={handleJoin} disabled={joining} className={btnPrimary}>
        {joining ? "Joining…" : "Join trip"}
      </button>
    </PageShell>
  );
}
