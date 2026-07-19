import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "SplitChain — settle group expenses onchain on Monad";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: "linear-gradient(135deg, #1e1b4b 0%, #0f172a 55%, #201a4d 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <div
            style={{
              width: "96px",
              height: "96px",
              borderRadius: "24px",
              background: "#836ef9",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "56px",
              fontWeight: 800,
            }}
          >
            S
          </div>
          <div style={{ fontSize: "44px", fontWeight: 700, letterSpacing: "-1px" }}>SplitChain</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ fontSize: "76px", fontWeight: 800, lineHeight: 1.05, letterSpacing: "-2px" }}>
            Who owes whom,
          </div>
          <div
            style={{
              fontSize: "76px",
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: "-2px",
              color: "#a78bfa",
            }}
          >
            settled onchain.
          </div>
          <div style={{ fontSize: "34px", color: "#cbd5e1", marginTop: "12px", maxWidth: "900px" }}>
            Snap a receipt, split it with friends, clear every debt in one tap — with real MON.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: "30px", color: "#94a3b8" }}>
          <span style={{ color: "#836ef9", fontWeight: 700 }}>Monad Testnet</span>
          <span>·</span>
          <span>AI receipts</span>
          <span>·</span>
          <span>One-tap settle-all</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
