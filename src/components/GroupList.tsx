"use client";

import { Users, ChevronRight, X } from "lucide-react";
import { useGroups, forgetGroup } from "@/lib/groups";
import { useGroupInfo } from "@/lib/web3/hooks";

interface GroupListProps {
  onOpen: (id: bigint) => void;
}

/** Lists the groups this browser has created/joined/opened. */
export function GroupList({ onOpen }: GroupListProps) {
  const ids = useGroups();
  if (ids.length === 0) return null;

  return (
    <div className="mx-auto mb-6 max-w-3xl">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Recent groups
      </h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {ids.map((id) => (
          <GroupCard key={id} id={id} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

function GroupCard({ id, onOpen }: { id: string; onOpen: (id: bigint) => void }) {
  let gid: bigint;
  try {
    gid = BigInt(id);
  } catch {
    return null;
  }
  const info = useGroupInfo(gid);
  const data = info.data as readonly [string, readonly `0x${string}`[], bigint] | undefined;
  const name = data?.[0];
  const memberCount = data?.[1]?.length ?? 0;
  const missing = !info.isLoading && info.isError;

  return (
    <div className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-brand-500/50 dark:border-slate-800 dark:bg-slate-900">
      <button
        type="button"
        onClick={() => onOpen(gid)}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500">
          <Users className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
            {missing ? `Group #${id}` : name || `Group #${id}`}
          </p>
          <p className="font-mono text-[11px] text-slate-400">
            #{id}
            {!missing && ` · ${memberCount} member${memberCount === 1 ? "" : "s"}`}
            {missing && " · not found on this network"}
          </p>
        </div>
        <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-brand-500" />
      </button>
      <button
        type="button"
        onClick={() => forgetGroup(id)}
        className="shrink-0 rounded-md p-1 text-slate-300 opacity-0 transition hover:text-debit-500 group-hover:opacity-100"
        aria-label="Remove from list"
        title="Remove from this list"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
