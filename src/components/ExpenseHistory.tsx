"use client";

import { useAccount } from "wagmi";
import { ScrollText } from "lucide-react";
import { formatMon, shortAddress, sameAddress } from "@/lib/format";

interface ExpenseItem {
  payer: `0x${string}`;
  amount: bigint;
  participants: readonly `0x${string}`[];
  shares: readonly bigint[];
  description: string;
  timestamp: bigint;
}

export function ExpenseHistory({ expenses }: { expenses: readonly ExpenseItem[] }) {
  const { address } = useAccount();

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500">
          <ScrollText className="h-4 w-4" />
        </div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Expenses</h2>
        <span className="ml-auto text-xs text-slate-400">{expenses.length} logged</span>
      </div>

      {expenses.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">
          No expenses yet. Add the first one to get started.
        </p>
      ) : (
        <ul className="scroll-area max-h-64 space-y-2 overflow-y-auto pr-1">
          {[...expenses].reverse().map((e, i) => (
            <li
              key={i}
              className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950/60"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                  {e.description}
                </p>
                <p className="font-mono text-xs text-slate-400">
                  {sameAddress(e.payer, address) ? "You" : shortAddress(e.payer)} paid ·
                  split {e.participants.length} way{e.participants.length > 1 ? "s" : ""}
                </p>
              </div>
              <span className="ml-3 shrink-0 font-mono text-sm font-semibold text-slate-900 dark:text-white">
                {formatMon(e.amount)} MON
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
