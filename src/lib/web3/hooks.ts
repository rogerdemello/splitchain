"use client";

import { useCallback } from "react";
import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
} from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { decodeEventLog, type Abi, type Hash } from "viem";
import { splitChainAbi, SPLITCHAIN_ADDRESS } from "@/lib/contract";
import { monadTestnet } from "@/lib/web3/chains";
import { logActivity } from "@/lib/activity";

const abi = splitChainAbi as unknown as Abi;

// Pin every call to Monad so reads resolve via the Monad transport even when the
// wallet's active network is something else, and writes prompt a network switch.
const base = {
  address: SPLITCHAIN_ADDRESS,
  abi,
  chainId: monadTestnet.id,
} as const;

export interface GroupBalances {
  members: readonly `0x${string}`[];
  balances: readonly bigint[];
}

/** Live read of a group's members + net balances (refetched from chain). */
export function useGroupBalances(groupId: bigint | undefined) {
  return useReadContract({
    ...base,
    functionName: "getBalances",
    args: groupId === undefined ? undefined : [groupId],
    query: { enabled: groupId !== undefined, refetchInterval: 8000 },
  });
}

/** Group metadata (name, members, expense count). */
export function useGroupInfo(groupId: bigint | undefined) {
  return useReadContract({
    ...base,
    functionName: "getGroup",
    args: groupId === undefined ? undefined : [groupId],
    query: { enabled: groupId !== undefined },
  });
}

/** Full expense log for a group. */
export function useGroupExpenses(groupId: bigint | undefined) {
  return useReadContract({
    ...base,
    functionName: "getExpenses",
    args: groupId === undefined ? undefined : [groupId],
    query: { enabled: groupId !== undefined, refetchInterval: 8000 },
  });
}

/** Shared write-tx lifecycle wrapper. */
function useWrite() {
  const { mutateAsync: writeContractAsync, data: hash, isPending, error, reset } =
    useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });
  return {
    writeContractAsync,
    hash: hash as Hash | undefined,
    isPending, // awaiting wallet signature
    isConfirming: receipt.isLoading,
    isConfirmed: receipt.isSuccess,
    receipt: receipt.data,
    error: error ?? receipt.error,
    reset,
  };
}

export function useCreateGroup() {
  const w = useWrite();
  const createGroup = useCallback(
    async (name: string, members: `0x${string}`[]) => {
      const hash = await w.writeContractAsync({
        ...base,
        functionName: "createGroup",
        args: [name, members],
      });
      return hash;
    },
    [w]
  );
  return { ...w, createGroup };
}

export function useAddExpense() {
  const w = useWrite();
  const addExpense = useCallback(
    async (
      groupId: bigint,
      amount: bigint,
      participants: `0x${string}`[],
      shares: bigint[],
      description: string,
      usdCents = 0n
    ) => {
      return w.writeContractAsync({
        ...base,
        functionName: "addExpense",
        args: [groupId, amount, participants, shares, description, usdCents],
      });
    },
    [w]
  );
  return { ...w, addExpense };
}

export function useSettle() {
  const w = useWrite();
  const settle = useCallback(
    async (groupId: bigint, to: `0x${string}`, value: bigint) => {
      return w.writeContractAsync({
        ...base,
        functionName: "settle",
        args: [groupId, to],
        value,
      });
    },
    [w]
  );
  return { ...w, settle };
}

/** Batch settle: clear multiple debts in a single onchain transaction. */
export function useSettleMany() {
  const w = useWrite();
  const settleMany = useCallback(
    async (groupId: bigint, tos: `0x${string}`[], amounts: bigint[]) => {
      const value = amounts.reduce((a, b) => a + b, 0n);
      return w.writeContractAsync({
        ...base,
        functionName: "settleMany",
        args: [groupId, tos, amounts],
        value,
      });
    },
    [w]
  );
  return { ...w, settleMany };
}

/** Self-join a group via a shared invite link. */
export function useJoinGroup() {
  const w = useWrite();
  const joinGroup = useCallback(
    async (groupId: bigint) => {
      return w.writeContractAsync({
        ...base,
        functionName: "joinGroup",
        args: [groupId],
      });
    },
    [w]
  );
  return { ...w, joinGroup };
}

/**
 * Cross-device activity sync. Monad's RPC caps `eth_getLogs` to a 100-block
 * range, so we poll just the most recent ~100 blocks every 8s and merge any
 * events into the shared activity store via {logActivity}. The ids match the
 * receipt-sourced logger exactly, so local and on-chain entries de-duplicate.
 * This surfaces recent actions taken by OTHER members/devices. Best-effort —
 * errors (e.g. transient RPC) are swallowed.
 */
export function useSyncOnchainActivity(groupId: bigint | undefined) {
  const client = usePublicClient({ chainId: monadTestnet.id });
  useQuery({
    queryKey: ["activity-sync", groupId?.toString()],
    enabled: groupId !== undefined && !!client,
    refetchInterval: 8000,
    queryFn: async () => {
      if (!client || groupId === undefined) return 0;
      try {
        const latest = await client.getBlockNumber();
        const fromBlock = latest > 99n ? latest - 99n : 0n;
        const common = {
          address: SPLITCHAIN_ADDRESS,
          abi,
          args: { groupId },
          fromBlock,
          toBlock: latest,
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const [settles, expenses, joins] = await Promise.all([
          client.getContractEvents({ ...common, eventName: "DebtSettled" } as any),
          client.getContractEvents({ ...common, eventName: "ExpenseAdded" } as any),
          client.getContractEvents({ ...common, eventName: "MemberJoined" } as any),
        ]);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const l of settles as any[]) {
          const a = l.args ?? {};
          logActivity(groupId, {
            id: `${l.transactionHash}-settle-${a.to}`,
            kind: "settle",
            txHash: l.transactionHash,
            ts: Date.now(),
            from: a.from,
            to: a.to,
            amount: a.amount?.toString(),
          });
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const l of expenses as any[]) {
          const a = l.args ?? {};
          logActivity(groupId, {
            id: `${l.transactionHash}-expense`,
            kind: "expense",
            txHash: l.transactionHash,
            ts: Date.now(),
            payer: a.payer,
            amount: a.amount?.toString(),
            description: a.description,
          });
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const l of joins as any[]) {
          const a = l.args ?? {};
          logActivity(groupId, {
            id: `${l.transactionHash}-join`,
            kind: "join",
            txHash: l.transactionHash,
            ts: Date.now(),
            member: a.member,
          });
        }
      } catch {
        /* transient RPC / range issues — ignore */
      }
      return Date.now();
    },
  });
}

/** Decode the groupId from a createGroup receipt's GroupCreated event. */
export function groupIdFromLogs(
  logs: readonly { data: `0x${string}`; topics: `0x${string}`[] }[]
): bigint | undefined {
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({
        abi,
        data: log.data,
        topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
      });
      if (decoded.eventName === "GroupCreated") {
        return (decoded.args as unknown as { groupId: bigint }).groupId;
      }
    } catch {
      // not our event; skip
    }
  }
  return undefined;
}
