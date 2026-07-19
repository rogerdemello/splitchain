import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SplitChain — settle group expenses onchain",
    short_name: "SplitChain",
    description:
      "Split rent, trips and dinners with friends, then settle who owes whom with real MON on Monad.",
    start_url: "/",
    display: "standalone",
    background_color: "#0f172a",
    theme_color: "#836ef9",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
