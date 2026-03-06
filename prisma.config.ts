import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Migrations need DIRECT_URL: use Session pooler (pooler:5432), not transaction pooler (6543) or true direct (IPv4/Vercel issues).
    url: process.env.DIRECT_URL ?? env("DATABASE_URL"),
  },
});
