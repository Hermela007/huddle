import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { supabase } from "../lib/supabase";

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

  if (loading) return <p>Loading invite…</p>;

  if (!preview) {
    return (
      <main>
        <h1>Invite not found</h1>
        <p>This link may be wrong, or the organiser may have reset it.</p>
        {error && <p role="alert">{error}</p>}
        <Link to="/trips">Go to my trips</Link>
      </main>
    );
  }

  return (
    <main>
      <h1>Join {preview.name}?</h1>
      <p>{preview.organiser_name} invited you to plan this trip on Huddle.</p>
      {error && <p role="alert">{error}</p>}
      <button onClick={handleJoin} disabled={joining}>
        {joining ? "Joining…" : "Join trip"}
      </button>
    </main>
  );
}