"use client";

import { Activity as ActivityIcon, HandCoins, Receipt, UserPlus, Users, ExternalLink } from "lucide-react";
import { useLocalActivity, type ActivityItem } from "@/lib/activity";
import { Identity } from "@/components/Identity";
import { explorerTx } from "@/lib/web3/chains";
import { formatMon } from "@/lib/format";

/** Activity feed for a group — each entry links to its real Monad tx. */
export function Activity({ groupId }: { groupId: bigint }) {
  const items = useLocalActivity(groupId);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500">
          <ActivityIcon className="h-4 w-4" />
        </div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Onchain activity</h2>
        <span className="ml-auto text-xs text-slate-400">{items.length} txns</span>
      </div>

      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">
          No activity yet. Expenses, settlements and joins appear here — each with a link to its
          transaction on Monad.
        </p>
      ) : (
        <ul className="scroll-area max-h-72 space-y-2 overflow-y-auto pr-1">
          {items.map((it) => (
            <li
              key={it.id}
              className="flex items-center gap-2.5 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950/60"
            >
              <Row it={it} />
              <a
                href={explorerTx(it.txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto inline-flex shrink-0 items-center gap-1 text-[11px] text-slate-400 underline decoration-dotted hover:text-brand-500"
              >
                tx <ExternalLink className="h-3 w-3" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Row({ it }: { it: ActivityItem }) {
  const amt = it.amount ? BigInt(it.amount) : 0n;
  if (it.kind === "settle") {
    return (
      <span className="flex min-w-0 items-center gap-1.5 text-sm">
        <HandCoins className="h-3.5 w-3.5 shrink-0 text-credit-500" />
        <Identity address={it.from!} compact />
        <span className="text-slate-400">paid</span>
        <Identity address={it.to!} compact />
        <span className="ml-1 shrink-0 font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">
          {formatMon(amt)} MON
        </span>
      </span>
    );
  }
  if (it.kind === "expense") {
    return (
      <span className="flex min-w-0 items-center gap-1.5 text-sm">
        <Receipt className="h-3.5 w-3.5 shrink-0 text-brand-500" />
        <Identity address={it.payer!} compact />
        <span className="truncate text-slate-400">added “{it.description || "expense"}”</span>
        <span className="ml-1 shrink-0 font-mono text-xs text-slate-500">{formatMon(amt)} MON</span>
      </span>
    );
  }
  if (it.kind === "create") {
    return (
      <span className="flex min-w-0 items-center gap-1.5 text-sm">
        <Users className="h-3.5 w-3.5 shrink-0 text-brand-500" />
        <Identity address={it.member!} compact />
        <span className="text-slate-400">created the group</span>
      </span>
    );
  }
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-sm">
      <UserPlus className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      <Identity address={it.member!} compact />
      <span className="text-slate-400">joined the group</span>
    </span>
  );
}
