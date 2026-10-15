import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabase";
import { formatDates } from "../lib/format";
import { ExpensesTab } from "../components/ExpensesTab";
import { BalancesTab } from "../components/BalancesTab";
import { PollsTab } from "../components/PollsTab";
import { Avatar, ChevronLeft, PageShell, Skeleton, TripCover } from "../components/ui";
import { btnDanger, btnQuiet, h1Small, input } from "../lib/styles";

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

const TABS: { id: Tab; label: string }[] = [
  { id: "expenses", label: "Expenses" },
  { id: "balances", label: "Balances" },
  { id: "polls", label: "Polls" },
];

export function TripPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const { session } = useAuth();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const startTab = searchParams.get("tab");
  const [tab, setTab] = useState<Tab>(
    startTab === "balances" || startTab === "polls" ? startTab : "expenses"
  );
  const [copied, setCopied] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

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

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-md">
        <Skeleton className="h-39 rounded-none" />
        <div className="flex flex-col gap-4 px-5 pt-4">
          <Skeleton className="h-16" />
          <Skeleton className="h-12" />
          <Skeleton className="h-40" />
        </div>
      </main>
    );
  }

  if (!trip) {
    return (
      <PageShell>
        <h1 className={h1Small}>Trip not found</h1>
        <p className="text-[15px] text-muted">This trip doesn't exist, or you're not a member of it.</p>
        <Link to="/trips" className={btnQuiet}>
          Back to my trips
        </Link>
      </PageShell>
    );
  }

  const isOrganiser = session?.user.id === trip.organiser_id;
  // Invite links always point at the live site (VITE_SITE_URL), so a link
  // copied while running locally still works for friends. Falls back to the
  // current address if the variable isn't set.
  const siteUrl = import.meta.env.VITE_SITE_URL || window.location.origin;
  const inviteLink = `${siteUrl}/join/${trip.invite_code}`;

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
    <main className="mx-auto min-h-svh w-full max-w-md pb-10">
      {/* Cover banner with the back button on top of it */}
      <div className="relative">
        <TripCover name={trip.name} height={156} />
        <Link
          to="/trips"
          aria-label="Back to my trips"
          className="absolute left-4 top-4 flex size-11 items-center justify-center rounded-full bg-white/90 text-ink outline-none transition-transform duration-150 ease-snappy focus-visible:outline-2 focus-visible:outline-coral active:scale-[0.97]"
        >
          <ChevronLeft />
        </Link>
      </div>

      <div className="flex flex-col gap-4 px-5 pt-4">
        <div className="flex items-end justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className={h1Small}>{trip.name}</h1>
            <p className="text-sm text-muted">
              {formatDates(trip.start_date, trip.end_date)} · {members.length}{" "}
              {members.length === 1 ? "member" : "members"}
            </p>
          </div>
          <button type="button" className={btnQuiet} aria-expanded={showInvite} onClick={() => setShowInvite((s) => !s)}>
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="8" r="4" />
              <path d="M2 21c0-4 3-6 7-6s7 2 7 6M19 8v6M16 11h6" />
            </svg>
            Invite
          </button>
        </div>

        {showInvite && (
          <section className="flex flex-col gap-4 rounded-card bg-surface p-4">
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold">Invite link</h2>
              <div className="flex gap-2">
                <input readOnly value={inviteLink} onFocus={(e) => e.target.select()} aria-label="Invite link" className={`${input} bg-white text-sm`} />
                <button type="button" onClick={copyLink} className={btnQuiet}>
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              {isOrganiser && (
                <button type="button" onClick={resetLink} className={`${btnDanger} self-start -ml-3`}>
                  Reset link
                </button>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold">Members</h2>
              <ul className="flex flex-col gap-2">
                {members.map((m) => (
                  <li key={m.user_id} className="flex items-center gap-2.5 text-[15px]">
                    <Avatar name={m.profiles?.display_name ?? "?"} seed={m.user_id} size={30} />
                    <span className="font-semibold">{m.profiles?.display_name ?? "Unknown"}</span>
                    <span className="text-sm text-muted">
                      {[m.user_id === session?.user.id && "you", m.user_id === trip.organiser_id && "organiser"]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* Segmented tabs: switching is instant on purpose (used constantly) */}
        <div role="tablist" aria-label="Trip sections" className="grid grid-cols-3 gap-1 rounded-full bg-track p-1">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={`h-10 rounded-full text-sm font-bold outline-none focus-visible:outline-2 focus-visible:outline-coral ${
                  active ? "bg-white text-ink shadow-sm" : "text-muted"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === "expenses" && <ExpensesTab tripId={trip.id} organiserId={trip.organiser_id} />}
        {tab === "balances" && <BalancesTab tripId={trip.id} />}
        {tab === "polls" && <PollsTab tripId={trip.id} organiserId={trip.organiser_id} />}
      </div>
    </main>
  );
}
