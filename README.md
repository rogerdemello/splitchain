# SplitChain — settle group expenses onchain

**Snap a receipt, split it with friends, and clear every debt in one tap with real
MON on Monad.** No spreadsheets, no "I'll Venmo you later," no chasing people for
weeks. The debts live onchain; clearing them all is a single transaction.

> Built for the **Spark** hackathon (BuildAnything × Monad). Runs on **Monad Testnet**.

- **Live app:** **https://splitchain.onrender.com**
- **Contract (Monad testnet):** [`0x2e6a327bbEe6713C3176646Dc9670d99F4321Aa0`](https://testnet.monadscan.com/address/0x2e6a327bbEe6713C3176646Dc9670d99F4321Aa0)
- **Demo video:** _<add your ≤3-min video URL>_

### What makes it special

- **📸 AI receipt scanner** — photograph the bill; a vision model reads the line
  items, you tap who had what, and the split is recorded onchain. No manual math.
- **⚡ One-click settle-all** — owe three people? Clear every debt in a **single**
  transaction (`settleMany`), showcasing Monad's cheap, fast execution.
- **💵 Think in dollars** — enter "$40", not "18.3 MON". Live MON/USD from a Pyth
  price feed; the ledger and settlement stay in MON.
- **🔗 Invite links** — friends join a group by tapping a link (`joinGroup`), no
  copy-pasting addresses.

---

## The problem (a real, personal one)

Every trip ends the same way: someone paid for the hotel, someone else covered
dinner, a third person got the cab — and then nobody can agree on who owes whom.
The math is annoying, the follow-up is awkward, and money "in the group chat"
takes weeks to actually move.

## The solution

SplitChain puts the whole thing onchain:

1. **Create a group** with your friends' wallet addresses ("Goa Trip").
2. **Log expenses** — who paid, how much, and who it's split between. The
   contract keeps each member's **net balance**.
3. **See who owes whom** — the app simplifies everyone's balances into the
   fewest transfers needed to settle up.
4. **Settle** — one click sends **real MON** from you to the person you owe. The
   balance updates from chain state. That's the whole point: the settlement is a
   genuine onchain value transfer, not a "payment recorded" toast.

---

## Why the onchain part is real (not decorative)

The `settle()` function is `payable`. When you settle, `msg.value` MON is
**actually transferred** to the creditor and both net balances move toward zero.
Everything the UI shows — balances, who-owes-whom, your net position — is **read
live from the contract**, so it can't be faked. Click "Settle" twice and you've
sent MON twice. Every settlement links to the transaction on the Monad explorer.

---

## How it works

```
Browser (MetaMask) ──wagmi/viem──► SplitChain.sol  (Monad testnet, chain 10143)
   Connect → Create group → Add expense → See balances → Settle (payable MON)
   Reads:  getBalances / getGroup / getExpenses   Writes: createGroup / addExpense / settle
```

**Split math is done off-chain, settlement value is done onchain.** The frontend
computes equal (or custom) splits and the minimal set of settlements; the
contract only stores net balances and moves MON. This keeps gas low while the
trust-critical part — the money — is fully onchain. The contract enforces
`sum(shares) == amount` so balances always net to exactly zero.

### Contract — `contracts/contracts/SplitChain.sol`

| Function | What it does |
|---|---|
| `createGroup(name, members[])` | Create a group; caller is auto-added. |
| `joinGroup(groupId)` | Self-join via an invite link (idempotent). |
| `addExpense(groupId, amount, participants[], shares[], description, usdCents)` | Log an expense the caller paid; updates net balances. `usdCents` is display-only. |
| `settle(groupId, to)` **payable** | Pay one creditor real MON; balances move toward zero. |
| `settleMany(groupId, tos[], amounts[])` **payable** | Clear **multiple** debts in one tx; `sum(amounts) == msg.value`. |
| `getBalances(groupId)` | Members + signed net balances (drives the UI). |
| `getExpenses(groupId)` / `getGroup(groupId)` | Expense log / group metadata. |

Guards: members-only writes, `sum(shares) == amount`, checks-effects-interactions
plus a reentrancy lock on both `settle` and `settleMany`. Events (`GroupCreated`,
`MemberJoined`, `ExpenseAdded`, `DebtSettled`) power the activity view. Invariant:
per group, all net balances sum to zero. **14 passing tests** cover splits,
`settleMany`, `joinGroup`, and every guard.

### AI receipt scanner — `server/routes/receipt.ts`

`POST /api/receipt/scan` sends a photo to NVIDIA NIM's vision model
(`llama-3.2-11b-vision-instruct`, OpenAI-compatible) and returns structured line
items. The amounts are always reviewed/edited by the user before anything is
written onchain, and if no `NVIDIA_API_KEY` is set (or the read fails) the UI
falls back to manual entry — it never fabricates data. Set `NVIDIA_API_KEY` in
`.env` to enable it.

---

## Run it locally

**Prerequisites:** Node ≥ 20, and a wallet (MetaMask) with Monad Testnet added
and some faucet MON.

### 1. Deploy the contract (Monad testnet)

```bash
cd contracts
npm install
npm test                       # 10 passing — split math, settle moves MON, guards
cp .env.example .env           # then set PRIVATE_KEY (a funded testnet key)
npm run deploy                 # deploys to Monad testnet, prints the address
npm run export-abi             # refresh src/lib/contract/abi.json (already committed)
```

Fund the deployer first at **https://faucet.monad.xyz**. The deploy prints the
contract address and saves `contracts/deployments/monadTestnet.json`.

### 2. Run the web app

```bash
cd ..
npm install
cp .env.example .env           # set NEXT_PUBLIC_SPLITCHAIN_ADDRESS to the deployed address
npm run dev                    # http://localhost:3000
```

> `NEXT_PUBLIC_*` vars are inlined at **build** time — after changing the
> address, restart `dev` (or rebuild for production).

### 3. Try it

Connect your wallet → create a group with a second address → add an expense →
open the balances panel → **Settle** the amount you owe. Watch the MON move on
the [Monad explorer](https://testnet.monadscan.com).

---

## Tech stack

- **Contract:** Solidity `^0.8.24`, Hardhat (compile / test / deploy), Monad testnet.
- **Frontend:** Next.js 15 (App Router) + React 19 + Tailwind, dark mode.
- **Onchain:** wagmi v3 + viem, injected (MetaMask) connector.
- **Host:** one Node process (small Express host serves the Next build + `/api/health`); Docker + Render blueprint included.

## Project layout

```
contracts/
  contracts/SplitChain.sol     # the contract
  test/SplitChain.test.js      # unit tests (split math, settle, guards)
  scripts/{deploy,interact,export-abi}.js
src/
  app/{page,providers,layout}.tsx   # dashboard + wallet/theme providers
  components/                        # ConnectButton, GroupGate, ExpenseForm,
                                     # Balances, SettleButton, ExpenseHistory, TxStatus
  lib/web3/{chains,wagmi,hooks,simplify}.ts   # chain config, contract hooks, debt netting
  lib/contract/{index.ts,abi.json}            # address + ABI
server/{main,app}.ts           # Express host + Next.js
```

## Honest limitations

- Group/expense reads return arrays — fine for friend-sized groups (the intended
  use); not optimized for thousands of members.
- Amounts are in MON (18 decimals). This is a testnet app for settling among
  people who trust each other; there's no on-chain dispute mechanism by design.
- Debt simplification is computed client-side; each suggested transfer is one
  independent real `settle()` transaction.
