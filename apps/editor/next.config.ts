import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@nextomic/db", "@nextomic/schema", "@nextomic/storage"]
};

export default nextConfig;
