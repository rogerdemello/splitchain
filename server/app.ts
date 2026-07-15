/**
 * Express application factory. Kept free of `listen()` and of Next.js so it can
 * be imported directly in tests and composed by the custom server.
 *
 * SplitChain is a fully client-side dApp (the browser talks straight to the
 * Monad contract), so the API surface is just a health check for the host.
 */

import express, { type Express } from "express";

export function buildApp(): Express {
  const app = express();

  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", app: "splitchain", chain: "monad-testnet" });
  });

  return app;
}
