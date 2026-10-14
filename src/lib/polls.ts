export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 6;

export type PollOption = { id: string; label: string };
export type PollVote = { optionId: string; userId: string };
export type OptionResult = { id: string; label: string; count: number; voterIds: string[] };
export type PollSummary = { options: OptionResult[]; totalVotes: number; leaderIds: string[] };

// Count the votes for each option and work out who's in the lead
export function summarisePoll(options: PollOption[], votes: PollVote[]): PollSummary {
  const results: OptionResult[] = options.map((o) => ({
    id: o.id,
    label: o.label,
    count: 0,
    voterIds: [],
  }));

  for (const vote of votes) {
    const result = results.find((r) => r.id === vote.optionId);
    if (result) {
      result.count += 1;
      result.voterIds.push(vote.userId);
    }
  }

  const totalVotes = results.reduce((sum, r) => sum + r.count, 0);
  const highest = Math.max(0, ...results.map((r) => r.count));
  const leaderIds = highest === 0 ? [] : results.filter((r) => r.count === highest).map((r) => r.id);

  return { options: results, totalVotes, leaderIds };
}

// "No votes" / "Winner: Lisbon" / "Tie between Lisbon and Porto" / "Tie between A, B and C"
export function describeResult(summary: PollSummary): string {
  const leaders = summary.options.filter((o) => summary.leaderIds.includes(o.id)).map((o) => o.label);

  if (leaders.length === 0) return "No votes";
  if (leaders.length === 1) return `Winner: ${leaders[0]}`;

  const allButLast = leaders.slice(0, -1).join(", ");
  return `Tie between ${allButLast} and ${leaders[leaders.length - 1]}`;
}

// Same rules as create_poll in the database, with friendly messages
export function pollFormError(question: string, options: string[]): string | null {
  if (question.trim() === "") return "The poll needs a question";

  const trimmed = options.map((o) => o.trim());
  if (trimmed.length < MIN_OPTIONS) return "A poll needs at least 2 options";
  if (trimmed.length > MAX_OPTIONS) return "A poll can have at most 6 options";
  if (trimmed.some((o) => o === "")) return "Options can't be blank";

  const unique = new Set(trimmed.map((o) => o.toLowerCase()));
  if (unique.size !== trimmed.length) return "Each option must be different";

  return null;
}