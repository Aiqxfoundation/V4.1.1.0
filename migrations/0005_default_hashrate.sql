-- Set default hashrate (100 KH/s = 0.1 in system units) for all existing users who have 0.
-- This ensures every user has the fair default hashrate as per app rules.
-- New users get 100 KH/s free when they start mining (see /api/start-mining route).
-- This migration backfills existing users who registered but never started mining.
-- Idempotent: only updates users with 0 base_hash_power.
UPDATE "users"
SET "base_hash_power" = '0.10',
    "hash_power" = ('0.10' + COALESCE("referral_hash_bonus", '0.00'))::numeric(10,2)
WHERE "base_hash_power" = '0.00'
  AND "hash_power" = '0.00';
