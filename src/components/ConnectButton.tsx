"use client";

import {
  useAccount,
  useConnect,
  useDisconnect,
  useChainId,
  useSwitchChain,
  useBalance,
} from "wagmi";
import { Wallet, LogOut, AlertTriangle } from "lucide-react";
import { monadTestnet } from "@/lib/web3/chains";
import { formatMon, shortAddress } from "@/lib/format";

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { data: bal } = useBalance({
    address,
    chainId: monadTestnet.id,
    query: { enabled: isConnected, refetchInterval: 10000 },
  });

  const wrongNetwork = isConnected && chainId !== monadTestnet.id;

  if (!isConnected) {
    const injected = connectors[0];
    return (
      <button
        type="button"
        onClick={() => injected && connect({ connector: injected })}
        disabled={isPending || !injected}
        className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-60"
      >
        <Wallet className="h-4 w-4" />
        {isPending ? "Connecting…" : "Connect wallet"}
      </button>
    );
  }

  if (wrongNetwork) {
    return (
      <button
        type="button"
        onClick={() => switchChain({ chainId: monadTestnet.id })}
        className="inline-flex items-center gap-2 rounded-xl bg-debit-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-debit-600"
      >
        <AlertTriangle className="h-4 w-4" /> Switch to Monad Testnet
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="hidden rounded-xl border border-slate-200 bg-white px-3 py-2 text-right text-xs dark:border-slate-800 dark:bg-slate-900 sm:block">
        <div className="font-mono text-sm font-semibold text-slate-900 dark:text-white">
          {bal ? `${formatMon(bal.value)} MON` : "…"}
        </div>
        <div className="font-mono text-slate-500 dark:text-slate-400">
          {shortAddress(address)}
        </div>
      </div>
      <button
        type="button"
        onClick={() => disconnect()}
        title="Disconnect"
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}
