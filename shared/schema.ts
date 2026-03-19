import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, integer, boolean, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  accessKey: text("access_key").notNull().unique(),
  referralCode: text("referral_code").unique(),
  referredBy: text("referred_by"), // Referral code of the user who referred them
  registrationIp: text("registration_ip"), // IP address that created this account
  usdtBalance: decimal("usdt_balance", { precision: 10, scale: 2 }).default("0.00"),
  btcBalance: decimal("btc_balance", { precision: 18, scale: 8 }).default("0.00000000"), // BTC balance
  hashPower: decimal("hash_power", { precision: 10, scale: 2 }).default("0.00"),
  baseHashPower: decimal("base_hash_power", { precision: 10, scale: 2 }).default("0.00"), // User's own hash power
  referralHashBonus: decimal("referral_hash_bonus", { precision: 10, scale: 2 }).default("0.00"), // 5% from active referrals
  b2bBalance: decimal("b2b_balance", { precision: 18, scale: 8 }).default("0.00000000"),
  unclaimedBalance: decimal("unclaimed_balance", { precision: 18, scale: 8 }).default("0.00000000"),
  totalReferralEarnings: decimal("total_referral_earnings", { precision: 10, scale: 2 }).default("0.00"),
  totalReferralCodes: integer("total_referral_codes").default(0), // total codes generated
  unclaimedReferralUsdt: decimal("unclaimed_referral_usdt", { precision: 10, scale: 2 }).default("0.00"), // pending USDT rewards
  unclaimedReferralHash: decimal("unclaimed_referral_hash", { precision: 10, scale: 2 }).default("0.00"), // pending hashrate rewards
  lastActiveBlock: integer("last_active_block"), // Last block user was active in
  personalBlockHeight: integer("personal_block_height").default(0), // User's current block number
  lastClaimedBlock: integer("last_claimed_block"), // Last block user claimed
  lockedHashPower: decimal("locked_hash_power", { precision: 10, scale: 2 }).default("0.00"), // Hashrate locked for current block
  miningActive: boolean("mining_active").default(true), // Active/suspended status
  lastActivityTime: timestamp("last_activity_time"), // Last claim/activity
  nextBlockHashPower: decimal("next_block_hash_power", { precision: 10, scale: 2 }).default("0.00"), // Hashrate to be applied in next block
  isAdmin: boolean("is_admin").default(false),
  isFrozen: boolean("is_frozen").default(false),
  isBanned: boolean("is_banned").default(false),
  hasStartedMining: boolean("has_started_mining").default(false),
  hasPaidPurchase: boolean("has_paid_purchase").default(false), // Track if user has made a paid purchase
  unclaimedBlocksCount: integer("unclaimed_blocks_count").default(0), // Tracks consecutive unclaimed blocks
  miningSuspended: boolean("mining_suspended").default(false), // Mining suspended after 24 unclaimed blocks
  // Global index tracking for O(1) reward calculation
  userIndex: decimal("user_index", { precision: 38, scale: 18 }).default("0"),
  accruedPending: decimal("accrued_pending", { precision: 38, scale: 18 }).default("0"),
  suspensionAtBlock: integer("suspension_at_block"),
  securityPin: text("security_pin"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const referralCodes = pgTable("referral_codes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code", { length: 8 }).notNull().unique(),
  ownerId: uuid("owner_id").references(() => users.id).notNull(),
  usedBy: uuid("used_by").references(() => users.id),
  isUsed: boolean("is_used").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  usedAt: timestamp("used_at"),
});

export const referralRewards = pgTable("referral_rewards", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  referrerId: uuid("referrer_id").references(() => users.id).notNull(),
  referredUserId: uuid("referred_user_id").references(() => users.id).notNull(),
  usdtReward: decimal("usdt_reward", { precision: 10, scale: 2 }).notNull(),
  hashReward: decimal("hash_reward", { precision: 10, scale: 2 }).notNull(),
  isClaimed: boolean("is_claimed").default(false),
  purchaseAmount: decimal("purchase_amount", { precision: 10, scale: 2 }).notNull(),
  purchaseHashrate: decimal("purchase_hashrate", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  claimedAt: timestamp("claimed_at"),
});

export const deposits = pgTable("deposits", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  network: text("network").notNull(), // "BSC", "ETH", "TRC20", "APTOS"
  txHash: text("tx_hash").notNull().unique(),
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  currency: text("currency").notNull().default("USDT"), // "USDT" or "ETH"
  status: text("status").notNull().default("pending"), // "pending", "approved", "rejected"
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const withdrawals = pgTable("withdrawals", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  address: text("address").notNull(),
  network: text("network").notNull(), // "ERC20", "BSC", "TRC20" for USDT, "B2B" for B2B, "ETH" for ETH
  currency: text("currency").notNull().default("USDT"), // "USDT", "ETH", or "B2B"
  status: text("status").notNull().default("pending"), // "pending", "completed", "rejected"
  txHash: text("tx_hash"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const unclaimedBlocks = pgTable("unclaimed_blocks", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  blockNumber: integer("block_number").notNull(),
  txHash: text("tx_hash").notNull(),
  reward: decimal("reward", { precision: 18, scale: 8 }).notNull(),
  expiresAt: timestamp("expires_at"), // Made nullable - rewards never expire
  claimed: boolean("claimed").default(false),
  claimedAt: timestamp("claimed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const minerActivity = pgTable("miner_activity", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull().unique(),
  lastClaimTime: timestamp("last_claim_time"),
  totalClaims: integer("total_claims").default(0),
  missedClaims: integer("missed_claims").default(0),
  isActive: boolean("is_active").default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const transfers = pgTable("transfers", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  fromUserId: uuid("from_user_id").references(() => users.id).notNull(),
  toUserId: uuid("to_user_id").references(() => users.id).notNull(),
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  txHash: text("tx_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const miningBlocks = pgTable("mining_blocks", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  blockNumber: integer("block_number").notNull(),
  reward: decimal("reward", { precision: 18, scale: 8 }).notNull(),
  totalHashPower: decimal("total_hash_power", { precision: 10, scale: 2 }).notNull(),
  globalHashrate: decimal("global_hashrate", { precision: 10, scale: 2 }).default("0.00"),
  // Cumulative reward per hash at this block for O(1) calculation
  cumulativeIndex: decimal("cumulative_index", { precision: 38, scale: 18 }).default("0"),
  blockStartTime: timestamp("block_start_time"),
  blockEndTime: timestamp("block_end_time"),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const miningHistory = pgTable("mining_history", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  blockNumber: integer("block_number").notNull(),
  lockedHashrate: decimal("locked_hashrate", { precision: 10, scale: 2 }).notNull(),
  reward: decimal("reward", { precision: 18, scale: 8 }).notNull(),
  claimedAt: timestamp("claimed_at").defaultNow(),
});

export const miningStats = pgTable("mining_stats", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  totalHashPower: decimal("total_hash_power", { precision: 15, scale: 2 }).default("0.00"),
  activeMiners: integer("active_miners").default(0),
  totalBlocksMined: integer("total_blocks_mined").default(0),
  currentDifficulty: decimal("current_difficulty", { precision: 10, scale: 2 }).default("1.00"),
  networkStatus: text("network_status").default("active"), // "active", "maintenance", "paused"
  lastBlockTime: timestamp("last_block_time").defaultNow(),
  avgBlockTime: integer("avg_block_time").default(600), // seconds
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const userMiningStats = pgTable("user_mining_stats", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  totalHashPower: decimal("total_hash_power", { precision: 10, scale: 2 }).default("0.00"),
  totalMined: decimal("total_mined", { precision: 18, scale: 8 }).default("0.00000000"),
  totalClaimed: decimal("total_claimed", { precision: 18, scale: 8 }).default("0.00000000"),
  blocksParticipated: integer("blocks_participated").default(0),
  lastMiningActivity: timestamp("last_mining_activity").defaultNow(),
  miningEfficiency: decimal("mining_efficiency", { precision: 5, scale: 2 }).default("100.00"), // percentage
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const systemSettings = pgTable("system_settings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// BTC Staking Tables
export const btcStakes = pgTable("btc_stakes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  btcAmount: decimal("btc_amount", { precision: 18, scale: 8 }).notNull(), // Amount of BTC staked
  b2bHashrate: decimal("b2b_hashrate", { precision: 10, scale: 2 }).notNull(), // Equivalent B2B hashrate locked
  btcPriceAtStake: decimal("btc_price_at_stake", { precision: 10, scale: 2 }).notNull(), // BTC price when staked
  aprRate: decimal("apr_rate", { precision: 5, scale: 2 }).default("20.00"), // 20% APR
  dailyReward: decimal("daily_reward", { precision: 18, scale: 8 }).notNull(), // Daily BTC reward
  totalRewardsPaid: decimal("total_rewards_paid", { precision: 18, scale: 8 }).default("0.00000000"),
  stakedAt: timestamp("staked_at").defaultNow(),
  unlockAt: timestamp("unlock_at").notNull(), // 1 year from stake date
  status: text("status").notNull().default("active"), // "active", "completed", "cancelled"
  lastRewardAt: timestamp("last_reward_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const btcStakingRewards = pgTable("btc_staking_rewards", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  stakeId: uuid("stake_id").references(() => btcStakes.id).notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  rewardAmount: decimal("reward_amount", { precision: 18, scale: 8 }).notNull(),
  btcPrice: decimal("btc_price", { precision: 10, scale: 2 }).notNull(),
  paidAt: timestamp("paid_at").defaultNow(),
});

export const btcPriceHistory = pgTable("btc_price_history", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  source: text("source").default("system"), // "system", "manual", "api"
  timestamp: timestamp("timestamp").defaultNow(),
});

// Deposit Address Management Table
export const depositAddresses = pgTable("deposit_addresses", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  address: varchar("address", { length: 100 }).notNull().unique(), // Support various address formats
  isActive: boolean("is_active").default(true).notNull(), // Whether address is available for assignment
  assignedToUserId: uuid("assigned_to_user_id").references(() => users.id), // Foreign key to users table, null if unassigned
  assignedAt: timestamp("assigned_at"), // When it was last assigned
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User Address Assignments - Tracks address assignments with cooldowns
export const btcConversions = pgTable("btc_conversions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  fromCurrency: varchar("from_currency", { length: 10 }).notNull(),
  toCurrency: varchar("to_currency", { length: 10 }).notNull(),
  fromAmount: decimal("from_amount", { precision: 18, scale: 8 }).notNull(),
  toAmount: decimal("to_amount", { precision: 18, scale: 8 }).notNull(),
  fee: decimal("fee", { precision: 18, scale: 8 }).notNull(),
  rate: decimal("rate", { precision: 18, scale: 8 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userAddressAssignments = pgTable("user_address_assignments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  currency: varchar("currency", { length: 10 }).notNull(), // 'USDT', 'BTC'
  network: varchar("network", { length: 20 }), // 'ERC20', 'BSC', null for BTC
  address: varchar("address", { length: 100 }).notNull(),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(), // 24 hours from assignedAt
  createdAt: timestamp("created_at").defaultNow(),
});

// Device Fingerprinting Tables
export const devices = pgTable("devices", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  serverDeviceId: text("server_device_id").notNull().unique(),
  firstSeen: timestamp("first_seen").defaultNow(),
  lastSeen: timestamp("last_seen").defaultNow(),
  lastIp: text("last_ip"),
  asn: text("asn"),
  registrations: integer("registrations").default(0),
  riskScore: integer("risk_score").default(0),
  blocked: boolean("blocked").default(false),
  signalsVersion: text("signals_version").default("1.0"),
});

export const deviceFingerprints = pgTable("device_fingerprints", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  deviceId: uuid("device_id").references(() => devices.id).notNull(),
  stableHash: text("stable_hash").notNull(),
  volatileHash: text("volatile_hash").notNull(),
  chUaHash: text("ch_ua_hash"),
  webglHash: text("webgl_hash"),
  canvasHash: text("canvas_hash"),
  fontsHash: text("fonts_hash"),
  storageFlags: text("storage_flags"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userDevices = pgTable("user_devices", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  deviceId: uuid("device_id").references(() => devices.id).notNull(),
  firstLinked: timestamp("first_linked").defaultNow(),
});

export const usersRelations = relations(users, ({ many, one }) => ({
  deposits: many(deposits),
  withdrawals: many(withdrawals),
  unclaimedBlocks: many(unclaimedBlocks),
  sentTransfers: many(transfers, {
    relationName: "sentTransfers",
  }),
  receivedTransfers: many(transfers, {
    relationName: "receivedTransfers",
  }),
  minerActivity: one(minerActivity),
  miningStats: one(userMiningStats),
  miningHistory: many(miningHistory),
  btcStakes: many(btcStakes),
  btcStakingRewards: many(btcStakingRewards),
  userDevices: many(userDevices),
  ownedReferralCodes: many(referralCodes, {
    relationName: "ownedCodes",
  }),
  usedReferralCode: one(referralCodes, {
    fields: [users.id],
    references: [referralCodes.usedBy],
    relationName: "usedCode",
  }),
  referralRewardsEarned: many(referralRewards, {
    relationName: "rewardsEarned",
  }),
  referralRewardsGenerated: many(referralRewards, {
    relationName: "rewardsGenerated",
  }),
  depositAddress: one(depositAddresses, {
    fields: [users.id],
    references: [depositAddresses.assignedToUserId],
  }),
}));

export const depositsRelations = relations(deposits, ({ one }) => ({
  user: one(users, {
    fields: [deposits.userId],
    references: [users.id],
  }),
}));

export const withdrawalsRelations = relations(withdrawals, ({ one }) => ({
  user: one(users, {
    fields: [withdrawals.userId],
    references: [users.id],
  }),
}));

export const unclaimedBlocksRelations = relations(unclaimedBlocks, ({ one }) => ({
  user: one(users, {
    fields: [unclaimedBlocks.userId],
    references: [users.id],
  }),
}));

export const minerActivityRelations = relations(minerActivity, ({ one }) => ({
  user: one(users, {
    fields: [minerActivity.userId],
    references: [users.id],
  }),
}));

export const transfersRelations = relations(transfers, ({ one }) => ({
  fromUser: one(users, {
    fields: [transfers.fromUserId],
    references: [users.id],
    relationName: "sentTransfers",
  }),
  toUser: one(users, {
    fields: [transfers.toUserId],
    references: [users.id],
    relationName: "receivedTransfers",
  }),
}));

export const userMiningStatsRelations = relations(userMiningStats, ({ one }) => ({
  user: one(users, {
    fields: [userMiningStats.userId],
    references: [users.id],
  }),
}));

export const miningHistoryRelations = relations(miningHistory, ({ one }) => ({
  user: one(users, {
    fields: [miningHistory.userId],
    references: [users.id],
  }),
}));

export const btcStakesRelations = relations(btcStakes, ({ one, many }) => ({
  user: one(users, {
    fields: [btcStakes.userId],
    references: [users.id],
  }),
  rewards: many(btcStakingRewards),
}));

export const btcStakingRewardsRelations = relations(btcStakingRewards, ({ one }) => ({
  user: one(users, {
    fields: [btcStakingRewards.userId],
    references: [users.id],
  }),
  stake: one(btcStakes, {
    fields: [btcStakingRewards.stakeId],
    references: [btcStakes.id],
  }),
}));

export const devicesRelations = relations(devices, ({ many }) => ({
  fingerprints: many(deviceFingerprints),
  userDevices: many(userDevices),
}));

export const deviceFingerprintsRelations = relations(deviceFingerprints, ({ one }) => ({
  device: one(devices, {
    fields: [deviceFingerprints.deviceId],
    references: [devices.id],
  }),
}));

export const userDevicesRelations = relations(userDevices, ({ one }) => ({
  user: one(users, {
    fields: [userDevices.userId],
    references: [users.id],
  }),
  device: one(devices, {
    fields: [userDevices.deviceId],
    references: [devices.id],
  }),
}));

export const referralCodesRelations = relations(referralCodes, ({ one }) => ({
  owner: one(users, {
    fields: [referralCodes.ownerId],
    references: [users.id],
    relationName: "ownedCodes",
  }),
  usedByUser: one(users, {
    fields: [referralCodes.usedBy],
    references: [users.id],
    relationName: "usedCode",
  }),
}));

export const referralRewardsRelations = relations(referralRewards, ({ one }) => ({
  referrer: one(users, {
    fields: [referralRewards.referrerId],
    references: [users.id],
    relationName: "rewardsEarned",
  }),
  referredUser: one(users, {
    fields: [referralRewards.referredUserId],
    references: [users.id],
    relationName: "rewardsGenerated",
  }),
}));

export const depositAddressesRelations = relations(depositAddresses, ({ one }) => ({
  assignedUser: one(users, {
    fields: [depositAddresses.assignedToUserId],
    references: [users.id],
  }),
}));

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  registrationIp: true,
  usdtBalance: true,
  btcBalance: true,
  hashPower: true,
  baseHashPower: true,
  referralHashBonus: true,
  b2bBalance: true,
  unclaimedBalance: true,
  totalReferralEarnings: true,
  lastActiveBlock: true,
  personalBlockHeight: true,
  lastClaimedBlock: true,
  lockedHashPower: true,
  miningActive: true,
  lastActivityTime: true,
  nextBlockHashPower: true,
  isAdmin: true,
  isFrozen: true,
  isBanned: true,
  hasStartedMining: true,
  hasPaidPurchase: true,
}).extend({
  accessKey: z.string().regex(/^B2B-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/, "Access key must be in format B2B-XXXXX-XXXXX-XXXXX-XXXXX"),
});

export const insertDepositSchema = createInsertSchema(deposits).omit({
  id: true,
  userId: true,
  status: true,
  adminNote: true,
  currency: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWithdrawalSchema = createInsertSchema(withdrawals).omit({
  id: true,
  userId: true,
  status: true,
  txHash: true,
  currency: true,
  createdAt: true,
});

export const insertTransferSchema = createInsertSchema(transfers).omit({
  id: true,
  fromUserId: true,
  txHash: true,
  createdAt: true,
});

export const insertUnclaimedBlockSchema = createInsertSchema(unclaimedBlocks).omit({
  id: true,
  userId: true,
  claimed: true,
  claimedAt: true,
  createdAt: true,
});

export const insertBtcStakeSchema = createInsertSchema(btcStakes).omit({
  id: true,
  userId: true,
  totalRewardsPaid: true,
  status: true,
  lastRewardAt: true,
  createdAt: true,
  stakedAt: true,
});

export const insertBtcStakingRewardSchema = createInsertSchema(btcStakingRewards).omit({
  id: true,
  userId: true,
  paidAt: true,
});

export const insertBtcPriceHistorySchema = createInsertSchema(btcPriceHistory).omit({
  id: true,
  source: true,
  timestamp: true,
});

export const insertDeviceSchema = createInsertSchema(devices).omit({
  id: true,
  firstSeen: true,
  lastSeen: true,
  registrations: true,
  riskScore: true,
  blocked: true,
  signalsVersion: true,
});

export const insertDeviceFingerprintSchema = createInsertSchema(deviceFingerprints).omit({
  id: true,
  createdAt: true,
});

export const insertUserDeviceSchema = createInsertSchema(userDevices).omit({
  id: true,
  firstLinked: true,
});

export const insertMiningHistorySchema = createInsertSchema(miningHistory).omit({
  id: true,
  claimedAt: true,
});

export const insertReferralCodeSchema = createInsertSchema(referralCodes).omit({
  id: true,
  isUsed: true,
  usedBy: true,
  usedAt: true,
  createdAt: true,
});

export const insertReferralRewardSchema = createInsertSchema(referralRewards).omit({
  id: true,
  isClaimed: true,
  claimedAt: true,
  createdAt: true,
});

export const insertDepositAddressSchema = createInsertSchema(depositAddresses).omit({
  id: true,
  assignedToUserId: true,
  assignedAt: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  address: z.string().regex(/^(0x[a-fA-F0-9]{40}|T[A-Za-z1-9]{33})$/, "Invalid address format (must be ERC20/BSC format starting with 0x or TRON format starting with T)"),
});

export const insertUserAddressAssignmentSchema = createInsertSchema(userAddressAssignments).omit({
  id: true,
  assignedAt: true,
  createdAt: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Deposit = typeof deposits.$inferSelect;
export type InsertDeposit = z.infer<typeof insertDepositSchema>;
export type Withdrawal = typeof withdrawals.$inferSelect;
export type InsertWithdrawal = z.infer<typeof insertWithdrawalSchema>;
export type MiningBlock = typeof miningBlocks.$inferSelect;
export type SystemSetting = typeof systemSettings.$inferSelect;
export type MiningStats = typeof miningStats.$inferSelect;
export type Transfer = typeof transfers.$inferSelect;
export type MinerActivity = typeof minerActivity.$inferSelect;
export type UserMiningStats = typeof userMiningStats.$inferSelect;
export type UnclaimedBlock = typeof unclaimedBlocks.$inferSelect;
export type InsertUnclaimedBlock = z.infer<typeof insertUnclaimedBlockSchema>;
export type InsertTransfer = z.infer<typeof insertTransferSchema>;
export type BtcStake = typeof btcStakes.$inferSelect;
export type InsertBtcStake = z.infer<typeof insertBtcStakeSchema>;
export type BtcStakingReward = typeof btcStakingRewards.$inferSelect;
export type InsertBtcStakingReward = z.infer<typeof insertBtcStakingRewardSchema>;
export type BtcPriceHistory = typeof btcPriceHistory.$inferSelect;
export type InsertBtcPriceHistory = z.infer<typeof insertBtcPriceHistorySchema>;
export type BtcConversion = typeof btcConversions.$inferSelect;
export type Device = typeof devices.$inferSelect;
export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type DeviceFingerprint = typeof deviceFingerprints.$inferSelect;
export type InsertDeviceFingerprint = z.infer<typeof insertDeviceFingerprintSchema>;
export type UserDevice = typeof userDevices.$inferSelect;
export type InsertUserDevice = z.infer<typeof insertUserDeviceSchema>;
export type MiningHistory = typeof miningHistory.$inferSelect;
export type InsertMiningHistory = z.infer<typeof insertMiningHistorySchema>;
export type ReferralCode = typeof referralCodes.$inferSelect;
export type InsertReferralCode = z.infer<typeof insertReferralCodeSchema>;
export type ReferralReward = typeof referralRewards.$inferSelect;
export type InsertReferralReward = z.infer<typeof insertReferralRewardSchema>;
export type DepositAddress = typeof depositAddresses.$inferSelect;
export type InsertDepositAddress = z.infer<typeof insertDepositAddressSchema>;
export type UserAddressAssignment = typeof userAddressAssignments.$inferSelect;
export type InsertUserAddressAssignment = z.infer<typeof insertUserAddressAssignmentSchema>;
