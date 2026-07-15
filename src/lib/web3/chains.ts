import { defineChain } from "viem";

/**
 * Monad Testnet.
 * Chain id / RPC / currency are the confirmed public testnet params; the
 * explorer base URL can be overridden via env if it differs.
 */
const RPC_URL =
  process.env.NEXT_PUBLIC_MONAD_RPC_URL || "https://testnet-rpc.monad.xyz";
const EXPLORER_URL =
  process.env.NEXT_PUBLIC_MONAD_EXPLORER_URL || "https://testnet.monadscan.com";

export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: [RPC_URL] },
  },
  blockExplorers: {
    default: { name: "Monad Explorer", url: EXPLORER_URL },
  },
  testnet: true,
});

/** Build an explorer link for a tx hash or address. */
export function explorerTx(hash: string): string {
  return `${EXPLORER_URL}/tx/${hash}`;
}
export function explorerAddress(address: string): string {
  return `${EXPLORER_URL}/address/${address}`;
}
