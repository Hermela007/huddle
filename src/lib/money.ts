
//working on splitEqually 
export function splitEqually(
    amountPence:number,
    memberIds: string[]
): Record<string, number> {

    if (memberIds.length === 0) {
        throw new Error("Need at least one person to split between");
    }
    if (amountPence <= 0) {
        throw new Error("Amount must be more than 0");
    }
    
    const base = Math.floor(amountPence / memberIds.length);
    const leftOver = amountPence % memberIds.length;
    const shares: Record<string, number> = {};
    for (let i = 0; i < memberIds.length; i++) {
        if (i < leftOver) {
            shares[memberIds[i]] = base + 1;
        }
        else {
            shares[memberIds[i]] = base; 
        }
    }    
    return shares 
}

//working on computeBalances
export type Expense = {
  amountPence: number;
  paidBy: string;        // who paid
  shares: Record<string, number>; // each person's share in pence, as stored
};

export type Payment = {
  from: string;          // who sent money
  to: string;            // who received it
  amountPence: number;
};

export function computeBalances(
  memberIds: string[],
  expenses: Expense[],
  payments: Payment[]
): Record<string, number> {
    
    const balances: Record<string, number> = {};
    for (const id of memberIds) {
        balances[id] = 0;
    }

    // 2. expenses: payer gets the full amount, then each person's stored share is taken off
    for (const expense of expenses) {
      balances[expense.paidBy] += expense.amountPence;
      for (const [id, share] of Object.entries(expense.shares)) {
      balances[id] -= share;
      }
    }

   for (const payment of payments) {
    balances[payment.from] += payment.amountPence;
    balances[payment.to] -= payment.amountPence;
  }
  
   return balances;
}

//working on settleUp
export type Transfer = {
  from: string;
  to: string;
  amountPence: number;
};

export function settleUp(balances: Record<string, number>): Transfer[] {
  const ids = Object.keys(balances);
  if (ids.length === 0) {
    return [];
  }

  const total = Object.values(balances).reduce((sum, b) => sum + b, 0);
  if (total !== 0) {
    throw new Error("Balances must add up to 0");
  }

  const remaining = { ...balances };
  const transfers: Transfer[] = [];

  while (true) {
    let creditor = ids[0];
    let debtor = ids[0];
    for (const id of ids) {
      if (remaining[id] > remaining[creditor]) creditor = id;
      if (remaining[id] < remaining[debtor]) debtor = id;
    }

    if (remaining[creditor] === 0) break;

    const amount = Math.min(remaining[creditor], -remaining[debtor]);
    transfers.push({ from: debtor, to: creditor, amountPence: amount });

    remaining[creditor] -= amount;
    remaining[debtor] += amount;
  }

  return transfers;
}

// "12.50" -> 1250, "12.5" -> 1250, "£3" -> 300. Anything invalid -> null.
export function parsePoundsToPence(input: string): number | null {
  const trimmed = input.trim().replace(/^£/, "");
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;

  const [pounds, pence = ""] = trimmed.split(".");
  return Number(pounds) * 100 + Number(pence.padEnd(2, "0"));
}

export const MAX_AMOUNT_PENCE = 2_000_000_000; // £20,000,000

// Returns a helpful message if the amount is invalid, or null if it's fine
export function amountError(input: string): string | null {
  const trimmed = input.trim().replace(/^£/, "");

  if (trimmed === "") return "Enter an amount";
  if (trimmed.startsWith("-")) return "The amount can't be negative";
  if (trimmed.includes(",")) return "Use a dot for pence, like 12.50 (no commas)";
  if (/^\d+\.\d{3,}$/.test(trimmed)) return "Use at most 2 decimal places, like 12.50";

  const pence = parsePoundsToPence(trimmed);
  if (pence === null) return "The amount must be a number, like 12.50";
  if (pence === 0) return "The amount must be more than £0";
  if (pence > MAX_AMOUNT_PENCE) return "Amounts over £20,000,000 can't be stored";

  return null;
}