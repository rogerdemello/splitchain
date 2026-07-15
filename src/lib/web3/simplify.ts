/**
 * Off-chain debt simplification.
 *
 * Given each member's net balance (positive = they're owed, negative = they
 * owe), produce the minimal-ish set of "who pays whom" transfers that clears
 * everyone. Classic greedy netting: repeatedly match the biggest debtor against
 * the biggest creditor. Each resulting transfer is one real on-chain settle().
 */

export interface MemberBalance {
  address: string;
  balance: bigint; // signed wei
}

export interface Transfer {
  from: string; // debtor
  to: string; // creditor
  amount: bigint; // wei
}

export function simplifyDebts(members: MemberBalance[]): Transfer[] {
  const creditors = members
    .filter((m) => m.balance > 0n)
    .map((m) => ({ ...m }))
    .sort((a, b) => (b.balance > a.balance ? 1 : -1));
  const debtors = members
    .filter((m) => m.balance < 0n)
    .map((m) => ({ address: m.address, balance: -m.balance })) // owed amount, positive
    .sort((a, b) => (b.balance > a.balance ? 1 : -1));

  const transfers: Transfer[] = [];
  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const credit = creditors[ci];
    const debt = debtors[di];
    const amount = credit.balance < debt.balance ? credit.balance : debt.balance;

    if (amount > 0n) {
      transfers.push({ from: debt.address, to: credit.address, amount });
      credit.balance -= amount;
      debt.balance -= amount;
    }

    if (credit.balance === 0n) ci++;
    if (debt.balance === 0n) di++;
  }

  return transfers;
}
