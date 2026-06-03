import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["dexie"],
  images: { unoptimized: true },
};

export default nextConfig;
