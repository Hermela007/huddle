
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
  includedIds: string[]; // who's sharing it
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

    for (const expense of expenses) {
    balances[expense.paidBy] += expense.amountPence;
    const shares = splitEqually(expense.amountPence, expense.includedIds);
    for (const id of expense.includedIds) {
      balances[id] -= shares[id];
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