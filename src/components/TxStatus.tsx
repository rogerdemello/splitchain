"use client";

import { Loader2, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { explorerTx } from "@/lib/web3/chains";
import { cn } from "@/lib/cn";

interface TxStatusProps {
  hash?: string;
  isPending: boolean; // awaiting wallet signature
  isConfirming: boolean; // mined pending
  isConfirmed: boolean;
  error?: { message?: string; shortMessage?: string } | null;
  className?: string;
}

/** Compact, honest tx lifecycle indicator. Only shows on real activity. */
export function TxStatus({
  hash,
  isPending,
  isConfirming,
  isConfirmed,
  error,
  className,
}: TxStatusProps) {
  if (!hash && !isPending && !error) return null;

  let tone = "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300";
  let icon = <Loader2 className="h-4 w-4 animate-spin" />;
  let label = "Waiting…";

  if (error) {
    tone = "border-debit-100 bg-debit-50 text-debit-600 dark:border-debit-500/30 dark:bg-debit-500/10 dark:text-debit-400";
    icon = <XCircle className="h-4 w-4" />;
    label = error.shortMessage || error.message || "Transaction failed";
  } else if (isPending) {
    icon = <Loader2 className="h-4 w-4 animate-spin" />;
    label = "Confirm in your wallet…";
  } else if (isConfirming) {
    icon = <Loader2 className="h-4 w-4 animate-spin" />;
    label = "Broadcasting to Monad…";
  } else if (isConfirmed) {
    tone = "border-credit-100 bg-credit-50 text-credit-600 dark:border-credit-500/30 dark:bg-credit-500/10 dark:text-credit-400";
    icon = <CheckCircle2 className="h-4 w-4" />;
    label = "Confirmed onchain";
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs font-medium",
        tone,
        className
      )}
    >
      <span className="flex items-center gap-1.5 truncate">
        {icon} <span className="truncate">{label}</span>
      </span>
      {hash && (
        <a
          href={explorerTx(hash)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 underline decoration-dotted underline-offset-2 hover:opacity-80"
        >
          View tx <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}
