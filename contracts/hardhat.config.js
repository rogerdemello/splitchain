require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const MONAD_RPC_URL = process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    monadTestnet: {
      url: MONAD_RPC_URL,
      chainId: 10143,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
  // Monad testnet uses a Sourcify/Blockscout-compatible explorer for verification.
  // Confirm the exact verify endpoint from docs.monad.xyz at deploy time.
  sourcify: {
    enabled: true,
  },
};
