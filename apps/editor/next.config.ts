import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["db", "@nextomic/schema", "@nextomic/storage"]
};

export default nextConfig;
