import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Use DIRECT_URL for migrations (port 5432) - faster and more reliable than pooler (6543)
    url: process.env.DIRECT_URL ?? env("DATABASE_URL"),
  },
});
