"use client";

import { formatMon } from "@/lib/format";
import type { ActivityItem } from "@/lib/activity";

/**
 * Export a group's ledger (expenses + settlements) to a CSV file for records or
 * bookkeeping. No dependencies — builds the string and triggers a download.
 */

interface ExpenseRow {
  payer: `0x${string}`;
  amount: bigint;
  description: string;
  amountUsdCents?: bigint;
}

function escape(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map((c) => escape(c ?? "")).join(",")).join("\n");
}

export function downloadLedgerCsv(
  groupName: string,
  expenses: readonly ExpenseRow[],
  activity: readonly ActivityItem[]
) {
  const header = ["Type", "Description", "Payer / From", "To", "Amount (MON)", "Amount (USD)", "Tx"];
  const rows: string[][] = [header];

  for (const e of expenses) {
    const usd = e.amountUsdCents && e.amountUsdCents > 0n ? (Number(e.amountUsdCents) / 100).toFixed(2) : "";
    rows.push(["Expense", e.description || "Expense", e.payer, "", formatMon(e.amount), usd, ""]);
  }

  for (const a of activity) {
    if (a.kind !== "settle") continue;
    const mon = a.amount ? formatMon(BigInt(a.amount)) : "";
    rows.push(["Settlement", "", a.from ?? "", a.to ?? "", mon, "", a.txHash]);
  }

  const csv = toCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeName = (groupName || "splitchain").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  a.href = url;
  a.download = `${safeName}-ledger.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
