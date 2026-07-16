"use client";

import { useAccount } from "wagmi";
import { ScrollText } from "lucide-react";
import { usePrice, formatUsd } from "@/lib/web3/price";
import { Identity } from "@/components/Identity";
import { formatMon } from "@/lib/format";

interface ExpenseItem {
  payer: `0x${string}`;
  amount: bigint;
  participants: readonly `0x${string}`[];
  shares: readonly bigint[];
  description: string;
  timestamp: bigint;
  amountUsdCents?: bigint;
}

export function ExpenseHistory({ expenses }: { expenses: readonly ExpenseItem[] }) {
  const { address } = useAccount();
  const price = usePrice();

  const usdLabel = (e: ExpenseItem) =>
    e.amountUsdCents && e.amountUsdCents > 0n
      ? formatUsd(Number(e.amountUsdCents) / 100)
      : formatUsd(price.weiToUsd(e.amount));

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
          No expenses yet. Scan a receipt or add one to get started.
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
                <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                  <Identity address={e.payer} you={sameAddr(e.payer, address)} compact />
                  <span>
                    paid · split {e.participants.length} way{e.participants.length > 1 ? "s" : ""}
                  </span>
                </p>
              </div>
              <span className="ml-3 shrink-0 text-right">
                <span className="block font-mono text-sm font-semibold text-slate-900 dark:text-white">
                  {formatMon(e.amount)} MON
                </span>
                <span className="block text-[11px] text-slate-400">≈ {usdLabel(e)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function sameAddr(a?: string, b?: string) {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}
