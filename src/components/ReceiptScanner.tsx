"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { Camera, Loader2, Sparkles, X, Check } from "lucide-react";
import { useAddExpense } from "@/lib/web3/hooks";
import { usePrice, formatUsd } from "@/lib/web3/price";
import { TxStatus } from "@/components/TxStatus";
import { Identity } from "@/components/Identity";
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
  amount: number;
  assignee: string; // member address, or "all"
}

/** Downscale + JPEG-compress an image file so its base64 stays under NIM's limit. */
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
  const maxDim = 1100;
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
  let q = 0.8;
  let out = canvas.toDataURL("image/jpeg", q);
  while (out.length > 175_000 * 1.37 && q > 0.3) {
    q -= 0.12;
    out = canvas.toDataURL("image/jpeg", q);
  }
  return { b64: out.replace(/^data:[^,]+,/, ""), mime: "image/jpeg" };
}

/** Distribute `total` wei across weights so the shares sum EXACTLY to total. */
function sharesFromWeights(total: bigint, weights: bigint[]): bigint[] {
  const wsum = weights.reduce((a, b) => a + b, 0n);
  if (wsum === 0n) return weights.map(() => 0n);
  const out = weights.map((w) => (total * w) / wsum);
  let rem = total - out.reduce((a, b) => a + b, 0n);
  // Hand the rounding remainder to the largest-weight participants.
  const order = weights
    .map((w, i) => ({ w, i }))
    .sort((a, b) => (b.w > a.w ? 1 : -1));
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
  const [description, setDescription] = useState("Receipt");

  const add = useAddExpense();

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
      setCurrency(cur);
      setUnit(cur === "USD" ? "USD" : "MON");
      setDescription(`Receipt · ${data.items.length} items`);
      setItems(
        (data.items as { name: string; amountUsd: number }[]).map((it) => ({
          name: it.name,
          amount: Number(it.amountUsd) || 0,
          assignee: "all",
        }))
      );
    } catch {
      setErr("Something went wrong scanning the image.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // Per-member numeric subtotal from the current assignments.
  const subtotals = new Map<string, number>();
  const n = members.length;
  for (const it of items ?? []) {
    if (it.assignee === "all") {
      const each = it.amount / n;
      for (const m of members) subtotals.set(m.toLowerCase(), (subtotals.get(m.toLowerCase()) ?? 0) + each);
    } else {
      subtotals.set(it.assignee.toLowerCase(), (subtotals.get(it.assignee.toLowerCase()) ?? 0) + it.amount);
    }
  }
  const totalNum = (items ?? []).reduce((a, b) => a + b.amount, 0);

  const totalWei =
    unit === "MON"
      ? (() => {
          try {
            return monToWei(totalNum.toFixed(6));
          } catch {
            return 0n;
          }
        })()
      : price.usdToWei(totalNum);
  const usdCents = unit === "USD" ? BigInt(Math.round(totalNum * 100)) : 0n;

  const create = async () => {
    setErr(null);
    try {
      const parts: `0x${string}`[] = [];
      const weights: bigint[] = [];
      for (const m of members) {
        const sub = subtotals.get(m.toLowerCase()) ?? 0;
        if (sub > 0) {
          parts.push(m);
          // integer micro-weights preserve proportions without float drift
          weights.push(BigInt(Math.round(sub * 1_000_000)));
        }
      }
      if (parts.length === 0 || totalWei === 0n) throw new Error("Nothing to split");
      const shares = sharesFromWeights(totalWei, weights);
      await add.addExpense(groupId, totalWei, parts, shares, description.trim() || "Receipt", usdCents);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not create expense");
    }
  };

  // Close after a confirmed tx.
  useEffect(() => {
    if (!add.isConfirmed) return;
    const t = setTimeout(() => {
      add.reset();
      onAdded();
      onClose();
    }, 1200);
    return () => clearTimeout(t);
  }, [add.isConfirmed, add, onAdded, onClose]);

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
          {/* Unit toggle */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Detected {currency}. Split in:</span>
            {(["USD", "MON"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUnit(u)}
                className={cn(
                  "rounded-full border px-2.5 py-1 font-mono transition",
                  unit === u
                    ? "border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-300"
                    : "border-slate-200 text-slate-400 dark:border-slate-700"
                )}
              >
                {u}
              </button>
            ))}
            {unit === "USD" && !price.isLive && (
              <span className="text-[11px] text-amber-500">· using fallback rate</span>
            )}
          </div>

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

          {/* Per-person summary */}
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/60">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Everyone owes
            </div>
            <div className="space-y-1">
              {members.map((m) => {
                const sub = subtotals.get(m.toLowerCase()) ?? 0;
                if (sub <= 0) return null;
                return (
                  <div key={m} className="flex items-center justify-between text-sm">
                    <Identity address={m} you={sameAddress(m, address)} compact />
                    <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                      {unit === "USD" ? formatUsd(sub) : `${sub.toFixed(4)} MON`}
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
