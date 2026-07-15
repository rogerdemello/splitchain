"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { Receipt, ArrowRight } from "lucide-react";
import { useAddExpense } from "@/lib/web3/hooks";
import { TxStatus } from "@/components/TxStatus";
import { monToWei, formatMon, shortAddress, sameAddress } from "@/lib/format";
import { cn } from "@/lib/cn";

interface ExpenseFormProps {
  groupId: bigint;
  members: readonly `0x${string}`[];
  onAdded: () => void;
}

/** Equal split with exact remainder distribution so sum(shares) === amount. */
function computeShares(amount: bigint, n: number): bigint[] {
  const base = amount / BigInt(n);
  const rem = Number(amount % BigInt(n));
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1n : 0n));
}

export function ExpenseForm({ groupId, members, onAdded }: ExpenseFormProps) {
  const { address } = useAccount();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [formErr, setFormErr] = useState<string | null>(null);

  const add = useAddExpense();

  // Default: everyone shares the expense.
  useEffect(() => {
    setSelected(Object.fromEntries(members.map((m) => [m.toLowerCase(), true])));
  }, [members]);

  useEffect(() => {
    if (add.isConfirmed) {
      setAmount("");
      setDescription("");
      onAdded();
      const t = setTimeout(() => add.reset(), 1500);
      return () => clearTimeout(t);
    }
  }, [add.isConfirmed, add, onAdded]);

  const participants = useMemo(
    () => members.filter((m) => selected[m.toLowerCase()]),
    [members, selected]
  );

  const preview = useMemo(() => {
    try {
      if (!amount || participants.length === 0) return null;
      const wei = monToWei(amount);
      const shares = computeShares(wei, participants.length);
      return { wei, shares, per: shares[0] };
    } catch {
      return null;
    }
  }, [amount, participants.length]);

  const submit = async () => {
    setFormErr(null);
    try {
      const wei = monToWei(amount);
      if (participants.length === 0) throw new Error("Pick at least one participant");
      const shares = computeShares(wei, participants.length);
      await add.addExpense(
        groupId,
        wei,
        participants as `0x${string}`[],
        shares,
        description.trim() || "Expense"
      );
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : "Invalid input");
    }
  };

  const busy = add.isPending || add.isConfirming;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500">
          <Receipt className="h-4 w-4" />
        </div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Add an expense</h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
            Amount (MON)
          </label>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="decimal"
            placeholder="0.0"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm outline-none ring-brand-500/30 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
            What for?
          </label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Hotel, dinner…"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Split between
          </label>
          {preview && (
            <span className="font-mono text-xs text-slate-400">
              {formatMon(preview.per)} MON each
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {members.map((m) => {
            const on = !!selected[m.toLowerCase()];
            return (
              <button
                key={m}
                type="button"
                onClick={() =>
                  setSelected((p) => ({ ...p, [m.toLowerCase()]: !p[m.toLowerCase()] }))
                }
                className={cn(
                  "rounded-full border px-2.5 py-1 font-mono text-xs transition",
                  on
                    ? "border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-300"
                    : "border-slate-200 text-slate-400 dark:border-slate-700"
                )}
              >
                {sameAddress(m, address) ? "You" : shortAddress(m)}
              </button>
            );
          })}
        </div>
      </div>

      {formErr && <p className="mt-2 text-xs text-debit-500">{formErr}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={busy || !preview}
        className={cn(
          "mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition",
          busy || !preview ? "cursor-not-allowed bg-slate-300 dark:bg-slate-700" : "bg-brand-500 hover:bg-brand-600"
        )}
      >
        Record expense <ArrowRight className="h-4 w-4" />
      </button>
      <TxStatus
        className="mt-3"
        hash={add.hash}
        isPending={add.isPending}
        isConfirming={add.isConfirming}
        isConfirmed={add.isConfirmed}
        error={add.error}
      />
    </div>
  );
}
