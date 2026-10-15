import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabase";
import { fetchMembers, type Member } from "../lib/members";
import { describeResult, summarisePoll } from "../lib/polls";
import { ErrorMessage, LoadingRows, PlusIcon } from "./ui";
import { btnDanger, btnPrimary, btnText } from "../lib/styles";

type PollRow = {
  id: string;
  question: string;
  created_by: string;
  closed_at: string | null;
  created_at: string;
  poll_options: { id: string; label: string; sort_order: number }[];
  poll_votes: { user_id: string; option_id: string }[];
};

export function PollsTab({ tripId, organiserId }: { tripId: string; organiserId: string }) {
  const { session } = useAuth();
  const myId = session?.user.id;

  const [members, setMembers] = useState<Member[]>([]);
  const [polls, setPolls] = useState<PollRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const [memberList, pollsRes] = await Promise.all([
          fetchMembers(tripId),
          supabase
            .from("polls")
            .select("id, question, created_by, closed_at, created_at, poll_options(id, label, sort_order), poll_votes(user_id, option_id)")
            .eq("trip_id", tripId)
            .order("created_at", { ascending: false }),
        ]);
        if (pollsRes.error) throw pollsRes.error;

        setMembers(memberList);
        setPolls(pollsRes.data as unknown as PollRow[]);
      } catch (err) {
        setError((err as { message?: string }).message ?? "Couldn't load polls");
      }
      setLoading(false);
    }

    load();
  }, [tripId, version]);

  const nameOf = (userId: string) =>
    userId === myId ? "you" : members.find((m) => m.userId === userId)?.displayName ?? "Unknown";

  const canManage = (poll: PollRow) => poll.created_by === myId || organiserId === myId;

  async function vote(pollId: string, optionId: string) {
    if (!myId) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase
      .from("poll_votes")
      .upsert({ poll_id: pollId, user_id: myId, option_id: optionId }, { onConflict: "poll_id,user_id" });
    setBusy(false);

    if (error) {
      setError(error.message);
      return;
    }
    setVersion((v) => v + 1);
  }

  async function closePoll(poll: PollRow) {
    if (!confirm(`Close "${poll.question}"? Votes will be final.`)) return;

    setBusy(true);
    setError(null);
    const { data, error } = await supabase
      .from("polls")
      .update({ closed_at: new Date().toISOString() })
      .eq("id", poll.id)
      .select("id");
    setBusy(false);

    if (error) {
      setError(error.message);
      return;
    }
    if (!data || data.length === 0) {
      setError("You can't close this poll");
      return;
    }
    setVersion((v) => v + 1);
  }

  async function deletePoll(poll: PollRow) {
    if (!confirm(`Delete "${poll.question}" and all its votes? This can't be undone.`)) return;

    setBusy(true);
    setError(null);
    const { data, error } = await supabase.from("polls").delete().eq("id", poll.id).select("id");
    setBusy(false);

    if (error) {
      setError(error.message);
      return;
    }
    if (!data || data.length === 0) {
      setError("You can't delete this poll");
      return;
    }
    setVersion((v) => v + 1);
  }

  if (loading) return <LoadingRows count={2} height="h-48" />;

  // Open polls first, then closed. The query already returned newest first,
  // and sort is stable, so each group stays newest first.
  const sortedPolls = [...polls].sort(
    (a, b) => Number(a.closed_at !== null) - Number(b.closed_at !== null)
  );

  return (
    <section className="flex flex-col gap-4">
      <Link to={`/trips/${tripId}/polls/new`} className={btnPrimary}>
        <PlusIcon />
        New poll
      </Link>
      {error && <ErrorMessage>{error}</ErrorMessage>}

      {sortedPolls.length === 0 && (
        <div className="rounded-card bg-surface px-5 py-8 text-center">
          <p className="font-bold">No polls yet</p>
          <p className="mt-1 text-[15px] text-muted">Ask the group which dates, train or place works best.</p>
        </div>
      )}

      {sortedPolls.map((poll) => {
        const isOpen = poll.closed_at === null;
        const options = [...poll.poll_options].sort((a, b) => a.sort_order - b.sort_order);
        const summary = summarisePoll(
          options,
          poll.poll_votes.map((v) => ({ optionId: v.option_id, userId: v.user_id }))
        );
        const myVote = poll.poll_votes.find((v) => v.user_id === myId)?.option_id;

        return (
          <article key={poll.id} className="flex flex-col gap-3 rounded-card bg-surface p-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    isOpen ? "bg-owed-soft text-owed" : "bg-settled-soft text-muted"
                  }`}
                >
                  {isOpen ? "Open" : "Closed"}
                </span>
                <span className="text-[13px] text-muted">
                  asked by {nameOf(poll.created_by)} · {summary.totalVotes} {summary.totalVotes === 1 ? "vote" : "votes"}
                </span>
              </div>
              <h3 className="text-[17px] font-bold">{poll.question}</h3>
              {!isOpen && <p className="text-[15px] font-semibold text-coral">{describeResult(summary)}</p>}
            </div>

            <ul className="flex flex-col gap-2">
              {summary.options.map((o) => {
                const mine = myVote === o.id;
                const percent = summary.totalVotes === 0 ? 0 : Math.round((o.count / summary.totalVotes) * 100);
                const canVote = isOpen && !mine;
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      disabled={!canVote || busy}
                      onClick={() => vote(poll.id, o.id)}
                      aria-pressed={mine}
                      className={`relative block w-full overflow-hidden rounded-xl border bg-white text-left outline-none focus-visible:outline-2 focus-visible:outline-coral ${
                        mine ? "border-coral" : "border-line"
                      } ${canVote ? "transition-transform duration-150 ease-snappy active:scale-[0.985]" : ""}`}
                    >
                      {/* Bar showing this option's share of the votes */}
                      <span
                        aria-hidden="true"
                        className={`absolute inset-y-0 left-0 ${mine ? "bg-coral-soft" : "bg-track"}`}
                        style={{ width: `${percent}%` }}
                      />
                      <span className="relative flex min-h-12 items-center justify-between gap-3 px-3.5 py-2">
                        <span className="flex min-w-0 flex-col">
                          <span className="text-[15px] font-semibold">
                            {o.label}
                            {mine && <span className="ml-1.5 text-[13px] font-bold text-coral">✓ Your vote</span>}
                          </span>
                          {o.voterIds.length > 0 && (
                            <span className="truncate text-[13px] text-muted">{o.voterIds.map(nameOf).join(", ")}</span>
                          )}
                        </span>
                        <span className="shrink-0 text-sm font-bold tabular-nums">{o.count}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {isOpen && !myVote && <p className="text-[13px] text-muted">Tap an option to vote.</p>}

            {canManage(poll) && (
              <div className="-ml-3 flex gap-1">
                {isOpen && (
                  <button type="button" onClick={() => closePoll(poll)} disabled={busy} className={btnText}>
                    Close poll
                  </button>
                )}
                <button type="button" onClick={() => deletePoll(poll)} disabled={busy} className={btnDanger}>
                  Delete
                </button>
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}
