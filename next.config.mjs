/** @type {import('next').NextConfig} */
const nextConfig = {
  // We run our own Express server (server/main.ts), so lint/build tooling stays lean.
  eslint: { ignoreDuringBuilds: true },
  reactStrictMode: true,
  webpack: (config, { webpack }) => {
    // wagmi's connector barrel eagerly references optional integrations
    // (porto, tempo) whose peer deps we don't install — we only use `injected`.
    // Ignore those optional modules so the bundle builds.
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^(porto|porto\/internal|accounts)$/,
      })
    );
    config.externals = config.externals || [];
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
};

export default nextConfig;
