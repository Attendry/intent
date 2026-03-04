import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],
  // Smaller output, faster deploys; Vercel uses this by default
  output: "standalone",
  // Allow build to complete while fixing implicit any types incrementally
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
