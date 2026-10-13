
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