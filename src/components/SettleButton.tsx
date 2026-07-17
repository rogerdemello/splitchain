"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { HandCoins, SlidersHorizontal } from "lucide-react";
import { useSettle } from "@/lib/web3/hooks";
import { TxStatus } from "@/components/TxStatus";
import { logActivity } from "@/lib/activity";
import { formatMon, monToWei } from "@/lib/format";
import { cn } from "@/lib/cn";

interface SettleButtonProps {
  groupId: bigint;
  to: `0x${string}`;
  amount: bigint; // full amount owed
  onSettled: () => void;
}

/** Fires a REAL payable settle() tx. Supports paying the full amount or a part of it. */
export function SettleButton({ groupId, to, amount, onSettled }: SettleButtonProps) {
  const { address } = useAccount();
  const s = useSettle();
  const [editing, setEditing] = useState(false);
  const [custom, setCustom] = useState("");

  // Resolve how much to pay: full by default, or a valid custom amount capped at what's owed.
  const payWei = useMemo(() => {
    if (!editing || !custom) return amount;
    try {
      const w = monToWei(custom);
      if (w <= 0n) return 0n;
      return w > amount ? amount : w;
    } catch {
      return 0n;
    }
  }, [editing, custom, amount]);

  useEffect(() => {
    if (s.isConfirmed && s.hash) {
      logActivity(groupId, {
        id: `${s.hash}-settle-${to}`,
        kind: "settle",
        txHash: s.hash,
        ts: Date.now(),
        from: address,
        to,
        amount: payWei.toString(),
      });
      onSettled();
      const t = setTimeout(() => s.reset(), 2000);
      return () => clearTimeout(t);
    }
  }, [s.isConfirmed, s, onSettled, groupId, to, payWei, address]);

  const busy = s.isPending || s.isConfirming;
  const partial = payWei > 0n && payWei < amount;

  return (
    <div className="w-full">
      {editing && (
        <div className="mb-2 flex items-center gap-2">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="decimal"
            placeholder={formatMon(amount)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-mono text-sm outline-none ring-brand-500/30 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
          <span className="shrink-0 text-xs text-slate-400">of {formatMon(amount)} MON</span>
        </div>
      )}
      <button
        type="button"
        onClick={() => s.settle(groupId, to, payWei).catch(() => {})}
        disabled={busy || payWei <= 0n}
        className={cn(
          "inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition",
          busy || payWei <= 0n
            ? "cursor-not-allowed bg-slate-300 dark:bg-slate-700"
            : "bg-credit-500 hover:bg-credit-600"
        )}
      >
        <HandCoins className="h-4 w-4" />
        {partial ? `Pay ${formatMon(payWei)} MON` : `Settle ${formatMon(amount)} MON`}
      </button>
      <button
        type="button"
        onClick={() => {
          setEditing((v) => !v);
          setCustom("");
        }}
        className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-brand-500"
      >
        <SlidersHorizontal className="h-3 w-3" />
        {editing ? "Pay full amount" : "Pay part instead"}
      </button>
      <TxStatus
        className="mt-2"
        hash={s.hash}
        isPending={s.isPending}
        isConfirming={s.isConfirming}
        isConfirmed={s.isConfirmed}
        error={s.error}
      />
    </div>
  );
}
