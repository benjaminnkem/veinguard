import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@repo/ui", "@repo/contracts", "@repo/config"],
};

export default nextConfig;
