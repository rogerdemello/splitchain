import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // SplitChain brand — Monad-adjacent electric violet (primary + CTA)
        brand: {
          50: "#f2f0ff",
          100: "#e8e3ff",
          200: "#d3c9ff",
          300: "#b6a5ff",
          400: "#9a82fb",
          500: "#836ef9",
          600: "#6d54ef",
          700: "#5b41d6",
          800: "#4a36ac",
          900: "#3e2f88",
        },
        // "You're owed" — teal
        credit: {
          50: "#effcf6",
          100: "#c7f7e2",
          400: "#2dd4a7",
          500: "#14b88a",
          600: "#0d9770",
        },
        // "You owe" — coral
        debit: {
          50: "#fff1f0",
          100: "#ffdcd8",
          400: "#fb7185",
          500: "#f43f5e",
          600: "#e11d48",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: {
        "fade-in": "fade-in 0.25s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
