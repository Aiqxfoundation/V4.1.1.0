-- Add security_pin column to users table for withdrawal PIN verification.
-- Idempotent: uses IF NOT EXISTS so it can be re-run safely.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "security_pin" text;
