import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Don't let `next dev` write AGENTS.md or ask agents to send feedback reports.
  agentRules: false,
  experimental: {
    agentFeedback: false,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
