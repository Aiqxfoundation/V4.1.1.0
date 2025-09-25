-- Migration to implement the global reward index system for O(1) calculations
-- This preserves the exact same reward formula but enables massive scalability

-- Step 1: Add new columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS user_index DECIMAL(38, 18) DEFAULT 0,
ADD COLUMN IF NOT EXISTS accrued_pending DECIMAL(38, 18) DEFAULT 0,
ADD COLUMN IF NOT EXISTS suspension_at_block INTEGER;

-- Step 2: Add cumulative index to mining_blocks table
ALTER TABLE mining_blocks
ADD COLUMN IF NOT EXISTS cumulative_index DECIMAL(38, 18) DEFAULT 0;

-- Step 3: Initialize global mining state
-- Calculate total hash power from active miners
INSERT INTO system_settings (key, value) 
VALUES ('global_mining_state', 
    json_build_object(
        'totalHashPower', (SELECT COALESCE(SUM(locked_hash_power), 0)::text FROM users WHERE mining_active = true AND COALESCE(mining_suspended, false) = false),
        'globalRewardIndex', '0',
        'currentBlock', (SELECT COALESCE(MAX(block_number), 0) FROM mining_blocks),
        'lastIndexUpdate', NOW()::text
    )::text
) 
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value,
    updated_at = NOW();

-- Step 4: Migrate existing unclaimed rewards to accrued_pending
UPDATE users u
SET accrued_pending = COALESCE((
    SELECT SUM(ub.reward::decimal)
    FROM unclaimed_blocks ub
    WHERE ub.user_id = u.id 
    AND ub.claimed = false
), 0);

-- Step 5: Set suspension_at_block based on current state
UPDATE users
SET suspension_at_block = CASE
    WHEN mining_suspended = true THEN COALESCE(personal_block_height, 0)
    ELSE COALESCE(personal_block_height, 0) + 24
END;

-- Step 6: Calculate and populate cumulative index for existing blocks
-- This ensures historical blocks work with the new system
DO $$
DECLARE
    block_rec RECORD;
    cumulative_idx DECIMAL(38, 18) := 0;
    reward_per_hash DECIMAL(38, 18);
BEGIN
    -- Process blocks in order to calculate cumulative index
    FOR block_rec IN 
        SELECT block_number, reward::decimal, total_hash_power::decimal
        FROM mining_blocks 
        WHERE total_hash_power > 0
        ORDER BY block_number
    LOOP
        -- Calculate reward per hash for this block
        reward_per_hash := block_rec.reward / block_rec.total_hash_power;
        
        -- Add to cumulative index
        cumulative_idx := cumulative_idx + reward_per_hash;
        
        -- Update the block with its cumulative index
        UPDATE mining_blocks 
        SET cumulative_index = cumulative_idx
        WHERE block_number = block_rec.block_number;
    END LOOP;
    
    -- Update the global state with the final cumulative index
    IF cumulative_idx > 0 THEN
        UPDATE system_settings
        SET value = json_build_object(
            'totalHashPower', (SELECT COALESCE(SUM(locked_hash_power), 0)::text FROM users WHERE mining_active = true AND COALESCE(mining_suspended, false) = false),
            'globalRewardIndex', cumulative_idx::text,
            'currentBlock', (SELECT COALESCE(MAX(block_number), 0) FROM mining_blocks),
            'lastIndexUpdate', NOW()::text
        )::text,
        updated_at = NOW()
        WHERE key = 'global_mining_state';
    END IF;
END $$;

-- Step 7: Initialize user indices based on their last claimed block
-- This ensures users don't get double rewards for blocks they've already claimed
UPDATE users u
SET user_index = COALESCE((
    SELECT cumulative_index 
    FROM mining_blocks mb
    WHERE mb.block_number = u.last_claimed_block
), 0)
WHERE last_claimed_block IS NOT NULL;

-- Step 8: Create index for performance optimization
CREATE INDEX IF NOT EXISTS idx_users_user_index ON users(user_index);
CREATE INDEX IF NOT EXISTS idx_mining_blocks_cumulative_index ON mining_blocks(cumulative_index);
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);

-- Step 9: Add comment explaining the new system
COMMENT ON COLUMN users.user_index IS 'User last settled global reward index for O(1) reward calculation';
COMMENT ON COLUMN users.accrued_pending IS 'Accumulated pending rewards calculated using global index';
COMMENT ON COLUMN users.suspension_at_block IS 'Block number when mining will be suspended if not claimed';
COMMENT ON COLUMN mining_blocks.cumulative_index IS 'Cumulative reward per hash up to this block for O(1) calculations';

-- Log migration completion
INSERT INTO system_settings (key, value) 
VALUES ('migration_global_index_completed', NOW()::text)
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value;

-- Migration complete!
-- The system now uses O(1) calculations instead of O(N) for reward distribution