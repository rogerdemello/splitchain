"use client";

import { useSyncExternalStore } from "react";

/**
 * Per-group recurring expense templates (rent, subscriptions, utilities) saved
 * locally so they can be re-added in one tap each month. Mirrors the
 * `groups.ts` / `activity.ts` store pattern. Templates only prefill the form —
 * the user still confirms the on-chain transaction.
 */

const KEY = "splitchain:templates";
const EMPTY: ExpenseTemplate[] = [];

export interface ExpenseTemplate {
  id: string;
  description: string;
  amount: string; // as typed
  unit: "MON" | "USD";
  participants: string[]; // lowercased addresses
}

type State = Record<string, ExpenseTemplate[]>;

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

export function saveTemplate(groupId: bigint | string, tpl: Omit<ExpenseTemplate, "id">) {
  const gid = groupId.toString();
  const id = `${gid}-${tpl.description}-${tpl.amount}-${tpl.unit}`.toLowerCase();
  const existing = state[gid] ?? [];
  const next = [{ ...tpl, id }, ...existing.filter((t) => t.id !== id)].slice(0, 12);
  state = { ...state, [gid]: next };
  persist();
  emit();
}

export function removeTemplate(groupId: bigint | string, id: string) {
  const gid = groupId.toString();
  const existing = state[gid] ?? [];
  state = { ...state, [gid]: existing.filter((t) => t.id !== id) };
  persist();
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Reactive list of a group's saved templates. */
export function useTemplates(groupId: bigint | undefined): ExpenseTemplate[] {
  const gid = groupId?.toString();
  return useSyncExternalStore(
    subscribe,
    () => (gid ? state[gid] ?? EMPTY : EMPTY),
    () => EMPTY
  );
}
