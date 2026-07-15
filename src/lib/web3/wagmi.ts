import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { monadTestnet } from "./chains";

/**
 * wagmi config: a single chain (Monad testnet) and the injected connector
 * (MetaMask / any EIP-1193 wallet). No WalletConnect project id needed, which
 * keeps setup zero-config and the bundle light.
 */
export const wagmiConfig = createConfig({
  chains: [monadTestnet],
  connectors: [injected()],
  transports: {
    [monadTestnet.id]: http(),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
