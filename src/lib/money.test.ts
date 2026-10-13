import { describe, test, expect } from "vitest";
import { splitEqually, computeBalances } from "./money";

describe("splitEqually", () => {
  test("£9 between three people", () => {
    expect(splitEqually(900, ["A", "B", "C"])).toEqual({ A: 300, B:300, C:300});
  });
  test("£1000 between three people ", () => {
    expect(splitEqually(1000, ["A","B","C"])).toEqual({ A:334, B:333, C:333});
  });
  test("£1001 between three people", () => {
    expect(splitEqually(1001, ["A","B","C"])).toEqual({A:334, B:334, C:333});
  });
    test("£5.00 for one person", () => {
    expect(splitEqually(500, ["A"])).toEqual({ A: 500 });
  });
  test("1p between three people", () => {
    expect(splitEqually(1, ["A", "B", "C"])).toEqual({ A: 1, B: 0, C: 0 });
  });
  test("shares always add up to the total", () => {
    const shares = splitEqually(1001, ["A", "B", "C"]);
    const total = Object.values(shares).reduce((sum, s) => sum + s, 0);
    expect(total).toBe(1001);
  });
  test("throws for an empty list", () => {
    expect(() => splitEqually(400, [])).toThrow();
  });
  test("throws for a zero amount", () => {
    expect(() => splitEqually(0, ["A", "B"])).toThrow();
  });
  test("throws for a negative amount", () => {
    expect(() => splitEqually(-500, ["A", "B"])).toThrow();
  });
});

describe("computeBalances", () => {
  test("worked example from the PRD chat", () => {
    const result = computeBalances(
      ["A", "B", "C"],
      [
        { amountPence: 900, paidBy: "A", includedIds: ["A", "B", "C"] },
        { amountPence: 600, paidBy: "B", includedIds: ["B", "C"] },
      ],
      [{ from: "C", to: "A", amountPence: 200 }]
    );
    expect(result).toEqual({ A: 400, B: 0, C: -400 });
  });

  test("no expenses means everyone is at 0", () => {
    expect(computeBalances(["A", "B"], [], [])).toEqual({ A: 0, B: 0 });
  });

  test("payer not included in the split", () => {
    const result = computeBalances(
      ["A", "B", "C"],
      [{ amountPence: 1000, paidBy: "A", includedIds: ["B", "C"] }],
      []
    );
    expect(result).toEqual({ A: 1000, B: -500, C: -500 });
  });
});