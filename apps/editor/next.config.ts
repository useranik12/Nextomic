import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Font uploads travel through server actions; the default limit is 1 MB.
  experimental: { serverActions: { bodySizeLimit: "30mb" } },
  transpilePackages: ["@nextomic/db", "@nextomic/renderer", "@nextomic/schema", "@nextomic/storage"]
};

export default nextConfig;
