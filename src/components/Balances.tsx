"use client";

import { useEffect, useMemo } from "react";
import { useAccount } from "wagmi";
import { ArrowRight, Scale, PartyPopper, Zap } from "lucide-react";
import { simplifyDebts } from "@/lib/web3/simplify";
import { SettleButton } from "@/components/SettleButton";
import { TxStatus } from "@/components/TxStatus";
import { useSettleMany } from "@/lib/web3/hooks";
import { usePrice, formatUsd } from "@/lib/web3/price";
import { formatMon, sameAddress } from "@/lib/format";
import { Identity } from "@/components/Identity";
import { cn } from "@/lib/cn";

interface BalancesProps {
  groupId: bigint;
  members: readonly `0x${string}`[];
  balances: readonly bigint[];
  onSettled: () => void;
}

export function Balances({ groupId, members, balances, onSettled }: BalancesProps) {
  const { address } = useAccount();
  const price = usePrice();

  const transfers = useMemo(
    () => simplifyDebts(members.map((m, i) => ({ address: m, balance: balances[i] ?? 0n }))),
    [members, balances]
  );

  const allSettled = transfers.length === 0;

  // The connected user's own outgoing debts — the batch settle-all target.
  const myTransfers = useMemo(
    () => transfers.filter((t) => sameAddress(t.from, address)),
    [transfers, address]
  );
  const myTotal = useMemo(
    () => myTransfers.reduce((a, t) => a + t.amount, 0n),
    [myTransfers]
  );

  const batch = useSettleMany();
  useEffect(() => {
    if (batch.isConfirmed) {
      onSettled();
      const t = setTimeout(() => batch.reset(), 1500);
      return () => clearTimeout(t);
    }
  }, [batch.isConfirmed, batch, onSettled]);

  const usd = (wei: bigint) => (price ? formatUsd(price.weiToUsd(wei)) : "");

  const settleAll = async () => {
    await batch.settleMany(
      groupId,
      myTransfers.map((t) => t.to as `0x${string}`),
      myTransfers.map((t) => t.amount)
    );
  };

  const batchBusy = batch.isPending || batch.isConfirming;

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
          const abs = bal < 0n ? -bal : bal;
          return (
            <div
              key={m}
              className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950/60"
            >
              <Identity address={m} you={sameAddress(m, address)} editable />
              <span className="text-right">
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
                {bal !== 0n && (
                  <span className="block text-[11px] font-normal text-slate-400">
                    ≈ {usd(abs)}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {/* One-click settle-all */}
      {myTransfers.length >= 2 && (
        <div className="mb-4 rounded-xl border border-brand-500/40 bg-brand-500/5 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm">
            <Zap className="h-4 w-4 text-brand-500" />
            <span className="font-semibold text-slate-800 dark:text-slate-100">
              Clear all your debts in one transaction
            </span>
            <span className="ml-auto font-mono text-sm font-semibold text-slate-900 dark:text-white">
              {formatMon(myTotal)} MON
            </span>
          </div>
          <button
            type="button"
            onClick={settleAll}
            disabled={batchBusy}
            className={cn(
              "inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition",
              batchBusy ? "cursor-not-allowed bg-slate-300 dark:bg-slate-700" : "bg-brand-500 hover:bg-brand-600"
            )}
          >
            <Zap className="h-4 w-4" />
            {batchBusy
              ? "Settling…"
              : `Settle all ${myTransfers.length} payments (${usd(myTotal)})`}
          </button>
          <TxStatus
            className="mt-2"
            hash={batch.hash}
            isPending={batch.isPending}
            isConfirming={batch.isConfirming}
            isConfirmed={batch.isConfirmed}
            error={batch.error}
          />
        </div>
      )}

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
                  <Identity address={t.from} you={sameAddress(t.from, address)} compact />
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                  <Identity address={t.to} you={sameAddress(t.to, address)} compact />
                  <span className="ml-auto text-right">
                    <span className="block font-mono text-sm font-semibold text-slate-900 dark:text-white">
                      {formatMon(t.amount)} MON
                    </span>
                    <span className="block text-[11px] text-slate-400">≈ {usd(t.amount)}</span>
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
                    Waiting on this person to settle.
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
