-- Increase precision on USDT-related columns to prevent numeric field overflow
-- when large balances (e.g. 1 billion USDT) are set.
-- precision 10, scale 2 → max 99,999,999.99 (overflows at 10^8)
-- precision 18, scale 2 → max 99,999,999,999,999,999.99

ALTER TABLE users ALTER COLUMN usdt_balance TYPE DECIMAL(18, 2);
ALTER TABLE users ALTER COLUMN total_referral_earnings TYPE DECIMAL(18, 2);
ALTER TABLE users ALTER COLUMN unclaimed_referral_usdt TYPE DECIMAL(18, 2);
