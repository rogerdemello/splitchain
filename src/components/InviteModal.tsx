"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { X, Copy, Check } from "lucide-react";

interface InviteModalProps {
  groupId: bigint;
  onClose: () => void;
}

/** Shareable invite: the ?join=<id> link plus a scannable QR to join on mobile. */
export function InviteModal({ groupId, onClose }: InviteModalProps) {
  const [qr, setQr] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/?join=${groupId.toString()}`
      : "";

  useEffect(() => {
    if (!url) return;
    QRCode.toDataURL(url, { width: 240, margin: 1, errorCorrectionLevel: "M" })
      .then(setQr)
      .catch(() => setQr(""));
  }, [url]);

  const copy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Invite to group #{groupId.toString()}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          Friends scan this or open the link, connect their wallet, and tap <b>Join</b>.
        </p>

        <div className="flex justify-center">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qr}
              alt="Invite QR code"
              className="h-52 w-52 rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-700"
            />
          ) : (
            <div className="h-52 w-52 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
          )}
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-500 dark:text-slate-400">
            {url}
          </span>
          <button
            type="button"
            onClick={copy}
            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-brand-500 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-600"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}
