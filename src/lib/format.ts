import { formatEther, parseEther } from "viem";

/** Format a wei bigint as a trimmed MON string, e.g. 1.5 -> "1.5". */
export function formatMon(wei: bigint, maxDp = 4): string {
  const s = formatEther(wei < 0n ? -wei : wei);
  const [int, frac = ""] = s.split(".");
  const trimmed = frac.slice(0, maxDp).replace(/0+$/, "");
  const body = trimmed ? `${int}.${trimmed}` : int;
  return wei < 0n ? `-${body}` : body;
}

/** Parse a user MON string (e.g. "1.25") into wei. Throws on invalid input. */
export function monToWei(value: string): bigint {
  const v = value.trim();
  if (!v || !/^\d*\.?\d+$/.test(v)) throw new Error("Invalid amount");
  return parseEther(v as `${number}`);
}

/** 0x1234…abcd */
export function shortAddress(address?: string): string {
  if (!address) return "";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** Case-insensitive address equality. */
export function sameAddress(a?: string, b?: string): boolean {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}

/** Basic 0x…40hex check. */
export function isAddress(a: string): a is `0x${string}` {
  return /^0x[0-9a-fA-F]{40}$/.test(a.trim());
}
