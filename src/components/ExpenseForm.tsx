"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { Receipt, ArrowRight, Camera, Repeat, X } from "lucide-react";
import { useAddExpense } from "@/lib/web3/hooks";
import { usePrice, formatUsd } from "@/lib/web3/price";
import { TxStatus } from "@/components/TxStatus";
import { ReceiptScanner } from "@/components/ReceiptScanner";
import { Identity } from "@/components/Identity";
import { logActivity } from "@/lib/activity";
import { useTemplates, saveTemplate, removeTemplate } from "@/lib/templates";
import { monToWei, formatMon, sameAddress } from "@/lib/format";
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
  const price = usePrice();
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState<"MON" | "USD">("MON");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [formErr, setFormErr] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [splitMode, setSplitMode] = useState<"equal" | "custom">("equal");
  const [customShares, setCustomShares] = useState<Record<string, string>>({});

  const add = useAddExpense();
  const lastRef = useRef<{ wei: bigint; description: string } | null>(null);
  const templates = useTemplates(groupId);

  const applyTemplate = (t: { description: string; amount: string; unit: "MON" | "USD"; participants: string[] }) => {
    setDescription(t.description);
    setAmount(t.amount);
    setUnit(t.unit);
    const set: Record<string, boolean> = {};
    for (const m of members) set[m.toLowerCase()] = t.participants.includes(m.toLowerCase());
    // If the saved participants don't match this group, fall back to everyone.
    setSelected(Object.values(set).some(Boolean) ? set : Object.fromEntries(members.map((m) => [m.toLowerCase(), true])));
  };

  const saveCurrent = () => {
    if (!amount) return;
    saveTemplate(groupId, {
      description: description.trim() || "Expense",
      amount,
      unit,
      participants: participants.map((m) => m.toLowerCase()),
    });
  };

  // Default: everyone shares the expense.
  useEffect(() => {
    setSelected(Object.fromEntries(members.map((m) => [m.toLowerCase(), true])));
  }, [members]);

  useEffect(() => {
    if (add.isConfirmed) {
      if (add.hash && lastRef.current) {
        logActivity(groupId, {
          id: `${add.hash}-expense`,
          kind: "expense",
          txHash: add.hash,
          ts: Date.now(),
          payer: address,
          amount: lastRef.current.wei.toString(),
          description: lastRef.current.description,
        });
      }
      setAmount("");
      setDescription("");
      setCustomShares({});
      onAdded();
      const t = setTimeout(() => add.reset(), 1500);
      return () => clearTimeout(t);
    }
  }, [add.isConfirmed, add, onAdded, groupId, address]);

  const participants = useMemo(
    () => members.filter((m) => selected[m.toLowerCase()]),
    [members, selected]
  );

  // Resolve the entered amount(s) into MON wei shares + a usdCents tag.
  const resolved = useMemo(() => {
    try {
      if (participants.length === 0) return null;

      // Custom: each participant owes exactly what you type; total = the sum.
      if (splitMode === "custom") {
        const shares: bigint[] = [];
        let wei = 0n;
        let usdTotal = 0;
        for (const m of participants) {
          const s = (customShares[m.toLowerCase()] ?? "").trim();
          const num = Number(s);
          if (!s || !Number.isFinite(num) || num <= 0) return null; // every share required
          const w = unit === "USD" ? price.usdToWei(num) : monToWei(s);
          if (w === 0n) return null;
          shares.push(w);
          wei += w;
          usdTotal += num;
        }
        if (wei === 0n) return null;
        const usdCents = unit === "USD" ? BigInt(Math.round(usdTotal * 100)) : 0n;
        return { wei, shares, per: 0n, usdCents };
      }

      // Equal: split the entered total evenly.
      if (!amount) return null;
      const num = Number(amount);
      if (!Number.isFinite(num) || num <= 0) return null;
      let wei: bigint;
      let usdCents = 0n;
      if (unit === "USD") {
        wei = price.usdToWei(num);
        usdCents = BigInt(Math.round(num * 100));
      } else {
        wei = monToWei(amount);
      }
      if (wei === 0n) return null;
      const shares = computeShares(wei, participants.length);
      return { wei, shares, per: shares[0], usdCents };
    } catch {
      return null;
    }
  }, [amount, participants, splitMode, customShares, unit, price]);

  const submit = async () => {
    setFormErr(null);
    try {
      if (!resolved) throw new Error("Enter an amount and pick participants");
      const desc = description.trim() || "Expense";
      lastRef.current = { wei: resolved.wei, description: desc };
      await add.addExpense(
        groupId,
        resolved.wei,
        participants as `0x${string}`[],
        resolved.shares,
        desc,
        resolved.usdCents
      );
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : "Invalid input");
    }
  };

  const busy = add.isPending || add.isConfirming;

  if (scanning) {
    return (
      <ReceiptScanner
        groupId={groupId}
        members={members}
        onAdded={onAdded}
        onClose={() => setScanning(false)}
      />
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500">
          <Receipt className="h-4 w-4" />
        </div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Add an expense</h2>
        <button
          type="button"
          onClick={() => setScanning(true)}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-brand-500/40 bg-brand-500/5 px-2.5 py-1.5 text-xs font-semibold text-brand-600 transition hover:bg-brand-500/10 dark:text-brand-300"
        >
          <Camera className="h-3.5 w-3.5" /> Scan receipt
        </button>
      </div>

      {templates.length > 0 && (
        <div className="mb-3">
          <p className="mb-1 flex items-center gap-1 text-[11px] font-medium text-slate-400">
            <Repeat className="h-3 w-3" /> Recurring
          </p>
          <div className="flex flex-wrap gap-1.5">
            {templates.map((t) => (
              <span
                key={t.id}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 py-1 pl-2.5 pr-1 text-xs dark:border-slate-700 dark:bg-slate-950/60"
              >
                <button
                  type="button"
                  onClick={() => applyTemplate(t)}
                  className="font-medium text-slate-600 hover:text-brand-500 dark:text-slate-300"
                  title="Fill the form with this"
                >
                  {t.description} · {t.amount} {t.unit}
                </button>
                <button
                  type="button"
                  onClick={() => removeTemplate(groupId, t.id)}
                  className="text-slate-300 hover:text-debit-500"
                  aria-label="Remove template"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
              Amount
            </label>
            <div className="flex gap-1">
              {(["MON", "USD"] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUnit(u)}
                  className={cn(
                    "rounded-md px-1.5 py-0.5 text-[10px] font-mono font-semibold transition",
                    unit === u
                      ? "bg-brand-500/15 text-brand-600 dark:text-brand-300"
                      : "text-slate-400 hover:text-slate-500"
                  )}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
          {splitMode === "custom" ? (
            <div className="flex h-[38px] w-full items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 font-mono text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/60">
              {resolved ? `${formatMon(resolved.wei)} MON total` : "sum of shares below"}
            </div>
          ) : (
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              placeholder={unit === "USD" ? "$0.00" : "0.0"}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm outline-none ring-brand-500/30 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          )}
          {resolved && (
            <p className="mt-1 font-mono text-[11px] text-slate-400">
              {unit === "USD"
                ? `≈ ${formatMon(resolved.wei)} MON`
                : `≈ ${formatUsd(price.weiToUsd(resolved.wei))}`}
            </p>
          )}
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
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Split between
          </label>
          <div className="flex items-center gap-2">
            {splitMode === "equal" && resolved && (
              <span className="font-mono text-xs text-slate-400">
                {formatMon(resolved.per)} MON each
              </span>
            )}
            <div className="flex gap-1">
              {(["equal", "custom"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSplitMode(mode)}
                  className={cn(
                    "rounded-md px-1.5 py-0.5 text-[10px] font-semibold capitalize transition",
                    splitMode === mode
                      ? "bg-brand-500/15 text-brand-600 dark:text-brand-300"
                      : "text-slate-400 hover:text-slate-500"
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>

        {splitMode === "equal" ? (
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
                    "rounded-full border px-2 py-1 transition",
                    on
                      ? "border-brand-500 bg-brand-500/10"
                      : "border-slate-200 opacity-50 dark:border-slate-700"
                  )}
                >
                  <Identity address={m} you={sameAddress(m, address)} compact />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-1.5">
            {members.map((m) => {
              const key = m.toLowerCase();
              const on = !!selected[key];
              return (
                <div key={m} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelected((p) => ({ ...p, [key]: !p[key] }))}
                    className={cn(
                      "flex-1 rounded-lg border px-2.5 py-1.5 text-left transition",
                      on ? "border-brand-500 bg-brand-500/5" : "border-slate-200 opacity-50 dark:border-slate-700"
                    )}
                  >
                    <Identity address={m} you={sameAddress(m, address)} compact />
                  </button>
                  <input
                    value={customShares[key] ?? ""}
                    onChange={(e) =>
                      setCustomShares((p) => ({ ...p, [key]: e.target.value.replace(/[^0-9.]/g, "") }))
                    }
                    disabled={!on}
                    inputMode="decimal"
                    placeholder="0.0"
                    className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-right font-mono text-xs outline-none ring-brand-500/30 focus:ring-2 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                  <span className="w-8 text-[10px] font-mono text-slate-400">{unit}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {formErr && <p className="mt-2 text-xs text-debit-500">{formErr}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={busy || !resolved}
        className={cn(
          "mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition",
          busy || !resolved ? "cursor-not-allowed bg-slate-300 dark:bg-slate-700" : "bg-brand-500 hover:bg-brand-600"
        )}
      >
        Record expense <ArrowRight className="h-4 w-4" />
      </button>
      {amount && (
        <button
          type="button"
          onClick={saveCurrent}
          className="mt-2 inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-brand-500"
        >
          <Repeat className="h-3 w-3" /> Save as recurring
        </button>
      )}
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
