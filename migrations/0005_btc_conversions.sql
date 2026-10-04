-- Create btc_conversions table for tracking BTC/USDT conversions
CREATE TABLE IF NOT EXISTS "btc_conversions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "from_currency" varchar(10) NOT NULL,
  "to_currency" varchar(10) NOT NULL,
  "from_amount" decimal(18,8) NOT NULL,
  "to_amount" decimal(18,8) NOT NULL,
  "fee" decimal(18,8) NOT NULL,
  "rate" decimal(18,8) NOT NULL,
  "created_at" timestamp DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_btc_conversions_user_id ON btc_conversions(user_id);
CREATE INDEX IF NOT EXISTS idx_btc_conversions_created_at ON btc_conversions(created_at);
