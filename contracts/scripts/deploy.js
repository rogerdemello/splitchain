const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) {
    throw new Error(
      "No deployer account. Set PRIVATE_KEY in contracts/.env and fund it from the Monad faucet."
    );
  }

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Deployer:", deployer.address);
  console.log("Balance :", hre.ethers.formatEther(balance), "MON");
  console.log("Network :", hre.network.name);

  const SplitChain = await hre.ethers.getContractFactory("SplitChain");
  const split = await SplitChain.deploy();
  await split.waitForDeployment();
  const address = await split.getAddress();

  console.log("\n✅ SplitChain deployed at:", address);

  // Persist the address so the frontend can pick it up.
  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, `${hre.network.name}.json`),
    JSON.stringify({ address, network: hre.network.name, chainId: 10143 }, null, 2)
  );
  console.log(`Saved deployments/${hre.network.name}.json`);
  console.log(
    "\nNext: set NEXT_PUBLIC_SPLITCHAIN_ADDRESS=" + address + " in the web app .env"
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
