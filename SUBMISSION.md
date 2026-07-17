# SplitChain — Spark Hackathon Submission Sheet

Copy-paste these into the submission form. The only field you still need to fill is the **demo
video URL** (record it with [DEMO.md](./DEMO.md)).

| Field | Value |
|---|---|
| **Project name** | SplitChain |
| **Tagline** | Snap a receipt, split it with friends, and clear every debt in one tap with real MON on Monad. |
| **Live app** | https://splitchain.onrender.com |
| **GitHub repo** | https://github.com/rogerdemello/splitchain |
| **Deployed contract (Monad testnet)** | `0x2e6a327bbEe6713C3176646Dc9670d99F4321Aa0` |
| **Contract explorer** | https://testnet.monadscan.com/address/0x2e6a327bbEe6713C3176646Dc9670d99F4321Aa0 |
| **Demo video** | _paste your ≤3-min video URL here_ |
| **Chain** | Monad Testnet (chain id 10143) |

## What it is (short description)

SplitChain is an on-chain group expense splitter. Friends form a group, log shared expenses
(including by **snapping a photo of the receipt** — an AI reads the line items), and the app tracks
each person's net balance. When it's time to pay up, you **settle real MON on Monad** — and you can
clear **all** your debts in a single transaction. Balances are read live from the contract, so
nothing is faked.

## The real, personal problem

Every trip or shared flat ends the same way: someone paid for dinner, someone got the cab, and
nobody agrees on who owes whom. The math is annoying, the chasing is awkward, and money "in the
group chat" takes weeks to move. SplitChain makes settling up a single tap.

## The genuinely on-chain feature

`settle` / `settleMany` are `payable` — settling **actually transfers MON** to the creditor(s) and
moves both net balances toward zero, under checks-effects-interactions + a reentrancy guard. Every
balance the UI shows is read live from the contract. Click settle twice and MON moves twice. Each
settlement links to its real transaction on the Monad explorer.

## Why Monad

Cheap, fast execution makes micro-settlements between friends practical, and **one-click
settle-all** (`settleMany`) clears several debts in a single transaction — exactly the kind of
batched, high-frequency value transfer Monad is built for.

## Feature highlights

- 📸 AI receipt scanner (NVIDIA NIM vision) — works with any-currency receipts
- ⚡ One-click settle-all — clear every debt in one transaction
- 💵 Think in dollars — live MON/USD via a Pyth price feed
- 🔗 Invite links + QR codes — friends join by scanning
- 📊 Live on-chain activity feed with explorer links
- 💳 Partial settlements, 🔁 recurring expense templates, 📤 CSV export
- 🧾 Payment reminders, 👤 local nicknames + avatars, 📈 spending insights

## Tech stack

Solidity `^0.8.24` (Hardhat, 14 passing tests) · Next.js 15 + React 19 + Tailwind · wagmi v3 + viem ·
Pyth (Hermes) price feed · NVIDIA NIM vision · single Node/Express host (Docker + Render).

## Deliverables checklist

- [x] Hosted web app URL
- [x] Public GitHub repo
- [x] Deployed contract address on Monad
- [x] README with setup/docs
- [ ] ≤3-min demo video ← **record this (see DEMO.md), then add the URL above**
- [x] (Optional) social post draft — in DEMO.md
