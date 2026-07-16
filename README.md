# SplitChain — settle group expenses onchain

Split rent, trips and dinners with friends, then **settle who owes whom with real
MON on Monad**. No spreadsheets, no "I'll Venmo you later," no chasing people for
weeks. The debts live onchain; clearing one is a single transaction.

> Built for the **Spark** hackathon (BuildAnything × Monad). Runs on **Monad Testnet**.

- **Live app:** _<add your hosted URL>_
- **Contract (Monad testnet):** [`0x84d57b45A20267f9da4904c7c615aAadDd1FD754`](https://testnet.monadscan.com/address/0x84d57b45A20267f9da4904c7c615aAadDd1FD754)
- **Demo video:** _<add your ≤3-min video URL>_

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
| `addExpense(groupId, amount, participants[], shares[], description)` | Log an expense the caller paid; updates net balances. |
| `settle(groupId, to)` **payable** | Pay a creditor real MON; balances move toward zero. |
| `getBalances(groupId)` | Members + signed net balances (drives the UI). |
| `getExpenses(groupId)` / `getGroup(groupId)` | Expense log / group metadata. |

Guards: members-only writes, `sum(shares) == amount`, checks-effects-interactions
plus a reentrancy lock on `settle`. Events (`GroupCreated`, `ExpenseAdded`,
`DebtSettled`) power the activity view. Invariant: per group, all net balances
sum to zero.

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
