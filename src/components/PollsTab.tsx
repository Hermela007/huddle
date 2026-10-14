import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabase";
import { fetchMembers, type Member } from "../lib/members";
import { describeResult, summarisePoll } from "../lib/polls";

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

  if (loading) return <p>Loading polls…</p>;

  // Open polls first, then closed. The query already returned newest first,
  // and sort is stable, so each group stays newest first.
  const sortedPolls = [...polls].sort(
    (a, b) => Number(a.closed_at !== null) - Number(b.closed_at !== null)
  );

  return (
    <section>
      <Link to={`/trips/${tripId}/polls/new`}>+ New poll</Link>
      {error && <p role="alert">{error}</p>}

      {sortedPolls.length === 0 && <p>No polls yet.</p>}

      {sortedPolls.map((poll) => {
        const isOpen = poll.closed_at === null;
        const options = [...poll.poll_options].sort((a, b) => a.sort_order - b.sort_order);
        const summary = summarisePoll(
          options,
          poll.poll_votes.map((v) => ({ optionId: v.option_id, userId: v.user_id }))
        );
        const myVote = poll.poll_votes.find((v) => v.user_id === myId)?.option_id;

        return (
          <article key={poll.id}>
            <h3>{poll.question}</h3>
            <p>
              {isOpen ? "Open" : `Closed · ${describeResult(summary)}`} · asked by {nameOf(poll.created_by)} ·{" "}
              {summary.totalVotes} {summary.totalVotes === 1 ? "vote" : "votes"}
            </p>

            <ul>
              {summary.options.map((o) => (
                <li key={o.id}>
                  <strong>{o.label}</strong>: {o.count} {o.count === 1 ? "vote" : "votes"}
                  {o.voterIds.length > 0 && ` (${o.voterIds.map(nameOf).join(", ")})`}
                  {myVote === o.id && " ✓ Your vote"}
                  {isOpen && myVote !== o.id && (
                    <>
                      {" "}
                      <button onClick={() => vote(poll.id, o.id)} disabled={busy}>
                        {myVote ? "Change to this" : "Vote"}
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>

            {canManage(poll) && (
              <p>
                {isOpen && (
                  <button onClick={() => closePoll(poll)} disabled={busy}>
                    Close poll
                  </button>
                )}{" "}
                <button onClick={() => deletePoll(poll)} disabled={busy}>
                  Delete poll
                </button>
              </p>
            )}
          </article>
        );
      })}
    </section>
  );
}