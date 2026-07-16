"use client";

import { useSyncExternalStore } from "react";

/**
 * Local address book — friendly names for wallet addresses, stored in
 * localStorage. Purely a display convenience (nothing on-chain); makes balances
 * readable ("Aditi owes you" instead of "0x9f…3ab"). Reactive via a tiny store
 * so renaming updates everywhere at once.
 */

const KEY = "splitchain:nicknames";
type Book = Record<string, string>;

let book: Book = load();
const listeners = new Set<() => void>();

function load(): Book {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

function emit() {
  for (const l of listeners) l();
}

export function getNickname(address?: string): string | undefined {
  if (!address) return undefined;
  return book[address.toLowerCase()];
}

export function setNickname(address: string, name: string) {
  const key = address.toLowerCase();
  const next = { ...book };
  const trimmed = name.trim();
  if (trimmed) next[key] = trimmed;
  else delete next[key];
  book = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(book));
  } catch {
    /* ignore quota */
  }
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Reactive read of the whole address book. */
export function useNicknames(): Book {
  return useSyncExternalStore(
    subscribe,
    () => book,
    () => ({})
  );
}

/** A deterministic two-stop gradient derived from an address, for avatars. */
export function avatarGradient(address: string): string {
  const a = address.toLowerCase();
  let h = 0;
  for (let i = 2; i < a.length; i++) h = (h * 31 + a.charCodeAt(i)) >>> 0;
  const h1 = h % 360;
  const h2 = (h1 + 60 + (h % 120)) % 360;
  return `linear-gradient(135deg, hsl(${h1} 70% 55%), hsl(${h2} 70% 45%))`;
}
