"use client";

import { useMemo } from "react";
import { useAccount } from "wagmi";
import { ArrowRight, Scale, PartyPopper } from "lucide-react";
import { simplifyDebts } from "@/lib/web3/simplify";
import { SettleButton } from "@/components/SettleButton";
import { formatMon, shortAddress, sameAddress } from "@/lib/format";
import { cn } from "@/lib/cn";

interface BalancesProps {
  groupId: bigint;
  members: readonly `0x${string}`[];
  balances: readonly bigint[];
  onSettled: () => void;
}

export function Balances({ groupId, members, balances, onSettled }: BalancesProps) {
  const { address } = useAccount();

  const transfers = useMemo(
    () => simplifyDebts(members.map((m, i) => ({ address: m, balance: balances[i] ?? 0n }))),
    [members, balances]
  );

  const allSettled = transfers.length === 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500">
          <Scale className="h-4 w-4" />
        </div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Balances</h2>
      </div>

      {/* Net positions */}
      <div className="mb-5 space-y-1.5">
        {members.map((m, i) => {
          const bal = balances[i] ?? 0n;
          const you = sameAddress(m, address);
          return (
            <div
              key={m}
              className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950/60"
            >
              <span className="font-mono text-sm text-slate-600 dark:text-slate-300">
                {you ? <span className="font-semibold text-brand-500">You</span> : shortAddress(m)}
              </span>
              <span
                className={cn(
                  "font-mono text-sm font-semibold",
                  bal > 0n && "text-credit-500",
                  bal < 0n && "text-debit-500",
                  bal === 0n && "text-slate-400"
                )}
              >
                {bal > 0n ? `+${formatMon(bal)}` : formatMon(bal)} MON
                <span className="ml-1 text-xs font-normal text-slate-400">
                  {bal > 0n ? "owed" : bal < 0n ? "owes" : "settled"}
                </span>
              </span>
            </div>
          );
        })}
      </div>

      {/* Who owes whom */}
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Suggested settlements
      </h3>

      {allSettled ? (
        <div className="flex items-center gap-2 rounded-lg border border-credit-100 bg-credit-50 px-3 py-3 text-sm text-credit-600 dark:border-credit-500/30 dark:bg-credit-500/10 dark:text-credit-400">
          <PartyPopper className="h-4 w-4" /> All square — nobody owes anything.
        </div>
      ) : (
        <div className="space-y-2">
          {transfers.map((t, idx) => {
            const mine = sameAddress(t.from, address);
            return (
              <div
                key={`${t.from}-${t.to}-${idx}`}
                className={cn(
                  "rounded-xl border p-3",
                  mine
                    ? "border-brand-500/40 bg-brand-500/5"
                    : "border-slate-200 dark:border-slate-800"
                )}
              >
                <div className="mb-2 flex items-center gap-2 text-sm">
                  <span className="font-mono text-slate-600 dark:text-slate-300">
                    {sameAddress(t.from, address) ? "You" : shortAddress(t.from)}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                  <span className="font-mono text-slate-600 dark:text-slate-300">
                    {sameAddress(t.to, address) ? "You" : shortAddress(t.to)}
                  </span>
                  <span className="ml-auto font-mono text-sm font-semibold text-slate-900 dark:text-white">
                    {formatMon(t.amount)} MON
                  </span>
                </div>
                {mine ? (
                  <SettleButton
                    groupId={groupId}
                    to={t.to as `0x${string}`}
                    amount={t.amount}
                    onSettled={onSettled}
                  />
                ) : (
                  <p className="text-xs text-slate-400">
                    Waiting on {shortAddress(t.from)} to settle.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
