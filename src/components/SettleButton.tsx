"use client";

import { useEffect } from "react";
import { useAccount } from "wagmi";
import { HandCoins } from "lucide-react";
import { useSettle } from "@/lib/web3/hooks";
import { TxStatus } from "@/components/TxStatus";
import { logActivity } from "@/lib/activity";
import { formatMon } from "@/lib/format";
import { cn } from "@/lib/cn";

interface SettleButtonProps {
  groupId: bigint;
  to: `0x${string}`;
  amount: bigint;
  onSettled: () => void;
}

/** Fires a REAL payable settle() tx — msg.value MON actually moves to `to`. */
export function SettleButton({ groupId, to, amount, onSettled }: SettleButtonProps) {
  const { address } = useAccount();
  const s = useSettle();

  useEffect(() => {
    if (s.isConfirmed && s.hash) {
      logActivity(groupId, {
        id: `${s.hash}-settle-${to}`,
        kind: "settle",
        txHash: s.hash,
        ts: Date.now(),
        from: address,
        to,
        amount: amount.toString(),
      });
      onSettled();
      const t = setTimeout(() => s.reset(), 2000);
      return () => clearTimeout(t);
    }
  }, [s.isConfirmed, s, onSettled, groupId, to, amount, address]);

  const busy = s.isPending || s.isConfirming;

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => s.settle(groupId, to, amount).catch(() => {})}
        disabled={busy}
        className={cn(
          "inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition",
          busy ? "cursor-not-allowed bg-slate-300 dark:bg-slate-700" : "bg-credit-500 hover:bg-credit-600"
        )}
      >
        <HandCoins className="h-4 w-4" />
        Settle {formatMon(amount)} MON
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
