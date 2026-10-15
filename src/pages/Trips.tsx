import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabase";
import { formatDates } from "../lib/format";
import { Avatar, ChevronRight, ErrorMessage, LoadingRows, PageShell, PlusIcon, TripCover } from "../components/ui";
import { btnPrimary, btnQuiet, cardLink, h1 } from "../lib/styles";

type TripSummary = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  trip_members: { user_id: string; profiles: { display_name: string } | null }[];
};

export function Trips() {
  const { session } = useAuth();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!session) return;
    const userId = session.user.id;

    async function load() {
      const [profileRes, tripsRes] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("id", userId).single(),
        supabase
          .from("trips")
          .select("id, name, start_date, end_date, trip_members(user_id, profiles(display_name))")
          .order("created_at", { ascending: false }),
      ]);

      setDisplayName(profileRes.data?.display_name ?? null);
      if (tripsRes.error) {
        setError(tripsRes.error.message);
      } else {
        setTrips(tripsRes.data as unknown as TripSummary[]);
      }
      setLoading(false);
    }

    load();
  }, [session]);

  const name = displayName ?? session?.user.email ?? "You";

  return (
    <PageShell>
      <header className="relative flex items-center justify-between">
        <span className="text-2xl font-extrabold tracking-tight text-coral">huddle</span>
        <button
          type="button"
          aria-label="Your account"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          className="flex size-11 items-center justify-center rounded-full bg-track text-base font-bold outline-none transition-transform duration-150 ease-snappy focus-visible:outline-2 focus-visible:outline-coral active:scale-[0.97]"
        >
          {name.charAt(0).toUpperCase()}
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-13 z-10 flex w-56 flex-col gap-3 rounded-card border border-line bg-white p-4 shadow-lg">
            <p className="text-sm text-muted">
              Signed in as <span className="font-semibold text-ink">{name}</span>
            </p>
            <button type="button" className={btnQuiet} onClick={() => supabase.auth.signOut()}>
              Log out
            </button>
          </div>
        )}
      </header>

      <div className="flex flex-col gap-1.5">
        <h1 className={h1}>Your trips</h1>
        {!loading && !error && (
          <p className="text-[15px] text-muted">
            {trips.length} {trips.length === 1 ? "trip" : "trips"}
          </p>
        )}
      </div>

      <Link to="/trips/new" className={btnPrimary}>
        <PlusIcon />
        New trip
      </Link>

      {loading && <LoadingRows count={3} height="h-52" />}
      {error && <ErrorMessage>{error}</ErrorMessage>}

      {!loading && !error && trips.length === 0 && (
        <div className="rounded-card bg-surface px-5 py-8 text-center">
          <p className="font-bold">No trips yet</p>
          <p className="mt-1 text-[15px] text-muted">Create one, or open an invite link from a friend.</p>
        </div>
      )}

      <div className="flex flex-col gap-3.5">
        {trips.map((trip) => {
          const members = trip.trip_members;
          return (
            <Link key={trip.id} to={`/trips/${trip.id}`} className={cardLink}>
              <TripCover name={trip.name} height={92} />
              <div className="flex flex-col gap-3 px-4 pb-4 pt-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-lg font-bold">{trip.name}</span>
                    <span className="text-sm text-muted">
                      {formatDates(trip.start_date, trip.end_date)} · {members.length}{" "}
                      {members.length === 1 ? "member" : "members"}
                    </span>
                  </div>
                  <ChevronRight />
                </div>
                <div className="flex pl-1.5">
                  {members.slice(0, 5).map((m) => (
                    <span key={m.user_id} className="-ml-1.5">
                      <Avatar name={m.profiles?.display_name ?? "?"} seed={m.user_id} ring />
                    </span>
                  ))}
                  {members.length > 5 && (
                    <span className="-ml-1.5 flex size-7 items-center justify-center rounded-full border-2 border-surface bg-track text-xs font-bold text-muted">
                      +{members.length - 5}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </PageShell>
  );
}
