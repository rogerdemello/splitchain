/**
 * Express application factory. Kept free of `listen()` and of Next.js so it can
 * be imported directly in tests and composed by the custom server.
 *
 * SplitChain is a fully client-side dApp (the browser talks straight to the
 * Monad contract), so the API surface is just a health check for the host.
 */

import express, { type Express } from "express";
import { registerReceiptRoute } from "./routes/receipt";

export function buildApp(): Express {
  const app = express();

  app.use(express.json({ limit: "8mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      app: "splitchain",
      chain: "monad-testnet",
      receiptScan: Boolean(process.env.NVIDIA_API_KEY),
    });
  });

  // AI receipt scanner (optional — degrades to manual entry if no key).
  registerReceiptRoute(app);

  return app;
}
