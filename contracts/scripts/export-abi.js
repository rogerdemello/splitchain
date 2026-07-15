// Exports the compiled SplitChain ABI into the web app at src/lib/contract/abi.json
const fs = require("fs");
const path = require("path");

const artifact = path.join(
  __dirname,
  "..",
  "artifacts",
  "contracts",
  "SplitChain.sol",
  "SplitChain.json"
);

if (!fs.existsSync(artifact)) {
  console.error("Artifact not found — run `npm run compile` first.");
  process.exit(1);
}

const { abi } = JSON.parse(fs.readFileSync(artifact, "utf8"));
const outDir = path.join(__dirname, "..", "..", "src", "lib", "contract");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, "abi.json");
fs.writeFileSync(outFile, JSON.stringify(abi, null, 2));
console.log("Wrote ABI ->", outFile, `(${abi.length} entries)`);
