import abi from "./abi.json";

/** SplitChain ABI (exported from the Hardhat build via `npm run export-abi`). */
export const splitChainAbi = abi;

/**
 * Deployed SplitChain address on Monad testnet.
 * Set NEXT_PUBLIC_SPLITCHAIN_ADDRESS in .env after running the deploy script.
 */
export const SPLITCHAIN_ADDRESS = (process.env.NEXT_PUBLIC_SPLITCHAIN_ADDRESS ||
  "") as `0x${string}`;

export const isContractConfigured = /^0x[0-9a-fA-F]{40}$/.test(
  SPLITCHAIN_ADDRESS
);
