-- Run this in Supabase SQL Editor AFTER running the migration.sql from 20250303000000_init_postgres
-- This creates the _prisma_migrations table and marks the init migration as applied,
-- so "prisma migrate deploy" during Vercel build will skip it.

-- Create Prisma's migration tracking table (matches Prisma's schema)
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id" VARCHAR(36) PRIMARY KEY,
    "checksum" VARCHAR(64) NOT NULL,
    "finished_at" TIMESTAMPTZ,
    "migration_name" VARCHAR(255) NOT NULL,
    "logs" TEXT,
    "rolled_back_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0
);

-- Mark the init_postgres migration as applied (checksum = SHA256 of migration.sql)
-- Run this only once, after running the migration.sql above.
INSERT INTO "_prisma_migrations" (
    "id",
    "checksum",
    "finished_at",
    "migration_name",
    "logs",
    "rolled_back_at",
    "started_at",
    "applied_steps_count"
) VALUES (
    gen_random_uuid()::text,
    '699c6fe7a6b388447ab6254b3b7984f70e2fc74d00d8f17b90708dc03a77cc65',
    now(),
    '20250303000000_init_postgres',
    NULL,
    NULL,
    now(),
    1
);
