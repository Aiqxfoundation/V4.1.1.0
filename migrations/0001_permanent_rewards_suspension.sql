-- Migration: Implement permanent rewards with suspension after 24 unclaimed blocks
-- Date: 2025-09-23
-- Description: Remove expiry logic, add suspension mechanism

-- Add new fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS unclaimed_blocks_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS mining_suspended BOOLEAN DEFAULT false;

-- Make expiresAt nullable in unclaimed_blocks (rewards never expire)
ALTER TABLE unclaimed_blocks 
ALTER COLUMN expires_at DROP NOT NULL;

-- Update any existing unclaimed blocks to have NULL expiry
UPDATE unclaimed_blocks 
SET expires_at = NULL 
WHERE claimed = false;

-- Update any users with unclaimed blocks to set their count
UPDATE users u
SET unclaimed_blocks_count = (
    SELECT COUNT(*) 
    FROM unclaimed_blocks ub 
    WHERE ub.user_id = u.id 
    AND ub.claimed = false
);

-- Suspend users with 24 or more unclaimed blocks
UPDATE users 
SET mining_suspended = true 
WHERE unclaimed_blocks_count >= 24;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_mining_suspended ON users(mining_suspended);
CREATE INDEX IF NOT EXISTS idx_users_unclaimed_blocks_count ON users(unclaimed_blocks_count);