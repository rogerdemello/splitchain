"use client";

import { useSyncExternalStore } from "react";

/**
 * Per-group activity log.
 *
 * Monad's public RPC limits `eth_getLogs` to a 100-block range, and blocks are
 * sub-second — so scanning historical events from the chain is impractical for
 * a feed. Instead we record each action as the app confirms it, keyed by group,
 * with the REAL transaction hash. Every entry links to the Monad explorer, so
 * it's genuine on-chain proof — just sourced from the receipts we already have
 * rather than a (rate-limited) log scan.
 */

const KEY = "splitchain:activity";
const CAP = 60; // per group
const EMPTY: ActivityItem[] = [];

export interface ActivityItem {
  id: string; // stable key for dedup (txHash + kind + counterparty)
  kind: "expense" | "settle" | "join" | "create";
  txHash: `0x${string}`;
  ts: number;
  from?: string;
  to?: string;
  payer?: string;
  member?: string;
  amount?: string; // wei, as string (JSON-safe)
  description?: string;
}

type State = Record<string, ActivityItem[]>;

let state: State = load();
const listeners = new Set<() => void>();

function load(): State {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore quota */
  }
}

function emit() {
  for (const l of listeners) l();
}

export function logActivity(groupId: bigint | string, item: ActivityItem) {
  const gid = groupId.toString();
  const existing = state[gid] ?? [];
  if (existing.some((x) => x.id === item.id)) return; // dedup
  const next = [item, ...existing].slice(0, CAP);
  state = { ...state, [gid]: next };
  persist();
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Reactive activity list for a group (newest first). */
export function useLocalActivity(groupId: bigint | undefined): ActivityItem[] {
  const gid = groupId?.toString();
  return useSyncExternalStore(
    subscribe,
    () => (gid ? state[gid] ?? EMPTY : EMPTY),
    () => EMPTY
  );
}
