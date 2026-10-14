import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabase";
import { formatDates } from "../lib/format";
import { ExpensesTab } from "../components/ExpensesTab";

type Trip = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  organiser_id: string;
  invite_code: string;
};

type Member = {
  user_id: string;
  joined_at: string;
  profiles: { display_name: string } | null;
};

type Tab = "expenses" | "balances" | "polls";

export function TripPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const { session } = useAuth();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("expenses");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!tripId) return;
    const id = tripId;

    async function load() {
      const [tripRes, membersRes] = await Promise.all([
        supabase
          .from("trips")
          .select("id, name, start_date, end_date, organiser_id, invite_code")
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("trip_members")
          .select("user_id, joined_at, profiles(display_name)")
          .eq("trip_id", id)
          .order("joined_at"),
      ]);

      setTrip(tripRes.data as Trip | null);
      setMembers((membersRes.data ?? []) as unknown as Member[]);
      setLoading(false);
    }

    load();
  }, [tripId]);

  if (loading) return <p>Loading trip…</p>;

  if (!trip) {
    return (
      <main>
        <p>Trip not found, or you're not a member of it.</p>
        <Link to="/trips">Back to my trips</Link>
      </main>
    );
  }

  const isOrganiser = session?.user.id === trip.organiser_id;
  const inviteLink = `${window.location.origin}/join/${trip.invite_code}`;

  async function copyLink() {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function resetLink() {
    if (!trip) return;
    if (!confirm("Reset the invite link? The old link will stop working.")) return;

    const newCode = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
    const { error } = await supabase
      .from("trips")
      .update({ invite_code: newCode })
      .eq("id", trip.id);

    if (!error) setTrip({ ...trip, invite_code: newCode });
  }

  return (
    <main>
      <Link to="/trips">← My trips</Link>
      <h1>{trip.name}</h1>
      <p>{formatDates(trip.start_date, trip.end_date)}</p>

      <section>
        <h2>Members ({members.length})</h2>
        <ul>
          {members.map((m) => (
            <li key={m.user_id}>
              {m.profiles?.display_name ?? "Unknown"}
              {m.user_id === trip.organiser_id && " (organiser)"}
              {m.user_id === session?.user.id && " (you)"}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Invite friends</h2>
        <input readOnly value={inviteLink} onFocus={(e) => e.target.select()} />
        <button onClick={copyLink}>{copied ? "Copied!" : "Copy link"}</button>
        {isOrganiser && <button onClick={resetLink}>Reset link</button>}
      </section>

      <nav>
        <button onClick={() => setTab("expenses")} aria-pressed={tab === "expenses"}>Expenses</button>
        <button onClick={() => setTab("balances")} aria-pressed={tab === "balances"}>Balances</button>
        <button onClick={() => setTab("polls")} aria-pressed={tab === "polls"}>Polls</button>
      </nav>

      {tab === "expenses" && <ExpensesTab tripId={trip.id} organiserId={trip.organiser_id} />}
      {tab === "balances" && <p>Balances are coming in step 6.</p>}
      {tab === "polls" && <p>Polls are coming in step 7.</p>}
    </main>
  );
}