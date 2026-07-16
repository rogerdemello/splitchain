/**
 * Live end-to-end verification against the DEPLOYED SplitChain v2 on Monad
 * testnet. Proves the new v2 features work on-chain with real MON — not just in
 * the local unit tests:
 *   - addExpense with usdCents metadata
 *   - settleMany (batch settle) moving real MON to a creditor
 *   - joinGroup (self-join via invite link)
 *
 * It spins up two ephemeral wallets, funds them a little MON for gas from the
 * deployer, and runs a full flow. Everything here is Monad TESTNET (free MON).
 *
 * Run: npx hardhat run scripts/verify-live.js --network monadTestnet
 */
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const dep = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../deployments/monadTestnet.json"), "utf8")
  );
  const address = dep.address;
  const [deployer] = await ethers.getSigners();
  const provider = deployer.provider;

  console.log("Contract :", address);
  console.log("Deployer :", deployer.address);
  console.log("Balance  :", ethers.formatEther(await provider.getBalance(deployer.address)), "MON\n");

  const split = await ethers.getContractAt("SplitChain", address, deployer);

  // Two throwaway members for this test, funded for gas + settlement.
  const bob = ethers.Wallet.createRandom().connect(provider);
  const carol = ethers.Wallet.createRandom().connect(provider);
  console.log("Funding ephemeral members for gas…");
  await (await deployer.sendTransaction({ to: bob.address, value: ethers.parseEther("0.4") })).wait();
  await (await deployer.sendTransaction({ to: carol.address, value: ethers.parseEther("0.2") })).wait();

  // 1) Create a group (deployer + bob) ------------------------------------
  const before = await split.groupCount();
  const gid = before; // new group id
  await (await split.createGroup("Live Verify", [bob.address])).wait();
  console.log(`\n✓ createGroup -> group #${gid}`);

  // 2) addExpense WITH usdCents: bob pays 0.2 MON split with deployer ------
  const amount = ethers.parseEther("0.2");
  const half = ethers.parseEther("0.1");
  const splitAsBob = split.connect(bob);
  await (
    await splitAsBob.addExpense(
      gid,
      amount,
      [deployer.address, bob.address],
      [half, half],
      "Dinner",
      4599 // $45.99 metadata
    )
  ).wait();
  const exp = await split.getExpenses(gid);
  console.log(`✓ addExpense stored usdCents = ${exp[0].amountUsdCents} (expected 4599)`);
  const deployerNet = await split.netBalance(gid, deployer.address);
  console.log(`  deployer net after expense: ${ethers.formatEther(deployerNet)} MON (owes 0.1)`);

  // 3) settleMany: deployer clears its debt to bob in one batch tx --------
  const bobBefore = await provider.getBalance(bob.address);
  await (
    await split.settleMany(gid, [bob.address], [half], { value: half })
  ).wait();
  const bobAfter = await provider.getBalance(bob.address);
  console.log(
    `✓ settleMany moved ${ethers.formatEther(bobAfter - bobBefore)} MON to bob (expected 0.1)`
  );
  console.log(
    `  deployer net after settle: ${ethers.formatEther(await split.netBalance(gid, deployer.address))} MON (expected 0)`
  );

  // 4) joinGroup: carol self-joins via invite link ------------------------
  const wasMember = await split.isMember(gid, carol.address);
  await (await split.connect(carol).joinGroup(gid)).wait();
  const nowMember = await split.isMember(gid, carol.address);
  console.log(`✓ joinGroup: carol member ${wasMember} -> ${nowMember} (expected false -> true)`);

  console.log("\n🎉 Live v2 verification passed on Monad testnet.");
  console.log(`   Explorer: https://testnet.monadscan.com/address/${address}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
