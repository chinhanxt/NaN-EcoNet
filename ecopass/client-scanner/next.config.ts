import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // TypeScript 7 ships no JS Compiler API; run the local tsc CLI for build-time type checking
  experimental: {
    useTypeScriptCli: true,
  },
  output: "standalone",
  productionBrowserSourceMaps: true,
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        destination: "/privacy-policy",
        source: "/datenschutz",
      },
    ];
  },
  allowedDevOrigins: [
    "automatically-later-belt-lightbox.trycloudflare.com",
    "*.trycloudflare.com",
    "192.168.1.119:3011",
    "192.168.1.119",
    "192.168.200.161:3011",
    "192.168.200.161",
    "localhost:3011",
  ],
  devIndicators: false,
  turbopack: {
    root: import.meta.dirname,
  },
};

export default withNextIntl(nextConfig);
