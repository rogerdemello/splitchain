"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { Plus, X, Users, ArrowRight, FolderOpen } from "lucide-react";
import { useCreateGroup, groupIdFromLogs } from "@/lib/web3/hooks";
import { TxStatus } from "@/components/TxStatus";
import { isAddress, shortAddress, sameAddress } from "@/lib/format";
import { cn } from "@/lib/cn";

interface GroupGateProps {
  onGroupReady: (groupId: bigint) => void;
}

export function GroupGate({ onGroupReady }: GroupGateProps) {
  const { address } = useAccount();
  const [name, setName] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [inputErr, setInputErr] = useState<string | null>(null);
  const [loadId, setLoadId] = useState("");

  const create = useCreateGroup();

  useEffect(() => {
    if (create.isConfirmed && create.receipt) {
      const gid = groupIdFromLogs(create.receipt.logs);
      if (gid !== undefined) onGroupReady(gid);
    }
  }, [create.isConfirmed, create.receipt, onGroupReady]);

  const addMember = () => {
    setInputErr(null);
    const v = draft.trim();
    if (!isAddress(v)) {
      setInputErr("Enter a valid 0x… address");
      return;
    }
    if (sameAddress(v, address)) {
      setInputErr("You're added automatically");
      return;
    }
    if (members.some((m) => sameAddress(m, v))) {
      setInputErr("Already added");
      return;
    }
    setMembers((prev) => [...prev, v]);
    setDraft("");
  };

  const submit = async () => {
    if (!name.trim() || members.length === 0) return;
    try {
      await create.createGroup(name.trim(), members as `0x${string}`[]);
    } catch {
      /* surfaced via create.error */
    }
  };

  const busy = create.isPending || create.isConfirming;

  return (
    <div className="mx-auto grid max-w-3xl gap-4 md:grid-cols-5">
      {/* Create */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:col-span-3">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500">
            <Users className="h-4 w-4" />
          </div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Start a group
          </h2>
        </div>

        <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
          Group name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Goa Trip ✈️"
          className="mb-4 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        />

        <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
          Friends (wallet addresses)
        </label>
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addMember())}
            placeholder="0x…"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm outline-none ring-brand-500/30 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
          <button
            type="button"
            onClick={addMember}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
        {inputErr && <p className="mt-1 text-xs text-debit-500">{inputErr}</p>}

        <div className="mt-3 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/10 px-2.5 py-1 text-xs font-medium text-brand-600 dark:text-brand-300">
            You {shortAddress(address)}
          </span>
          {members.map((m) => (
            <span
              key={m}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-mono text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            >
              {shortAddress(m)}
              <button type="button" onClick={() => setMembers((p) => p.filter((x) => x !== m))}>
                <X className="h-3 w-3 hover:text-debit-500" />
              </button>
            </span>
          ))}
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={busy || !name.trim() || members.length === 0}
          className={cn(
            "mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition",
            busy || !name.trim() || members.length === 0
              ? "cursor-not-allowed bg-slate-300 dark:bg-slate-700"
              : "bg-brand-500 hover:bg-brand-600"
          )}
        >
          Create group onchain <ArrowRight className="h-4 w-4" />
        </button>
        <TxStatus
          className="mt-3"
          hash={create.hash}
          isPending={create.isPending}
          isConfirming={create.isConfirming}
          isConfirmed={create.isConfirmed}
          error={create.error}
        />
      </div>

      {/* Load existing */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:col-span-2">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800">
            <FolderOpen className="h-4 w-4" />
          </div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Open a group
          </h2>
        </div>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          Already in a group? Enter its id to jump back in.
        </p>
        <div className="flex gap-2">
          <input
            value={loadId}
            onChange={(e) => setLoadId(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="Group #"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm outline-none ring-brand-500/30 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
          <button
            type="button"
            onClick={() => loadId !== "" && onGroupReady(BigInt(loadId))}
            disabled={loadId === ""}
            className="shrink-0 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Open
          </button>
        </div>
      </div>
    </div>
  );
}
