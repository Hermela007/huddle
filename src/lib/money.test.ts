import { describe, test, expect } from "vitest";
import { splitEqually, computeBalances, settleUp, parsePoundsToPence, amountError } from "./money";

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
        { amountPence: 900, paidBy: "A", shares: { A: 300, B: 300, C: 300 } },
        { amountPence: 600, paidBy: "B", shares: { B: 300, C: 300 } },
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
      [{ amountPence: 1000, paidBy: "A", shares: { B: 500, C: 500 } }],
      []
    );
    expect(result).toEqual({ A: 1000, B: -500, C: -500 });
  });
});

describe("settleUp", () => {
  test("four people, worked example", () => {
    expect(settleUp({ A: 700, B: 300, C: -400, D: -600 })).toEqual([
      { from: "D", to: "A", amountPence: 600 },
      { from: "C", to: "B", amountPence: 300 },
      { from: "C", to: "A", amountPence: 100 },
    ]);
  });

  test("everyone already settled", () => {
    expect(settleUp({ A: 0, B: 0 })).toEqual([]);
  });

  test("result from computeBalances", () => {
    expect(settleUp({ A: 400, B: 0, C: -400 })).toEqual([
      { from: "C", to: "A", amountPence: 400 },
    ]);
  });

  test("throws if balances don't add up to 0", () => {
    expect(() => settleUp({ A: 500, B: -200 })).toThrow();
  });
});

describe("parsePoundsToPence", () => {
  test("whole pounds", () => {
    expect(parsePoundsToPence("12")).toBe(1200);
  });
  test("pounds and pence", () => {
    expect(parsePoundsToPence("12.50")).toBe(1250);
  });
  test("one decimal place means tens of pence", () => {
    expect(parsePoundsToPence("12.5")).toBe(1250);
  });
  test("pence only", () => {
    expect(parsePoundsToPence("0.07")).toBe(7);
  });
  test("ignores a £ sign and spaces", () => {
    expect(parsePoundsToPence(" £4.20 ")).toBe(420);
  });
  test("rejects more than two decimal places", () => {
    expect(parsePoundsToPence("12.505")).toBeNull();
  });
  test("rejects text, negatives, commas and empty input", () => {
    for (const bad of ["abc", "-5", "1,250", ""]) {
      expect(parsePoundsToPence(bad)).toBeNull();
    }
  });
});

describe("amountError", () => {
  test("valid amounts have no error", () => {
    expect(amountError("12.50")).toBeNull();
    expect(amountError("£3")).toBeNull();
  });
  test("empty", () => {
    expect(amountError("")).toBe("Enter an amount");
  });
  test("letters", () => {
    expect(amountError("abc")).toBe("The amount must be a number, like 12.50");
  });
  test("negative", () => {
    expect(amountError("-5")).toBe("The amount can't be negative");
  });
  test("commas", () => {
    expect(amountError("1,250")).toBe("Use a dot for pence, like 12.50 (no commas)");
  });
  test("too many decimal places", () => {
    expect(amountError("12.505")).toBe("Use at most 2 decimal places, like 12.50");
  });
  test("zero", () => {
    expect(amountError("0")).toBe("The amount must be more than £0");
  });
  test("over the technical limit", () => {
    expect(amountError("20000000.01")).toBe("Amounts over £20,000,000 can't be stored");
  });
  test("big but real expenses are allowed", () => {
    expect(amountError("150000")).toBeNull();
  });
});