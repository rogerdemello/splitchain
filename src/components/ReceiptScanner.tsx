"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { Camera, Loader2, Sparkles, X, Check } from "lucide-react";
import { useAddExpense } from "@/lib/web3/hooks";
import { usePrice, formatUsd } from "@/lib/web3/price";
import { TxStatus } from "@/components/TxStatus";
import { Identity } from "@/components/Identity";
import { logActivity } from "@/lib/activity";
import { formatMon, monToWei, sameAddress } from "@/lib/format";
import { cn } from "@/lib/cn";

interface ReceiptScannerProps {
  groupId: bigint;
  members: readonly `0x${string}`[];
  onAdded: () => void;
  onClose: () => void;
}

interface ScanItem {
  name: string;
  amount: number; // in the receipt's own currency — used only as a split WEIGHT
  assignee: string; // member address, or "all"
}

// Keep the base64 payload comfortably under the server's MAX_B64 (180k).
const B64_TARGET = 165_000;

/** Downscale + JPEG-compress an image so its base64 stays under the server limit. */
async function compress(file: File): Promise<{ b64: string; mime: string }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = dataUrl;
  });

  const b64Len = (out: string) => out.length - (out.indexOf(",") + 1);

  // Try progressively smaller dimensions until the base64 fits under the limit.
  for (const maxDim of [1100, 900, 750, 600, 500]) {
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);

    let q = 0.82;
    let out = canvas.toDataURL("image/jpeg", q);
    while (b64Len(out) > B64_TARGET && q > 0.35) {
      q -= 0.12;
      out = canvas.toDataURL("image/jpeg", q);
    }
    if (b64Len(out) <= B64_TARGET) {
      return { b64: out.slice(out.indexOf(",") + 1), mime: "image/jpeg" };
    }
  }
  throw new Error("Image is too large even after compression — try a smaller photo.");
}

/** Distribute `total` wei across weights so the shares sum EXACTLY to total. */
function sharesFromWeights(total: bigint, weights: bigint[]): bigint[] {
  const wsum = weights.reduce((a, b) => a + b, 0n);
  if (wsum === 0n) return weights.map(() => 0n);
  const out = weights.map((w) => (total * w) / wsum);
  let rem = total - out.reduce((a, b) => a + b, 0n);
  const order = weights.map((w, i) => ({ w, i })).sort((a, b) => (b.w > a.w ? 1 : -1));
  let k = 0;
  while (rem > 0n && order.length) {
    out[order[k % order.length].i] += 1n;
    rem -= 1n;
    k++;
  }
  return out;
}

export function ReceiptScanner({ groupId, members, onAdded, onClose }: ReceiptScannerProps) {
  const { address } = useAccount();
  const price = usePrice();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<ScanItem[] | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [unit, setUnit] = useState<"USD" | "MON">("USD");
  const [billTotal, setBillTotal] = useState(""); // what to actually charge, in `unit`
  const [description, setDescription] = useState("Receipt");

  const add = useAddExpense();
  const lastRef = useRef<{ wei: bigint; description: string } | null>(null);

  const pick = () => fileRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    setBusy(true);
    setItems(null);
    try {
      const { b64, mime } = await compress(file);
      const res = await fetch("/api/receipt/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: b64, mimeType: mime }),
      });
      const data = await res.json();
      if (!data.ok) {
        setErr(
          data.reason === "no-key"
            ? "Receipt AI isn't configured — add items manually instead."
            : "Couldn't read that receipt. Try a clearer photo or add items manually."
        );
        return;
      }
      const cur = String(data.currency || "USD").toUpperCase();
      const scanned = (data.items as { name: string; amountUsd: number }[]).map((it) => ({
        name: it.name,
        amount: Number(it.amountUsd) || 0,
        assignee: "all" as const,
      }));
      const sum = scanned.reduce((a, b) => a + b.amount, 0);
      setCurrency(cur);
      setUnit(cur === "USD" ? "USD" : "MON");
      setDescription(`Receipt · ${scanned.length} items`);
      setBillTotal(String(Number(data.total) || sum || ""));
      setItems(scanned);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Something went wrong scanning the image.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // Per-member weight (their numeric share of the items).
  const weights = new Map<string, number>();
  const n = members.length || 1;
  for (const it of items ?? []) {
    if (it.assignee === "all") {
      const each = it.amount / n;
      for (const m of members)
        weights.set(m.toLowerCase(), (weights.get(m.toLowerCase()) ?? 0) + each);
    } else {
      weights.set(it.assignee.toLowerCase(), (weights.get(it.assignee.toLowerCase()) ?? 0) + it.amount);
    }
  }
  const weightSum = (items ?? []).reduce((a, b) => a + b.amount, 0);

  const billNum = Number(billTotal);
  const validTotal = Number.isFinite(billNum) && billNum > 0;

  const totalWei = !validTotal
    ? 0n
    : unit === "MON"
      ? (() => {
          try {
            return monToWei(billTotal);
          } catch {
            return 0n;
          }
        })()
      : price.usdToWei(billNum);
  const usdCents = unit === "USD" && validTotal ? BigInt(Math.round(billNum * 100)) : 0n;

  // Each member's portion of the chosen total, scaled by their item weight.
  const portionOf = (m: string) => {
    if (weightSum <= 0) return 0;
    return (billNum * (weights.get(m.toLowerCase()) ?? 0)) / weightSum;
  };

  const create = async () => {
    setErr(null);
    try {
      const parts: `0x${string}`[] = [];
      const w: bigint[] = [];
      for (const m of members) {
        const wt = weights.get(m.toLowerCase()) ?? 0;
        if (wt > 0) {
          parts.push(m);
          w.push(BigInt(Math.round(wt * 1_000_000)));
        }
      }
      if (parts.length === 0 || totalWei === 0n) throw new Error("Enter a bill total and assign items");
      const shares = sharesFromWeights(totalWei, w);
      const desc = description.trim() || "Receipt";
      lastRef.current = { wei: totalWei, description: desc };
      await add.addExpense(groupId, totalWei, parts, shares, desc, usdCents);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not create expense");
    }
  };

  useEffect(() => {
    if (!add.isConfirmed) return;
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
    const t = setTimeout(() => {
      add.reset();
      onAdded();
      onClose();
    }, 1200);
    return () => clearTimeout(t);
  }, [add.isConfirmed, add, onAdded, onClose, groupId, address]);

  const busyTx = add.isPending || add.isConfirming;
  const monText = totalWei > 0n ? `${formatMon(totalWei)} MON` : "—";
  const usdText = price ? formatUsd(price.weiToUsd(totalWei)) : "";

  return (
    <div className="rounded-2xl border border-brand-500/40 bg-brand-500/[0.03] p-5 shadow-sm dark:bg-brand-500/[0.06]">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/15 text-brand-500">
          <Sparkles className="h-4 w-4" />
        </div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Scan a receipt</h2>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Close scanner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFile} className="hidden" />

      {!items && (
        <button
          type="button"
          onClick={pick}
          disabled={busy}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-sm transition",
            busy
              ? "cursor-wait border-brand-500/40 text-slate-400"
              : "border-slate-300 text-slate-500 hover:border-brand-500 hover:text-brand-500 dark:border-slate-700"
          )}
        >
          {busy ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin" />
              Reading your receipt…
            </>
          ) : (
            <>
              <Camera className="h-6 w-6" />
              Take a photo or upload a receipt
              <span className="text-xs text-slate-400">AI reads the items — you just assign who had what</span>
            </>
          )}
        </button>
      )}

      {err && <p className="mt-3 text-xs text-debit-500">{err}</p>}

      {items && (
        <div className="space-y-3">
          {/* Items with per-item assignment */}
          <div className="space-y-2">
            {items.map((it, idx) => (
              <div key={idx} className="rounded-xl border border-slate-200 p-2.5 dark:border-slate-800">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <input
                    value={it.name}
                    onChange={(e) =>
                      setItems((p) => p && p.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))
                    }
                    className="min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-800 outline-none dark:text-slate-100"
                  />
                  <input
                    value={String(it.amount)}
                    onChange={(e) =>
                      setItems(
                        (p) =>
                          p &&
                          p.map((x, i) =>
                            i === idx ? { ...x, amount: Number(e.target.value.replace(/[^0-9.]/g, "")) || 0 } : x
                          )
                      )
                    }
                    inputMode="decimal"
                    className="w-20 rounded-md border border-slate-200 bg-white px-2 py-1 text-right font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setItems((p) => p && p.map((x, i) => (i === idx ? { ...x, assignee: "all" } : x)))}
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[11px] transition",
                      it.assignee === "all"
                        ? "border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-300"
                        : "border-slate-200 text-slate-400 dark:border-slate-700"
                    )}
                  >
                    Shared
                  </button>
                  {members.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setItems((p) => p && p.map((x, i) => (i === idx ? { ...x, assignee: m } : x)))}
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[11px] font-mono transition",
                        sameAddress(it.assignee, m)
                          ? "border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-300"
                          : "border-slate-200 text-slate-400 dark:border-slate-700"
                      )}
                    >
                      {sameAddress(m, address) ? "You" : m.slice(2, 6)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Bill total + unit — decouples receipt currency from the onchain amount */}
          <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
            <div className="flex items-center justify-between gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                  Bill total {currency !== "USD" && currency !== "MON" && (
                    <span className="text-slate-400">(receipt was {currency})</span>
                  )}
                </label>
                <p className="text-[11px] text-slate-400">What the group actually pays, split by the items above.</p>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  value={billTotal}
                  onChange={(e) => setBillTotal(e.target.value.replace(/[^0-9.]/g, ""))}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="w-24 rounded-md border border-slate-200 bg-white px-2 py-1 text-right font-mono text-sm dark:border-slate-700 dark:bg-slate-950"
                />
                {(["USD", "MON"] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUnit(u)}
                    className={cn(
                      "rounded-md px-1.5 py-1 text-[10px] font-mono font-semibold transition",
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
            {unit === "USD" && !price.isLive && (
              <p className="mt-1 text-right text-[11px] text-amber-500">using fallback MON/USD rate</p>
            )}
          </div>

          {/* Per-person summary */}
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/60">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Everyone owes
            </div>
            <div className="space-y-1">
              {members.map((m) => {
                const portion = portionOf(m);
                if (portion <= 0) return null;
                return (
                  <div key={m} className="flex items-center justify-between text-sm">
                    <Identity address={m} you={sameAddress(m, address)} compact />
                    <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                      {unit === "USD" ? formatUsd(portion) : `${portion.toFixed(4)} MON`}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2 text-sm dark:border-slate-800">
              <span className="font-semibold text-slate-700 dark:text-slate-200">Total onchain</span>
              <span className="text-right">
                <span className="block font-mono font-semibold text-slate-900 dark:text-white">{monText}</span>
                <span className="block text-[11px] text-slate-400">≈ {usdText}</span>
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={create}
            disabled={busyTx || totalWei === 0n}
            className={cn(
              "inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition",
              busyTx || totalWei === 0n
                ? "cursor-not-allowed bg-slate-300 dark:bg-slate-700"
                : "bg-brand-500 hover:bg-brand-600"
            )}
          >
            <Check className="h-4 w-4" />
            {busyTx ? "Recording…" : "Record split onchain"}
          </button>
          <TxStatus
            hash={add.hash}
            isPending={add.isPending}
            isConfirming={add.isConfirming}
            isConfirmed={add.isConfirmed}
            error={add.error}
          />
        </div>
      )}
    </div>
  );
}
