"use client";

import { useState } from "react";
import { Pencil, Check } from "lucide-react";
import { getNickname, setNickname, useNicknames, avatarGradient } from "@/lib/nicknames";
import { shortAddress } from "@/lib/format";

interface IdentityProps {
  address: string;
  you?: boolean;
  compact?: boolean;
  /** Show a pencil to rename this address (stored locally). */
  editable?: boolean;
}

/** Avatar + friendly name (nickname → "You" → shortened address). */
export function Identity({ address, you, compact, editable }: IdentityProps) {
  useNicknames(); // re-render when the address book changes
  const nick = getNickname(address);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(nick ?? "");

  const label = you ? "You" : nick || shortAddress(address);
  const size = compact ? "h-5 w-5" : "h-6 w-6";

  const save = () => {
    setNickname(address, draft);
    setEditing(false);
  };

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span
          className={`${size} shrink-0 rounded-full ring-1 ring-black/5 dark:ring-white/10`}
          style={{ background: avatarGradient(address) }}
          aria-hidden
        />
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
          placeholder={shortAddress(address)}
          className="w-24 rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-sm outline-none dark:border-slate-600 dark:bg-slate-950"
        />
        <button type="button" onClick={save} className="text-brand-500" aria-label="Save name">
          <Check className="h-3.5 w-3.5" />
        </button>
      </span>
    );
  }

  return (
    <span className="group inline-flex items-center gap-2">
      <span
        className={`${size} shrink-0 rounded-full ring-1 ring-black/5 dark:ring-white/10`}
        style={{ background: avatarGradient(address) }}
        aria-hidden
      />
      <span
        className={
          you
            ? "font-mono text-sm font-semibold text-brand-500"
            : "font-mono text-sm text-slate-600 dark:text-slate-300"
        }
      >
        {label}
      </span>
      {editable && !you && (
        <button
          type="button"
          onClick={() => {
            setDraft(nick ?? "");
            setEditing(true);
          }}
          className="text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-brand-500"
          aria-label="Rename"
        >
          <Pencil className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}
