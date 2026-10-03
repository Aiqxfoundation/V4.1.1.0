-- Add security_pin column to users table for PIN-based verification
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "security_pin" text;
