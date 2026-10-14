import { describe, test, expect } from "vitest";
import { summarisePoll, describeResult, pollFormError } from "./polls";

const options = [
  { id: "o1", label: "Lisbon" },
  { id: "o2", label: "Porto" },
  { id: "o3", label: "Faro" },
];

describe("summarisePoll", () => {
  test("no votes", () => {
    const summary = summarisePoll(options, []);
    expect(summary.totalVotes).toBe(0);
    expect(summary.leaderIds).toEqual([]);
    expect(summary.options.map((o) => o.count)).toEqual([0, 0, 0]);
  });

  test("counts votes and records who voted", () => {
    const summary = summarisePoll(options, [
      { optionId: "o1", userId: "A" },
      { optionId: "o1", userId: "B" },
      { optionId: "o2", userId: "C" },
    ]);
    expect(summary.totalVotes).toBe(3);
    expect(summary.options[0]).toEqual({ id: "o1", label: "Lisbon", count: 2, voterIds: ["A", "B"] });
    expect(summary.options[1].count).toBe(1);
  });

  test("an option with no votes is still listed", () => {
    const summary = summarisePoll(options, [{ optionId: "o1", userId: "A" }]);
    expect(summary.options[2]).toEqual({ id: "o3", label: "Faro", count: 0, voterIds: [] });
  });

  test("a clear winner", () => {
    const summary = summarisePoll(options, [
      { optionId: "o2", userId: "A" },
      { optionId: "o2", userId: "B" },
      { optionId: "o1", userId: "C" },
    ]);
    expect(summary.leaderIds).toEqual(["o2"]);
  });

  test("a two-way tie", () => {
    const summary = summarisePoll(options, [
      { optionId: "o1", userId: "A" },
      { optionId: "o2", userId: "B" },
    ]);
    expect(summary.leaderIds).toEqual(["o1", "o2"]);
  });
});

describe("describeResult", () => {
  test("no votes", () => {
    expect(describeResult(summarisePoll(options, []))).toBe("No votes");
  });

  test("winner", () => {
    const summary = summarisePoll(options, [{ optionId: "o3", userId: "A" }]);
    expect(describeResult(summary)).toBe("Winner: Faro");
  });

  test("two-way tie", () => {
    const summary = summarisePoll(options, [
      { optionId: "o1", userId: "A" },
      { optionId: "o2", userId: "B" },
    ]);
    expect(describeResult(summary)).toBe("Tie between Lisbon and Porto");
  });

  test("three-way tie", () => {
    const summary = summarisePoll(options, [
      { optionId: "o1", userId: "A" },
      { optionId: "o2", userId: "B" },
      { optionId: "o3", userId: "C" },
    ]);
    expect(describeResult(summary)).toBe("Tie between Lisbon, Porto and Faro");
  });
});

describe("pollFormError", () => {
  test("a valid poll has no error", () => {
    expect(pollFormError("Where?", ["Lisbon", "Porto"])).toBeNull();
  });
  test("blank question", () => {
    expect(pollFormError("  ", ["Lisbon", "Porto"])).toBe("The poll needs a question");
  });
  test("too few options", () => {
    expect(pollFormError("Where?", ["Lisbon"])).toBe("A poll needs at least 2 options");
  });
  test("too many options", () => {
    expect(pollFormError("Where?", ["1", "2", "3", "4", "5", "6", "7"])).toBe("A poll can have at most 6 options");
  });
  test("blank option", () => {
    expect(pollFormError("Where?", ["Lisbon", " "])).toBe("Options can't be blank");
  });
  test("duplicates ignore case and spaces", () => {
    expect(pollFormError("Where?", ["Lisbon", " lisbon "])).toBe("Each option must be different");
  });
});