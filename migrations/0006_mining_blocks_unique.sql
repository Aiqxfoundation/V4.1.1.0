-- Add unique constraint on block_number to mining_blocks
-- This allows ON CONFLICT (block_number) upserts and prevents duplicate blocks
CREATE UNIQUE INDEX IF NOT EXISTS idx_mining_blocks_block_number_unique
  ON mining_blocks (block_number);
