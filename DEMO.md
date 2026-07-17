# SplitChain — Demo Kit

Everything you need to record the ≤3-minute demo video and post about it.

- **Live app:** https://splitchain.onrender.com
- **Contract:** `0x2e6a327bbEe6713C3176646Dc9670d99F4321Aa0` (Monad testnet)
- **Repo:** https://github.com/rogerdemello/splitchain

---

## Before you record (5-min setup)

1. **Two wallets.** In MetaMask, create **Account 2** (account menu → *Add account*) and fund
   both accounts at <https://faucet.monad.xyz>. You need two so you can show a debt being settled.
2. **A receipt photo** ready on screen (a real restaurant bill works great — any currency).
3. **Screen recorder.** Windows: `Win+G` (Xbox Game Bar) or [Loom](https://www.loom.com).
   Record the browser window + your mic.
4. Open the live app and **disconnect** any prior session so you start clean.

> Tip: Do every on-chain action **for real** on camera — the MetaMask popups and the explorer
> links are what prove it's genuinely onchain (judges "click Submit twice").

---

## The script (aim for 2:45–3:00)

| Time | On screen | Say |
|---|---|---|
| **0:00–0:18** | Hero page | "Every trip ends the same way — someone paid for dinner, someone got the cab, and nobody remembers who owes whom. SplitChain settles it, onchain, on Monad." |
| **0:18–0:32** | Connect wallet → create/open group "Goa Trip" | "I connect my wallet and open our trip group." |
| **0:32–1:15** | Click **📸 Scan receipt** → upload the bill → items appear → tap to assign → set the total → **Record split onchain** | "Here's the magic: I snap the bill. AI reads every line item — even in rupees. I tap who had what, confirm the total, and record it. No mental math, no spreadsheet." |
| **1:15–1:35** | Balances panel — show MON **and** ~$ + the **Onchain activity** feed updating | "Balances are live from the chain — in MON or dollars — and every action lands in the activity feed with a link to the real transaction." |
| **1:35–1:55** | Group header → **Invite** → show the **QR code** | "Adding a friend is a QR scan — they open it, connect, and tap Join. That's a real `joinGroup` transaction." |
| **1:55–2:35** | Switch to **Account 2** (owes two people) → **⚡ Settle all** → approve once in MetaMask → confirms | "Now the best part. I owe two people. Instead of paying each, I clear **everything in one transaction**. One click, one signature… real MON moves to both." |
| **2:35–2:55** | Click the tx link → Monad explorer showing the transfers → balances now zero | "And there it is on the Monad explorer — the actual transfers. Balances dropped to zero. It's real." |
| **2:55–3:00** | Back to app | "SplitChain — snap, split, settle. Onchain, on Monad." |

### If you're short on time (minimum winning cut)
Connect → **scan receipt** → live balances → **settle-all with real MON** → **explorer link**.
That alone nails the rubric's "one genuinely real onchain feature."

---

## Social post draft (optional bonus — X / Farcaster)

> Splitting the bill after a trip is the worst. So I built **SplitChain** for the @monad Spark
> hackathon 🧾⛓️
>
> 📸 Snap a receipt → AI splits it
> ⚡ Clear ALL your debts in ONE transaction
> 💵 Think in dollars, settle in MON
>
> Real value transfer, live on Monad testnet. Demo 👇
> [link] #Monad #BuildAnything

---

## What to highlight for judges (why it wins)

- **Real personal problem**, real onchain settlement — `settle` / `settleMany` move actual MON.
- **Everything is read live from the contract** — balances can't be faked; a second settle sends MON again.
- **Not AI-slop**: distinct product identity, single-viewport dashboard, real tx + explorer links everywhere.
- The AI receipt scanner does the *tedious* part; the blockchain does the *trust-critical* part.
