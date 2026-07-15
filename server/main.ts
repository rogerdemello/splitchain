/**
 * Custom server: one Node process, one port, one URL.
 *
 *   /api/*  -> Express (health check)
 *   /*      -> Next.js (the SplitChain UI)
 *
 * A single hosted URL keeps deployment simple (Render / Docker). The dApp itself
 * talks directly to the Monad contract from the browser — no app backend needed.
 */

import next from "next";
import { buildApp } from "./app";

const dev = process.env.NODE_ENV !== "production";
const port = Number.parseInt(process.env.PORT || "3000", 10);

async function main() {
  const nextApp = next({ dev });
  const handle = nextApp.getRequestHandler();
  await nextApp.prepare();

  const app = buildApp();

  // Everything that isn't an /api route is handled by Next.js.
  app.use((req, res) => handle(req, res));

  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`\n  SplitChain — settle group expenses onchain`);
    console.log(`  ▸ http://localhost:${port}`);
    console.log(`  ▸ dev: ${dev}\n`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server:", err);
  process.exit(1);
});
