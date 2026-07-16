"use client";

import { useQuery } from "@tanstack/react-query";
import { parseUnits } from "viem";

/**
 * MON/USD pricing via Pyth Network's Hermes (beta) price service.
 *
 * The MON/USD feed is a Pyth *beta* feed, so we read it from the beta Hermes
 * endpoint. This is an OFF-chain read used purely for display + entering
 * expenses in USD — the ledger and settlements stay denominated in MON. If the
 * endpoint is unreachable we fall back to a sane constant so the app never
 * breaks.
 */
const HERMES_BETA = "https://hermes-beta.pyth.network";
const MON_USD_FEED =
  "e786153cc54abd4b0e53b4c246d54d9f8eb3f3b5a34d4fc5a2e9a423b0ba5d6b";

/** Reasonable fallback if Hermes is unreachable (testnet MON is near-zero USD). */
const FALLBACK_USD_PER_MON = 0.02;

async function fetchMonUsd(): Promise<number> {
  const url = `${HERMES_BETA}/v2/updates/price/latest?ids[]=${MON_USD_FEED}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Hermes ${res.status}`);
  const json = await res.json();
  const p = json?.parsed?.[0]?.price;
  if (!p) throw new Error("no price");
  const price = Number(p.price) * Math.pow(10, p.expo);
  if (!Number.isFinite(price) || price <= 0) throw new Error("bad price");
  return price;
}

export interface PriceInfo {
  /** USD value of 1 MON. */
  usdPerMon: number;
  /** Whether this is the live Pyth value (false = fallback constant). */
  isLive: boolean;
  loading: boolean;
  /** Convert a MON wei bigint to a USD number. */
  weiToUsd: (wei: bigint) => number;
  /** Convert a USD amount to MON wei (bigint). */
  usdToWei: (usd: number) => bigint;
}

export function usePrice(): PriceInfo {
  const q = useQuery({
    queryKey: ["mon-usd"],
    queryFn: fetchMonUsd,
    refetchInterval: 30_000,
    staleTime: 20_000,
    retry: 1,
  });

  const usdPerMon = q.data ?? FALLBACK_USD_PER_MON;
  const isLive = q.data !== undefined && !q.isError;

  const weiToUsd = (wei: bigint) => {
    const mon = Number(wei) / 1e18;
    return mon * usdPerMon;
  };

  const usdToWei = (usd: number) => {
    if (!Number.isFinite(usd) || usd <= 0 || usdPerMon <= 0) return 0n;
    // MON = USD / (USD per MON); keep 18-decimal precision.
    const mon = usd / usdPerMon;
    return parseUnits(mon.toFixed(18) as `${number}`, 18);
  };

  return { usdPerMon, isLive, loading: q.isLoading, weiToUsd, usdToWei };
}

/** Format a USD number like "$8.10". */
export function formatUsd(usd: number): string {
  if (!Number.isFinite(usd)) return "$0.00";
  return `$${usd.toFixed(2)}`;
}
