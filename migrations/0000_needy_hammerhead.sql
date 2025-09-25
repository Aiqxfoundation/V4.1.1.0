CREATE TABLE "btc_price_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"source" text DEFAULT 'system',
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "btc_stakes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"btc_amount" numeric(18, 8) NOT NULL,
	"b2b_hashrate" numeric(10, 2) NOT NULL,
	"btc_price_at_stake" numeric(10, 2) NOT NULL,
	"apr_rate" numeric(5, 2) DEFAULT '20.00',
	"daily_reward" numeric(18, 8) NOT NULL,
	"total_rewards_paid" numeric(18, 8) DEFAULT '0.00000000',
	"staked_at" timestamp DEFAULT now(),
	"unlock_at" timestamp NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"last_reward_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "btc_staking_rewards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stake_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"reward_amount" numeric(18, 8) NOT NULL,
	"btc_price" numeric(10, 2) NOT NULL,
	"paid_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "deposit_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"address" varchar(100) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"assigned_to_user_id" uuid,
	"assigned_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "deposit_addresses_address_unique" UNIQUE("address")
);
--> statement-breakpoint
CREATE TABLE "deposits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"network" text NOT NULL,
	"tx_hash" text NOT NULL,
	"amount" numeric(18, 8) NOT NULL,
	"currency" text DEFAULT 'USDT' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"admin_note" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "deposits_tx_hash_unique" UNIQUE("tx_hash")
);
--> statement-breakpoint
CREATE TABLE "device_fingerprints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"stable_hash" text NOT NULL,
	"volatile_hash" text NOT NULL,
	"ch_ua_hash" text,
	"webgl_hash" text,
	"canvas_hash" text,
	"fonts_hash" text,
	"storage_flags" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"server_device_id" text NOT NULL,
	"first_seen" timestamp DEFAULT now(),
	"last_seen" timestamp DEFAULT now(),
	"last_ip" text,
	"asn" text,
	"registrations" integer DEFAULT 0,
	"risk_score" integer DEFAULT 0,
	"blocked" boolean DEFAULT false,
	"signals_version" text DEFAULT '1.0',
	CONSTRAINT "devices_server_device_id_unique" UNIQUE("server_device_id")
);
--> statement-breakpoint
CREATE TABLE "miner_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"last_claim_time" timestamp,
	"total_claims" integer DEFAULT 0,
	"missed_claims" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "miner_activity_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "mining_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" integer NOT NULL,
	"reward" numeric(18, 8) NOT NULL,
	"total_hash_power" numeric(10, 2) NOT NULL,
	"global_hashrate" numeric(10, 2) DEFAULT '0.00',
	"block_start_time" timestamp,
	"block_end_time" timestamp,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "mining_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"block_number" integer NOT NULL,
	"locked_hashrate" numeric(10, 2) NOT NULL,
	"reward" numeric(18, 8) NOT NULL,
	"claimed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "mining_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"total_hash_power" numeric(15, 2) DEFAULT '0.00',
	"active_miners" integer DEFAULT 0,
	"total_blocks_mined" integer DEFAULT 0,
	"current_difficulty" numeric(10, 2) DEFAULT '1.00',
	"network_status" text DEFAULT 'active',
	"last_block_time" timestamp DEFAULT now(),
	"avg_block_time" integer DEFAULT 600,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "referral_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(8) NOT NULL,
	"owner_id" uuid NOT NULL,
	"used_by" uuid,
	"is_used" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"used_at" timestamp,
	CONSTRAINT "referral_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "referral_rewards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referrer_id" uuid NOT NULL,
	"referred_user_id" uuid NOT NULL,
	"usdt_reward" numeric(10, 2) NOT NULL,
	"hash_reward" numeric(10, 2) NOT NULL,
	"is_claimed" boolean DEFAULT false,
	"purchase_amount" numeric(10, 2) NOT NULL,
	"purchase_hashrate" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"claimed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "system_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_user_id" uuid NOT NULL,
	"to_user_id" uuid NOT NULL,
	"amount" numeric(18, 8) NOT NULL,
	"tx_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "unclaimed_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"block_number" integer NOT NULL,
	"tx_hash" text NOT NULL,
	"reward" numeric(18, 8) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"claimed" boolean DEFAULT false,
	"claimed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"first_linked" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_mining_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"total_hash_power" numeric(10, 2) DEFAULT '0.00',
	"total_mined" numeric(18, 8) DEFAULT '0.00000000',
	"total_claimed" numeric(18, 8) DEFAULT '0.00000000',
	"blocks_participated" integer DEFAULT 0,
	"last_mining_activity" timestamp DEFAULT now(),
	"mining_efficiency" numeric(5, 2) DEFAULT '100.00',
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"access_key" text NOT NULL,
	"referral_code" text,
	"referred_by" text,
	"registration_ip" text,
	"usdt_balance" numeric(10, 2) DEFAULT '0.00',
	"btc_balance" numeric(18, 8) DEFAULT '0.00000000',
	"hash_power" numeric(10, 2) DEFAULT '0.00',
	"base_hash_power" numeric(10, 2) DEFAULT '0.00',
	"referral_hash_bonus" numeric(10, 2) DEFAULT '0.00',
	"b2b_balance" numeric(18, 8) DEFAULT '0.00000000',
	"unclaimed_balance" numeric(18, 8) DEFAULT '0.00000000',
	"total_referral_earnings" numeric(10, 2) DEFAULT '0.00',
	"total_referral_codes" integer DEFAULT 0,
	"unclaimed_referral_usdt" numeric(10, 2) DEFAULT '0.00',
	"unclaimed_referral_hash" numeric(10, 2) DEFAULT '0.00',
	"last_active_block" integer,
	"personal_block_height" integer DEFAULT 0,
	"last_claimed_block" integer,
	"locked_hash_power" numeric(10, 2) DEFAULT '0.00',
	"mining_active" boolean DEFAULT true,
	"last_activity_time" timestamp,
	"next_block_hash_power" numeric(10, 2) DEFAULT '0.00',
	"is_admin" boolean DEFAULT false,
	"is_frozen" boolean DEFAULT false,
	"is_banned" boolean DEFAULT false,
	"has_started_mining" boolean DEFAULT false,
	"has_paid_purchase" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_access_key_unique" UNIQUE("access_key"),
	CONSTRAINT "users_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE TABLE "withdrawals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" numeric(18, 8) NOT NULL,
	"address" text NOT NULL,
	"network" text NOT NULL,
	"currency" text DEFAULT 'USDT' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"tx_hash" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "btc_stakes" ADD CONSTRAINT "btc_stakes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "btc_staking_rewards" ADD CONSTRAINT "btc_staking_rewards_stake_id_btc_stakes_id_fk" FOREIGN KEY ("stake_id") REFERENCES "public"."btc_stakes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "btc_staking_rewards" ADD CONSTRAINT "btc_staking_rewards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_addresses" ADD CONSTRAINT "deposit_addresses_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_fingerprints" ADD CONSTRAINT "device_fingerprints_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "miner_activity" ADD CONSTRAINT "miner_activity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mining_history" ADD CONSTRAINT "mining_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_codes" ADD CONSTRAINT "referral_codes_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_codes" ADD CONSTRAINT "referral_codes_used_by_users_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_referrer_id_users_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_referred_user_id_users_id_fk" FOREIGN KEY ("referred_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unclaimed_blocks" ADD CONSTRAINT "unclaimed_blocks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_mining_stats" ADD CONSTRAINT "user_mining_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;