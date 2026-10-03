-- Create user_address_assignments table for tracking address assignments with cooldowns
CREATE TABLE IF NOT EXISTS "user_address_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "currency" varchar(10) NOT NULL, -- 'USDT', 'BTC'
  "network" varchar(20), -- 'ERC20', 'BSC', null for BTC
  "address" varchar(100) NOT NULL,
  "assigned_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "expires_at" timestamp NOT NULL, -- 24 hours from assigned_at
  "created_at" timestamp DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient lookups (idempotent)
CREATE INDEX IF NOT EXISTS idx_user_address_assignments_user_id ON user_address_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_address_assignments_expires_at ON user_address_assignments(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_address_assignments_currency_network ON user_address_assignments(currency, network);

-- Create composite index for finding active assignments.
-- Note: a partial index predicate cannot use CURRENT_TIMESTAMP (not IMMUTABLE),
-- so this is a plain index covering the lookup columns instead.
CREATE INDEX IF NOT EXISTS idx_user_address_active_assignments
ON user_address_assignments(user_id, currency, network, expires_at);