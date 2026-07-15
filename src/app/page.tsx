"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { Link2, ArrowLeft, ExternalLink, Copy, Check, AlertTriangle } from "lucide-react";
import { ConnectButton } from "@/components/ConnectButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { GroupGate } from "@/components/GroupGate";
import { ExpenseForm } from "@/components/ExpenseForm";
import { Balances } from "@/components/Balances";
import { ExpenseHistory } from "@/components/ExpenseHistory";
import {
  useGroupBalances,
  useGroupInfo,
  useGroupExpenses,
} from "@/lib/web3/hooks";
import { SPLITCHAIN_ADDRESS, isContractConfigured } from "@/lib/contract";
import { explorerAddress } from "@/lib/web3/chains";
import { formatMon, shortAddress, sameAddress } from "@/lib/format";

export default function Home() {
  const { address, isConnected } = useAccount();
  const [groupId, setGroupId] = useState<bigint | null>(null);
  const [copied, setCopied] = useState(false);

  // Restore last group per browser.
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("splitchain:group") : null;
    if (saved !== null && saved !== "") {
      try {
        setGroupId(BigInt(saved));
      } catch {
        /* ignore */
      }
    }
  }, []);

  const selectGroup = useCallback((id: bigint) => {
    setGroupId(id);
    localStorage.setItem("splitchain:group", id.toString());
  }, []);

  const leaveGroup = useCallback(() => {
    setGroupId(null);
    localStorage.removeItem("splitchain:group");
  }, []);

  const balancesQ = useGroupBalances(groupId ?? undefined);
  const infoQ = useGroupInfo(groupId ?? undefined);
  const expensesQ = useGroupExpenses(groupId ?? undefined);

  const refetchAll = useCallback(() => {
    balancesQ.refetch();
    infoQ.refetch();
    expensesQ.refetch();
  }, [balancesQ, infoQ, expensesQ]);

  const bData = balancesQ.data as
    | readonly [readonly `0x${string}`[], readonly bigint[]]
    | undefined;
  const iData = infoQ.data as
    | readonly [string, readonly `0x${string}`[], bigint]
    | undefined;
  const members = bData?.[0] ?? [];
  const balances = bData?.[1] ?? [];
  const groupName = iData?.[0] ?? "";
  const expenses = (expensesQ.data ?? []) as readonly {
    payer: `0x${string}`;
    amount: bigint;
    participants: readonly `0x${string}`[];
    shares: readonly bigint[];
    description: string;
    timestamp: bigint;
  }[];

  const myNet = useMemo(() => {
    const idx = members.findIndex((m) => sameAddress(m, address));
    return idx >= 0 ? balances[idx] ?? 0n : 0n;
  }, [members, balances, address]);

  const groupNotFound =
    groupId !== null && !balancesQ.isLoading && balancesQ.isError;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <button type="button" onClick={leaveGroup} className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-white shadow-sm">
              <Link2 className="h-5 w-5" />
            </div>
            <div className="text-left">
              <h1 className="text-base font-bold leading-tight text-slate-900 dark:text-white">
                SplitChain
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Settle up onchain · Monad
              </p>
            </div>
          </button>
          <div className="flex items-center gap-2">
            <ConnectButton />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {!isContractConfigured && (
          <Banner>
            Contract address not set. Deploy <code>SplitChain.sol</code> to Monad testnet
            and set <code>NEXT_PUBLIC_SPLITCHAIN_ADDRESS</code> in <code>.env</code>.
          </Banner>
        )}

        {/* Not connected — hero */}
        {!isConnected ? (
          <section className="mx-auto max-w-xl animate-fade-in py-10 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Who owes whom, <span className="text-brand-500">settled onchain.</span>
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-slate-500 dark:text-slate-400">
              Split rent, trips and dinners with friends. SplitChain tracks the balances and
              lets you clear your debts with real MON — no more awkward reminders.
            </p>
            <div className="mt-6 flex justify-center">
              <ConnectButton />
            </div>
          </section>
        ) : groupId === null ? (
          <section className="animate-fade-in">
            <h2 className="mb-1 text-center text-xl font-bold text-slate-900 dark:text-white">
              Your groups
            </h2>
            <p className="mb-6 text-center text-sm text-slate-500 dark:text-slate-400">
              Create a group for your trip or flat, or open one you&apos;re already in.
            </p>
            <GroupGate onGroupReady={selectGroup} />
          </section>
        ) : groupNotFound ? (
          <section className="mx-auto max-w-md animate-fade-in py-10 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-debit-500" />
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              Group #{groupId.toString()} not found on this network.
            </p>
            <button
              type="button"
              onClick={leaveGroup}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
          </section>
        ) : (
          <section className="animate-fade-in space-y-5">
            {/* Group header + your net position */}
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-gradient-to-br from-brand-500/10 to-transparent p-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <button
                  type="button"
                  onClick={leaveGroup}
                  className="mb-1 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-brand-500"
                >
                  <ArrowLeft className="h-3 w-3" /> All groups
                </button>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {groupName || `Group #${groupId.toString()}`}
                </h2>
                <p className="font-mono text-xs text-slate-400">
                  #{groupId.toString()} · {members.length} member{members.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Your position</p>
                <p
                  className={`font-mono text-2xl font-bold ${
                    myNet > 0n ? "text-credit-500" : myNet < 0n ? "text-debit-500" : "text-slate-400"
                  }`}
                >
                  {myNet > 0n ? `+${formatMon(myNet)}` : formatMon(myNet)} MON
                </p>
                <p className="text-xs text-slate-400">
                  {myNet > 0n ? "you're owed" : myNet < 0n ? "you owe" : "all settled"}
                </p>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-5">
                <ExpenseForm groupId={groupId} members={members} onAdded={refetchAll} />
                <ExpenseHistory expenses={expenses} />
              </div>
              <Balances
                groupId={groupId}
                members={members}
                balances={balances}
                onSettled={refetchAll}
              />
            </div>
          </section>
        )}
      </main>

      <footer className="mx-auto max-w-5xl px-4 py-8 text-center text-xs text-slate-400 sm:px-6">
        {isContractConfigured ? (
          <span className="inline-flex items-center gap-2">
            <span>Contract</span>
            <a
              href={explorerAddress(SPLITCHAIN_ADDRESS)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-mono underline decoration-dotted hover:text-brand-500"
            >
              {shortAddress(SPLITCHAIN_ADDRESS)} <ExternalLink className="h-3 w-3" />
            </a>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(SPLITCHAIN_ADDRESS);
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              }}
              className="hover:text-brand-500"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </button>
            <span>· Monad Testnet</span>
          </span>
        ) : (
          <span>SplitChain · Monad Testnet</span>
        )}
      </footer>
    </div>
  );
}

function Banner({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
