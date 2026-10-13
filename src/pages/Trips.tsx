import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabase";
import { formatDates } from "../lib/format";

type TripSummary = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  trip_members: { count: number }[];
};

export function Trips() {
  const { session } = useAuth();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    const userId = session.user.id;

    async function load() {
      const [profileRes, tripsRes] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("id", userId).single(),
        supabase
          .from("trips")
          .select("id, name, start_date, end_date, trip_members(count)")
          .order("created_at", { ascending: false }),
      ]);

      setDisplayName(profileRes.data?.display_name ?? null);
      if (tripsRes.error) {
        setError(tripsRes.error.message);
      } else {
        setTrips(tripsRes.data as TripSummary[]);
      }
      setLoading(false);
    }

    load();
  }, [session]);

  return (
    <main>
      <header>
        <h1>My trips</h1>
        <p>Logged in as {displayName ?? session?.user.email}</p>
        <button onClick={() => supabase.auth.signOut()}>Log out</button>
      </header>

      <Link to="/trips/new">+ New trip</Link>

      {loading && <p>Loading trips…</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && !error && trips.length === 0 && (
        <p>No trips yet. Create one, or open an invite link from a friend.</p>
      )}

      <ul>
        {trips.map((trip) => (
          <li key={trip.id}>
            <Link to={`/trips/${trip.id}`}>{trip.name}</Link>
            <span>
              {" "}· {formatDates(trip.start_date, trip.end_date)} ·{" "}
              {trip.trip_members[0]?.count ?? 0} members
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}