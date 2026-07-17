/**
 * POST /api/receipt/scan — turn a photo of a receipt into structured line items.
 *
 * Uses NVIDIA NIM's vision model (llama-3.2-90b-vision-instruct, OpenAI-compatible)
 * to read the image and return `{ items: [{name, amountUsd}], total, currency }`.
 *
 * This is a convenience layer only: the amounts it returns are reviewed and
 * edited by the user before anything is written on-chain, so a wrong read can
 * never silently create a bad expense. If no API key is configured or the model
 * call fails, the endpoint responds with `{ ok: false }` and the UI falls back
 * to manual entry — it never fabricates data.
 */

import type { Express, Request, Response } from "express";

const NIM_URL =
  process.env.NVIDIA_BASE_URL?.replace(/\/$/, "") ||
  "https://integrate.api.nvidia.com/v1";
const NIM_MODEL = process.env.RECEIPT_MODEL || "meta/llama-3.2-11b-vision-instruct";

// NIM inlines images as base64 in the message; keep under its ~180KB limit.
const MAX_B64 = 180_000;

// Simple in-memory per-IP rate limit so the shared NVIDIA key can't be drained.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;
const hits = new Map<string, number[]>();
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  // Opportunistic cleanup so the map doesn't grow unbounded.
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (v.every((t) => now - t >= RATE_WINDOW_MS)) hits.delete(k);
  }
  return recent.length > RATE_MAX;
}

interface ScanItem {
  name: string;
  amountUsd: number;
}
interface ScanResult {
  items: ScanItem[];
  total: number;
  currency: string;
}

const PROMPT = `You are a receipt parser. Read this receipt image and extract the line items.
Return ONLY strict minified JSON (no markdown, no prose) of the exact shape:
{"items":[{"name":"string","amountUsd":number}],"total":number,"currency":"string"}
Rules:
- "name" is the item/dish name, short.
- "amountUsd" is the numeric price of that line as a number (no currency symbol).
- Exclude tax/tip/subtotal lines from "items"; instead fold tax and tip proportionally is NOT required — just list the food/drink line items you can read.
- "total" is the grand total shown on the receipt as a number.
- "currency" is the ISO-ish code or symbol you see (e.g. "USD","INR","EUR"); default "USD".
If you cannot read it, return {"items":[],"total":0,"currency":"USD"}.`;

function extractJson(text: string): ScanResult | null {
  if (!text) return null;
  // Strip ```json fences if present, then grab the first {...} block.
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1));
    const items: ScanItem[] = Array.isArray(obj.items)
      ? obj.items
          .map((it: unknown) => {
            const rec = it as Record<string, unknown>;
            return {
              name: String(rec?.name ?? "Item").slice(0, 60),
              amountUsd: Number(rec?.amountUsd ?? 0),
            };
          })
          .filter((it: ScanItem) => Number.isFinite(it.amountUsd) && it.amountUsd > 0)
      : [];
    return {
      items,
      total: Number(obj.total) || items.reduce((a, b) => a + b.amountUsd, 0),
      currency: String(obj.currency || "USD").slice(0, 8),
    };
  } catch {
    return null;
  }
}

export function registerReceiptRoute(app: Express): void {
  app.post("/api/receipt/scan", async (req: Request, res: Response) => {
    const fwd = req.headers["x-forwarded-for"];
    const ip = (
      (Array.isArray(fwd) ? fwd[0] : fwd?.split(",")[0]) ||
      req.socket.remoteAddress ||
      "unknown"
    ).trim();
    if (isRateLimited(ip)) {
      return res.status(429).json({ ok: false, reason: "rate-limited" });
    }

    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) {
      return res.status(200).json({ ok: false, reason: "no-key" });
    }

    const { image, mimeType } = (req.body ?? {}) as {
      image?: string;
      mimeType?: string;
    };
    const b64 = (image ?? "").replace(/^data:[^,]+,/, "").trim();
    if (!b64) return res.status(400).json({ ok: false, reason: "no-image" });
    if (b64.length > MAX_B64) {
      return res.status(413).json({ ok: false, reason: "too-large" });
    }

    const mime = mimeType && /^image\//.test(mimeType) ? mimeType : "image/jpeg";

    try {
      const resp = await fetch(`${NIM_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          model: NIM_MODEL,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: PROMPT },
                {
                  type: "image_url",
                  image_url: { url: `data:${mime};base64,${b64}` },
                },
              ],
            },
          ],
          max_tokens: 1024,
          temperature: 0.1,
          top_p: 0.7,
          stream: false,
        }),
      });

      if (!resp.ok) {
        const detail = await resp.text().catch(() => "");
        return res
          .status(200)
          .json({ ok: false, reason: "model-error", status: resp.status, detail: detail.slice(0, 300) });
      }

      const data = await resp.json();
      const text: string = data?.choices?.[0]?.message?.content ?? "";
      const parsed = extractJson(text);
      if (!parsed || parsed.items.length === 0) {
        return res.status(200).json({ ok: false, reason: "unreadable", raw: text.slice(0, 300) });
      }
      return res.status(200).json({ ok: true, ...parsed });
    } catch (err) {
      return res.status(200).json({
        ok: false,
        reason: "exception",
        detail: err instanceof Error ? err.message : "unknown",
      });
    }
  });
}
