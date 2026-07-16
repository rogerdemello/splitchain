"use client";

import { useMemo } from "react";
import { useAccount } from "wagmi";
import { BarChart3 } from "lucide-react";
import { usePrice, formatUsd } from "@/lib/web3/price";
import { Identity } from "@/components/Identity";
import { formatMon, sameAddress } from "@/lib/format";

interface Expense {
  payer: `0x${string}`;
  amount: bigint;
  description: string;
  timestamp: bigint;
  amountUsdCents?: bigint;
}

interface InsightsProps {
  members: readonly `0x${string}`[];
  expenses: readonly Expense[];
}

/** Group spending analytics: total spend + who fronted how much. */
export function Insights({ members, expenses }: InsightsProps) {
  const { address } = useAccount();
  const price = usePrice();

  const { total, paidBy, max } = useMemo(() => {
    const paid = new Map<string, bigint>();
    let t = 0n;
    for (const e of expenses) {
      t += e.amount;
      paid.set(e.payer.toLowerCase(), (paid.get(e.payer.toLowerCase()) ?? 0n) + e.amount);
    }
    let m = 0n;
    for (const v of paid.values()) if (v > m) m = v;
    return { total: t, paidBy: paid, max: m };
  }, [expenses]);

  if (expenses.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500">
          <BarChart3 className="h-4 w-4" />
        </div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Group insights</h2>
        <span className="ml-auto text-right">
          <span className="block font-mono text-sm font-bold text-slate-900 dark:text-white">
            {formatMon(total)} MON
          </span>
          <span className="block text-[11px] text-slate-400">
            {expenses.length} expense{expenses.length === 1 ? "" : "s"} · ≈ {formatUsd(price.weiToUsd(total))}
          </span>
        </span>
      </div>

      <div className="space-y-2.5">
        {members.map((m) => {
          const paid = paidBy.get(m.toLowerCase()) ?? 0n;
          const pct = max > 0n ? Number((paid * 100n) / max) : 0;
          return (
            <div key={m}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <Identity address={m} you={sameAddress(m, address)} compact />
                <span className="font-mono text-slate-500 dark:text-slate-400">
                  {formatMon(paid)} MON
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-brand-500 transition-all"
                  style={{ width: `${Math.max(paid > 0n ? 6 : 0, pct)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-slate-400">Total each person fronted for the group.</p>
    </div>
  );
}
