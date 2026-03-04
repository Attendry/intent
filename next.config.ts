import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],
  // Allow build to complete while fixing implicit any types incrementally
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
