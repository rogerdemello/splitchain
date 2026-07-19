import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

const APP_URL = "https://splitchain.onrender.com";
const TITLE = "SplitChain — settle group expenses onchain";
const DESCRIPTION =
  "Snap a receipt, split it with friends, and clear every debt in one tap with real MON on Monad. No more chasing repayments.";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "SplitChain",
  appleWebApp: { capable: true, title: "SplitChain", statusBarStyle: "black-translucent" },
  openGraph: {
    type: "website",
    url: APP_URL,
    siteName: "SplitChain",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#836ef9",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${mono.variable} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
