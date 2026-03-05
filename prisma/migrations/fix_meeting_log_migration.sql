-- Fix P3009: Mark 20250305000000_add_meeting_log as applied
-- Run this in Supabase SQL Editor if "prisma migrate resolve" is not available.
--
-- Prisma P3009 = "failed migrations in target database". This happens when:
-- - A previous deploy tried to run the migration, it failed (e.g. table already existed),
--   and Prisma left a row with finished_at = NULL.
-- - A manual insert used the wrong checksum.
--
-- This script:
-- 1. Removes any existing failed/conflicting rows for this migration
-- 2. Inserts the correct row with the exact checksum Prisma expects

-- Remove failed or conflicting rows
DELETE FROM "_prisma_migrations"
WHERE "migration_name" = '20250305000000_add_meeting_log';

-- Insert the correct applied migration record
-- Checksum = SHA256 of migration.sql (lowercase hex)
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
    'f1644fcb1b689e9733477c3bed91676b0e00a4a20919bac6064a25fd340538d8',
    now(),
    '20250305000000_add_meeting_log',
    NULL,
    NULL,
    now(),
    1
);
