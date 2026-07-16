"use client";

import { useSyncExternalStore } from "react";

/**
 * Local record of which group ids this browser has created / joined / opened,
 * so the "Your groups" screen can list them. Group membership itself lives
 * on-chain; this is just a convenience index (the chain has no "groups for
 * address X" view). Reactive via a tiny store, mirroring `nicknames.ts`.
 */

const KEY = "splitchain:groups";
const EMPTY: string[] = []; // stable server snapshot

let ids: string[] = load();
const listeners = new Set<() => void>();

function load(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(raw) ? raw.map(String) : [];
  } catch {
    return [];
  }
}

function emit() {
  for (const l of listeners) l();
}

export function rememberGroup(id: bigint | string) {
  const s = id.toString();
  if (ids.includes(s)) return;
  ids = [s, ...ids];
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* ignore quota */
  }
  emit();
}

export function forgetGroup(id: bigint | string) {
  const s = id.toString();
  if (!ids.includes(s)) return;
  ids = ids.filter((x) => x !== s);
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Reactive list of remembered group ids (newest first). */
export function useGroups(): string[] {
  return useSyncExternalStore(
    subscribe,
    () => ids,
    () => EMPTY
  );
}
