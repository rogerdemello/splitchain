"use client";

import { useCallback } from "react";
import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { decodeEventLog, type Abi, type Hash } from "viem";
import { splitChainAbi, SPLITCHAIN_ADDRESS } from "@/lib/contract";

const abi = splitChainAbi as unknown as Abi;

const base = {
  address: SPLITCHAIN_ADDRESS,
  abi,
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
