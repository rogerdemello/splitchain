"use client";

/** Catches errors in the root layout itself (must render its own <html>/<body>). */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          margin: 0,
          background: "#0f172a",
          color: "#e2e8f0",
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700 }}>Something went wrong</h1>
          <p style={{ color: "#94a3b8", marginTop: "0.5rem" }}>
            The app failed to load. Please try again.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.25rem",
              background: "#836ef9",
              color: "white",
              border: "none",
              borderRadius: "0.75rem",
              padding: "0.6rem 1rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
