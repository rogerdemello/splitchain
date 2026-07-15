// Post-deploy smoke test against the LIVE Monad testnet contract.
// Creates a group, logs an expense, and prints the on-chain balances — proving
// the deployed contract works. (A full settle() moves value between two funded
// accounts; demo that in the browser with two wallets, or fund SECOND_PK below.)
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const net = hre.network.name;
  const deployment = path.join(__dirname, "..", "deployments", `${net}.json`);
  if (!fs.existsSync(deployment)) {
    throw new Error(`No deployments/${net}.json — run the deploy script first.`);
  }
  const { address } = JSON.parse(fs.readFileSync(deployment, "utf8"));
  const [signer] = await hre.ethers.getSigners();
  const split = await hre.ethers.getContractAt("SplitChain", address, signer);

  console.log("Contract:", address);
  console.log("Signer  :", signer.address);

  // A second demo member (does not need to be funded just to appear in balances).
  const other = process.env.SECOND_ADDR || hre.ethers.Wallet.createRandom().address;

  const tx1 = await split.createGroup("Smoke Test Trip", [other]);
  const rcpt1 = await tx1.wait();
  const ev = rcpt1.logs
    .map((l) => {
      try {
        return split.interface.parseLog(l);
      } catch {
        return null;
      }
    })
    .find((e) => e && e.name === "GroupCreated");
  const groupId = ev.args.groupId;
  console.log("Created group #", groupId.toString());

  // Signer pays 0.02 MON split equally with `other` → other owes 0.01.
  const amount = hre.ethers.parseEther("0.02");
  const half = amount / 2n;
  const tx2 = await split.addExpense(
    groupId,
    amount,
    [signer.address, other],
    [half, half],
    "Hotel"
  );
  await tx2.wait();
  console.log("Added expense 0.02 MON");

  const [members, balances] = await split.getBalances(groupId);
  console.log("\nOn-chain balances:");
  members.forEach((m, i) =>
    console.log(`  ${m}  ${hre.ethers.formatEther(balances[i])} MON`)
  );
  console.log("\n✅ Live contract verified on", net);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
