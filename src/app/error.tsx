"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

/** Route-level error boundary — a single component throw no longer white-screens the app. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-debit-500/10 text-debit-500">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">Something went wrong</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          The app hit an unexpected error. Your funds and on-chain data are safe — this is just the
          interface. Try again.
        </p>
        {error?.message && (
          <p className="mt-3 truncate rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-400 dark:bg-slate-950/60">
            {error.message}
          </p>
        )}
        <button
          type="button"
          onClick={reset}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600"
        >
          <RotateCcw className="h-4 w-4" /> Try again
        </button>
      </div>
    </div>
  );
}
