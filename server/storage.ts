import { 
  users, 
  deposits, 
  withdrawals, 
  miningBlocks, 
  systemSettings,
  unclaimedBlocks,
  minerActivity,
  transfers,
  btcStakes,
  btcStakingRewards,
  btcPriceHistory,
  btcConversions,
  devices,
  deviceFingerprints,
  userDevices,
  miningHistory,
  referralCodes,
  referralRewards,
  depositAddresses,
  userAddressAssignments,
  type User, 
  type InsertUser, 
  type Deposit, 
  type InsertDeposit,
  type Withdrawal,
  type InsertWithdrawal,
  type MiningBlock,
  type SystemSetting,
  type UnclaimedBlock,
  type Transfer,
  type MinerActivity,
  type BtcStake,
  type BtcStakingReward,
  type BtcPriceHistory,
  type Device,
  type InsertDevice,
  type DeviceFingerprint,
  type InsertDeviceFingerprint,
  type UserDevice,
  type InsertUserDevice,
  type MiningHistory,
  type InsertMiningHistory,
  type ReferralCode,
  type InsertReferralCode,
  type ReferralReward,
  type InsertReferralReward,
  type DepositAddress,
  type InsertDepositAddress,
  type UserAddressAssignment,
  type InsertUserAddressAssignment
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, gte } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByAccessKey(accessKey: string): Promise<User | undefined>;
  getUsersByReferralCode(referralCode: string): Promise<User[]>;
  findUserByOwnReferralCode(referralCode: string): Promise<User | null>;
  createUser(user: InsertUser): Promise<User>;
  hasIpRegistered(ip: string): Promise<boolean>;
  updateUserBalance(userId: string, usdtBalance: string, hashPower: string, b2bBalance: string, unclaimedBalance: string): Promise<void>;
  updateUser(userId: string, updates: Partial<User>): Promise<void>;
  freezeUser(userId: string): Promise<void>;
  unfreezeUser(userId: string): Promise<void>;
  banUser(userId: string): Promise<void>;
  unbanUser(userId: string): Promise<void>;
  getAllUsers(): Promise<User[]>;
  updateUserBalances(userId: string, balances: { usdtBalance?: string; b2bBalance?: string; hashPower?: string }): Promise<void>;
  
  // Global deposit address methods
  getGlobalDepositAddress(currency: 'USDT' | 'BTC'): Promise<string>;
  setGlobalDepositAddress(currency: 'USDT' | 'BTC', address: string): Promise<void>;
  
  // Deposit methods
  createDeposit(deposit: InsertDeposit & { userId: string }): Promise<Deposit>;
  getPendingDeposits(): Promise<(Deposit & { user: User })[]>;
  approveDeposit(depositId: string, adminNote?: string, actualAmount?: string): Promise<void>;
  rejectDeposit(depositId: string, adminNote?: string): Promise<void>;
  
  // Withdrawal methods
  createWithdrawal(withdrawal: InsertWithdrawal & { userId: string }): Promise<Withdrawal>;
  getPendingWithdrawals(): Promise<any[]>;
  approveWithdrawal(withdrawalId: string, txHash?: string): Promise<void>;
  rejectWithdrawal(withdrawalId: string): Promise<void>;
  
  // Mining methods
  createMiningBlock(blockNumber: number, reward: string, totalHashPower: string, globalHashrate?: string): Promise<MiningBlock>;
  getLatestBlock(): Promise<MiningBlock | undefined>;
  getTotalHashPower(): Promise<string>;
  lockHashratesForBlock(blockNumber: number): Promise<void>;
  getUserMiningStatus(userId: string): Promise<{ personalBlockHeight: number; lastClaimedBlock: number | null; miningActive: boolean; blocksUntilSuspension: number }>;
  checkAndSuspendInactiveMiners(): Promise<void>;
  createMiningHistory(userId: string, blockNumber: number, lockedHashrate: string, reward: string): Promise<MiningHistory>;
  getUserMiningHistory(userId: string, limit?: number): Promise<MiningHistory[]>;
  calculateUserReward(userId: string, blockReward: string): Promise<string>;
  
  // Global index methods for O(1) mining calculations
  getGlobalMiningState(): Promise<{
    totalHashPower: string;
    globalRewardIndex: string;
    currentBlock: number;
    lastIndexUpdate: Date;
  }>;
  updateGlobalIndex(newIndex: string, blockNumber: number): Promise<void>;
  calculateUserPending(userId: string): Promise<string>;
  updateUserHashrate(userId: string, newHashrate: string): Promise<void>;
  getIndexAtBlock(blockNumber: number): Promise<string>;
  settleUserRewards(userId: string): Promise<string>;
  createMiningBlockWithIndex(blockNumber: number, reward: string, totalHashPower: string, cumulativeIndex: string): Promise<MiningBlock>;
  
  // System settings
  getSystemSetting(key: string): Promise<SystemSetting | undefined>;
  setSystemSetting(key: string, value: string): Promise<void>;
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
  
  // Stats
  getUserCount(): Promise<number>;
  getTotalDeposits(): Promise<string>;
  getTotalWithdrawals(): Promise<string>;
  getActiveMinerCount(): Promise<number>;
  
  // Unclaimed blocks
  createUnclaimedBlock(userId: string, blockNumber: number, txHash: string, reward: string): Promise<UnclaimedBlock>;
  getUnclaimedBlocks(userId: string): Promise<any[]>;
  claimBlock(blockId: string, userId: string): Promise<{ success: boolean; reward?: string; suspended?: boolean }>;
  claimAllBlocks(userId: string): Promise<{ count: number; totalReward: string; suspended?: boolean }>;
  
  // Transfers
  createTransfer(fromUserId: string, toUsername: string, amount: string): Promise<any>;
  
  // Miner activity
  getMinersStatus(): Promise<any[]>;
  updateMinerActivity(userId: string, claimed: boolean): Promise<void>;
  
  // Transaction fetching methods
  getUserDeposits(userId: string): Promise<Deposit[]>;
  getUserWithdrawals(userId: string): Promise<Withdrawal[]>;
  getSentTransfers(userId: string): Promise<Transfer[]>;
  getReceivedTransfers(userId: string): Promise<Transfer[]>;
  getAllTransactions(): Promise<any[]>;
  getAllDeposits(): Promise<(Deposit & { user?: User })[]>;
  getAllWithdrawals(): Promise<(Withdrawal & { user?: User })[]>;
  
  // Cooldown methods
  getDepositCooldown(userId: string): Promise<{ canDeposit: boolean; hoursRemaining: number }>;
  getWithdrawalCooldown(userId: string): Promise<{ canWithdraw: boolean; hoursRemaining: number }>;
  
  // Supply tracking methods
  getTotalMinedSupply(): Promise<string>;
  getCirculatingSupply(): Promise<string>;
  getSupplyMetrics(): Promise<{
    totalMined: string;
    circulating: string;
    maxSupply: string;
    percentageMined: string;
    currentBlockReward: string;
    totalBlocks: number;
    halvingProgress: { current: number; nextHalving: number; blocksRemaining: number };
  }>;
  
  // Conversion tracking
  createBtcConversion(userId: string, fromCurrency: string, toCurrency: string, fromAmount: string, toAmount: string, fee: string, rate: string): Promise<any>;
  getUserBtcConversions(userId: string): Promise<any[]>;
  
  // BTC Staking operations
  createBtcStake(userId: string, btcAmount: string, b2bHashrate: string, btcPrice: string, months?: number, apr?: number): Promise<any>;
  getUserBtcStakes(userId: string): Promise<any[]>;
  getActiveBtcStakes(): Promise<any[]>;
  processDailyBtcRewards(): Promise<void>;
  getCurrentBtcPrice(): Promise<string>;
  updateBtcPrice(price: string, source?: string): Promise<void>;
  getSystemHashratePrice(): Promise<string>; // Price of 1 GH/s in BTC
  getUserBtcBalance(userId: string): Promise<string>;
  updateUserBtcBalance(userId: string, btcBalance: string): Promise<void>;

  // Device Fingerprinting methods
  upsertDevice(deviceData: { 
    serverDeviceId: string; 
    lastIp?: string; 
    asn?: string; 
    fingerprints: InsertDeviceFingerprint 
  }): Promise<{ device: Device; canRegister: boolean }>;
  findMatchingDevice(fingerprints: Omit<InsertDeviceFingerprint, 'deviceId'>): Promise<Device | null>;
  linkUserToDevice(userId: string, deviceId: string): Promise<void>;
  blockDevice(deviceId: string): Promise<void>;
  allowlistDevice(deviceId: string, maxRegistrations?: number): Promise<void>;
  resetDeviceRegistrations(deviceId: string): Promise<void>;
  
  // Referral code methods
  generateReferralCodes(userId: string, count: number): Promise<ReferralCode[]>;
  generateReferralCode(userId: string): Promise<ReferralCode>;
  getUserReferralCodes(userId: string): Promise<ReferralCode[]>;
  getAllReferralCodes(): Promise<ReferralCode[]>;
  getReferralCodeByCode(code: string): Promise<ReferralCode | null>;
  markReferralCodeUsed(code: string, usedBy: string): Promise<void>;
  checkAndGenerateReferralCodes(userId: string, newHashrate: number): Promise<ReferralCode[]>;
  
  // Referral reward methods
  createReferralReward(reward: InsertReferralReward): Promise<ReferralReward>;
  getUserUnclaimedRewards(userId: string): Promise<ReferralReward[]>;
  getUserReferralSlots(userId: string): Promise<any[]>;
  claimReferralRewards(userId: string): Promise<{ usdtClaimed: string; hashClaimed: string; count: number }>;  
  getUserReferralStats(userId: string): Promise<{ totalCodes: number; usedCodes: number; totalUsdtEarned: string; totalHashEarned: string; pendingUsdtRewards: string; pendingHashRewards: string }>;  
  updateReferralRewardsOnPurchase(purchaserId: string, amount: number, hashrate: number): Promise<void>;
  
  // Deposit Address Management methods
  createDepositAddress(address: string): Promise<void>;
  assignDepositAddress(userId: string, currency: 'USDT' | 'BTC', network?: string): Promise<{
    address: string;
    assignedAt: Date;
    expiresAt: Date;
    isNewAssignment: boolean;
  }>;
  getUserAddressAssignment(userId: string, currency: 'USDT' | 'BTC', network?: string): Promise<UserAddressAssignment | null>;
  getRandomAvailableAddress(userId: string): Promise<{ 
    address: string | null; 
    canGetNewAddress: boolean; 
    hoursUntilNewAddress: number; 
  }>;
  releaseAddress(userId: string): Promise<void>;
  getDepositAddresses(): Promise<DepositAddress[]>;
  getAllActiveDepositAddresses(): Promise<DepositAddress[]>;
  bulkCreateAddresses(addresses: string[]): Promise<void>;
  deleteAddress(id: string): Promise<void>;
  updateAddressStatus(id: string, isActive: boolean): Promise<void>;
  
  sessionStore: session.Store;
  
  // Method to fix existing deposits with wrong status
  fixDepositStatuses(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    // Use PostgreSQL session store for persistent sessions across restarts
    this.sessionStore = new PostgresSessionStore({
      pool: pool,
      tableName: 'session'
    });
  }
  
  async fixDepositStatuses(): Promise<void> {
    // Fix any deposits with "approved" status - only update status to "completed"
    // Do NOT re-credit balances here: approveDeposit already credits balances when called.
    // Any deposit stuck in "approved" was already credited at approval time.
    const approvedDeposits = await db
      .select()
      .from(deposits)
      .where(eq(deposits.status, "approved" as any));
    
    for (const deposit of approvedDeposits) {
      // Only update status - balance was already credited during approveDeposit
      await db
        .update(deposits)
        .set({ 
          status: "completed",
          updatedAt: new Date()
        })
        .where(eq(deposits.id, deposit.id));
    }
    
    console.log(`Fixed ${approvedDeposits.length} deposits with incorrect status`);
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }
  

  async getUserByAccessKey(accessKey: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.accessKey, accessKey));
    return user || undefined;
  }

  async getUsersByReferralCode(referralCode: string): Promise<User[]> {
    return await db.select().from(users).where(eq(users.referredBy, referralCode));
  }

  async findUserByOwnReferralCode(referralCode: string): Promise<User | null> {
    const result = await db.select().from(users).where(eq(users.referralCode, referralCode)).limit(1);
    return result[0] || null;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async hasIpRegistered(ip: string): Promise<boolean> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.registrationIp, ip))
      .limit(1);
    return result.length > 0;
  }

  async updateUserBalance(userId: string, usdtBalance: string, hashPower: string, b2bBalance: string, unclaimedBalance: string): Promise<void> {
    await db
      .update(users)
      .set({ 
        usdtBalance, 
        hashPower, 
        b2bBalance, 
        unclaimedBalance 
      })
      .where(eq(users.id, userId));
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<void> {
    await db
      .update(users)
      .set(updates)
      .where(eq(users.id, userId));
  }

  async freezeUser(userId: string): Promise<void> {
    await db
      .update(users)
      .set({ isFrozen: true })
      .where(eq(users.id, userId));
  }

  async unfreezeUser(userId: string): Promise<void> {
    await db
      .update(users)
      .set({ isFrozen: false })
      .where(eq(users.id, userId));
  }

  async banUser(userId: string): Promise<void> {
    await db
      .update(users)
      .set({ isBanned: true })
      .where(eq(users.id, userId));
  }

  async unbanUser(userId: string): Promise<void> {
    await db
      .update(users)
      .set({ isBanned: false })
      .where(eq(users.id, userId));
  }

  async getGlobalDepositAddress(currency: 'USDT' | 'BTC'): Promise<string> {
    const key = `${currency}_DEPOSIT_ADDRESS`;
    const setting = await this.getSystemSetting(key);
    if (currency === 'BTC') {
      return setting?.value || 'bc1qy8zzqsarhp0s63txsfnn3q3nvuu0g83mv3hwrv';
    }
    return setting?.value || 'TBGxYmP3tFrbKvJRvQcF9cENKixQeJdfQc';
  }

  async setGlobalDepositAddress(currency: 'USDT' | 'BTC', address: string): Promise<void> {
    const key = `${currency}_DEPOSIT_ADDRESS`;
    await this.setSystemSetting(key, address);
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async updateUserBalances(userId: string, balances: { usdtBalance?: string; b2bBalance?: string; hashPower?: string }): Promise<void> {
    const updates: any = {};
    if (balances.usdtBalance !== undefined) updates.usdtBalance = balances.usdtBalance;
    if (balances.b2bBalance !== undefined) updates.b2bBalance = balances.b2bBalance;
    if (balances.hashPower !== undefined) updates.hashPower = balances.hashPower;
    
    await db
      .update(users)
      .set(updates)
      .where(eq(users.id, userId));
  }

  async createDeposit(deposit: InsertDeposit & { userId: string }): Promise<Deposit> {
    const [newDeposit] = await db
      .insert(deposits)
      .values(deposit)
      .returning();
    return newDeposit;
  }

  async getPendingDeposits(): Promise<(Deposit & { user: User })[]> {
    const result = await db
      .select()
      .from(deposits)
      .innerJoin(users, eq(deposits.userId, users.id))
      .where(eq(deposits.status, "pending"))
      .orderBy(desc(deposits.createdAt));
    
    return result.map(row => ({
      ...row.deposits,
      user: row.users
    }));
  }

  async approveDeposit(depositId: string, adminNote?: string, actualAmount?: string): Promise<void> {
    // Get the deposit first
    const [deposit] = await db
      .select()
      .from(deposits)
      .where(eq(deposits.id, depositId));
    
    if (!deposit) throw new Error("Deposit not found");
    
    // Use actualAmount if provided (admin verified amount), otherwise use original amount
    const amountToCredit = actualAmount || deposit.amount;
    
    // Update deposit status and amount if actualAmount provided
    await db
      .update(deposits)
      .set({ 
        status: "completed", 
        adminNote, 
        amount: amountToCredit,
        updatedAt: new Date() 
      })
      .where(eq(deposits.id, depositId));
    
    // Update user balance with the verified amount
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, deposit.userId));
    
    if (user) {
      // Update USDT balance for all deposits (BTC mining platform supports USDT deposits only)
      const newBalance = (parseFloat(user.usdtBalance || "0") + parseFloat(amountToCredit)).toFixed(2);
      await db
        .update(users)
        .set({ usdtBalance: newBalance })
        .where(eq(users.id, deposit.userId));
        
      // Check if this user was referred and credit commission to referrer
      if (user.referredBy) {
        const referrer = await this.findUserByOwnReferralCode(user.referredBy);
        if (referrer) {
          // Calculate 10% commission on the deposit
          const commission = (parseFloat(amountToCredit) * 0.10).toFixed(2);
          
          // Update referrer's total earnings and USDT balance
          const newReferrerUsdtBalance = (parseFloat(referrer.usdtBalance || "0") + parseFloat(commission)).toFixed(2);
          const newTotalEarnings = (parseFloat(referrer.totalReferralEarnings || "0") + parseFloat(commission)).toFixed(2);
          
          await db
            .update(users)
            .set({ 
              usdtBalance: newReferrerUsdtBalance,
              totalReferralEarnings: newTotalEarnings
            })
            .where(eq(users.id, referrer.id));
            
          // Create referral reward record (mark as claimed since we credited immediately)
          const reward = await this.createReferralReward({
            referrerId: referrer.id,
            referredUserId: user.id,
            usdtReward: commission,
            hashReward: "0",
            purchaseAmount: amountToCredit,
            purchaseHashrate: "0"
          });
          
          // Mark as claimed immediately
          await db.update(referralRewards)
            .set({ isClaimed: true, claimedAt: new Date() })
            .where(eq(referralRewards.id, reward.id));
        }
      }
    }
  }

  async rejectDeposit(depositId: string, adminNote?: string): Promise<void> {
    await db
      .update(deposits)
      .set({ status: "rejected", adminNote, updatedAt: new Date() })
      .where(eq(deposits.id, depositId));
  }

  async createWithdrawal(withdrawal: InsertWithdrawal & { userId: string }): Promise<Withdrawal> {
    const [newWithdrawal] = await db
      .insert(withdrawals)
      .values({
        ...withdrawal,
        status: 'pending' // All withdrawals start as pending
      })
      .returning();
    return newWithdrawal;
  }

  async getPendingWithdrawals(): Promise<any[]> {
    const result = await db
      .select({
        id: withdrawals.id,
        userId: withdrawals.userId,
        amount: withdrawals.amount,
        address: withdrawals.address,
        network: withdrawals.network,
        status: withdrawals.status,
        txHash: withdrawals.txHash,
        createdAt: withdrawals.createdAt,
        user: users
      })
      .from(withdrawals)
      .innerJoin(users, eq(withdrawals.userId, users.id))
      .where(eq(withdrawals.status, "pending"))
      .orderBy(desc(withdrawals.createdAt));
    
    return result;
  }

  async approveWithdrawal(withdrawalId: string, txHash?: string): Promise<void> {
    // Get the withdrawal details first
    const [withdrawal] = await db
      .select()
      .from(withdrawals)
      .where(eq(withdrawals.id, withdrawalId));
    
    if (!withdrawal) {
      throw new Error("Withdrawal not found");
    }

    // Get the user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, withdrawal.userId));
    
    if (!user) {
      throw new Error("User not found");
    }

    const amount = parseFloat(withdrawal.amount);
    const isUSDT = withdrawal.network === 'ERC20' || withdrawal.network === 'BSC' || withdrawal.network === 'TRC20';

    // Check balance and deduct
    if (isUSDT) {
      const usdtBalance = parseFloat(user.usdtBalance || "0");
      if (usdtBalance < amount) {
        throw new Error("Insufficient USDT balance");
      }
      const newBalance = (usdtBalance - amount).toFixed(2);
      await db.update(users)
        .set({ usdtBalance: newBalance })
        .where(eq(users.id, user.id));
    } else {
      const b2bBalance = parseFloat(user.b2bBalance || "0");
      if (b2bBalance < amount) {
        throw new Error("Insufficient B2B balance");
      }
      const newBalance = (b2bBalance - amount).toFixed(8);
      await db.update(users)
        .set({ b2bBalance: newBalance })
        .where(eq(users.id, user.id));
    }

    // Update withdrawal status
    await db.update(withdrawals)
      .set({ 
        status: "completed",
        txHash: txHash || null
      })
      .where(eq(withdrawals.id, withdrawalId));
  }

  async rejectWithdrawal(withdrawalId: string): Promise<void> {
    await db.update(withdrawals)
      .set({ status: "rejected" })
      .where(eq(withdrawals.id, withdrawalId));
  }

  async getGlobalMiningState(): Promise<{
    totalHashPower: string;
    globalRewardIndex: string;
    currentBlock: number;
    lastIndexUpdate: Date;
  }> {
    // Try to get from systemSettings table first
    const [settings] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, 'global_mining_state'))
      .limit(1);
    
    if (settings) {
      const state = JSON.parse(settings.value);
      return {
        totalHashPower: state.totalHashPower || "0",
        globalRewardIndex: state.globalRewardIndex || "0",
        currentBlock: state.currentBlock || 0,
        lastIndexUpdate: new Date(state.lastIndexUpdate || Date.now())
      };
    }
    
    // Default state
    return {
      totalHashPower: "0",
      globalRewardIndex: "0",
      currentBlock: 0,
      lastIndexUpdate: new Date()
    };
  }

  async updateGlobalIndex(newIndex: string, blockNumber: number): Promise<void> {
    const state = {
      globalRewardIndex: newIndex,
      currentBlock: blockNumber,
      lastIndexUpdate: new Date()
    };
    
    await db
      .insert(systemSettings)
      .values({
        key: 'global_mining_state',
        value: JSON.stringify(state)
      })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { 
          value: JSON.stringify(state),
          updatedAt: new Date()
        }
      });
  }

  async calculateUserPending(userId: string): Promise<string> {
    const user = await this.getUser(userId);
    if (!user) return "0";
    
    const globalState = await this.getGlobalMiningState();
    
    // Get user's locked hash power (mining power)
    const userHashPower = parseFloat(user.lockedHashPower || "0");
    if (userHashPower === 0) return "0";
    
    // Calculate effective index (cap at suspension block if suspended)
    let effectiveIndex = parseFloat(globalState.globalRewardIndex);
    if (user.miningSuspended && user.suspensionAtBlock) {
      const suspensionIndex = await this.getIndexAtBlock(user.suspensionAtBlock);
      effectiveIndex = Math.min(effectiveIndex, parseFloat(suspensionIndex));
    }
    
    // Calculate pending rewards using the index difference
    const userIndex = parseFloat(user.userIndex || "0");
    const indexDiff = effectiveIndex - userIndex;
    const newRewards = userHashPower * indexDiff;
    const accruedPending = parseFloat(user.accruedPending || "0");
    const totalPending = accruedPending + newRewards;
    
    return totalPending.toString();
  }

  async updateUserHashrate(userId: string, newHashrate: string): Promise<void> {
    await db.transaction(async (tx) => {
      const [user] = await tx.select().from(users).where(eq(users.id, userId));
      if (!user) throw new Error("User not found");
      
      const globalState = await this.getGlobalMiningState();
      
      // Step 1: Settle current rewards at old hashrate
      const pending = await this.calculateUserPending(userId);
      
      // Step 2: Calculate hash difference
      const oldHashrate = parseFloat(user.lockedHashPower || "0");
      const newHashrateNum = parseFloat(newHashrate);
      const hashDiff = newHashrateNum - oldHashrate;
      
      // Step 3: Update global hashrate
      const currentGlobalHash = parseFloat(globalState.totalHashPower);
      const newGlobalHash = currentGlobalHash + hashDiff;
      
      // Update global state
      await tx
        .insert(systemSettings)
        .values({
          key: 'global_mining_state',
          value: JSON.stringify({
            ...globalState,
            totalHashPower: newGlobalHash.toString()
          })
        })
        .onConflictDoUpdate({
          target: systemSettings.key,
          set: { 
            value: JSON.stringify({
              ...globalState,
              totalHashPower: newGlobalHash.toString()
            }),
            updatedAt: new Date()
          }
        });
      
      // Update user with new hashrate and settled rewards
      await tx.update(users).set({
        lockedHashPower: newHashrate,
        accruedPending: pending,
        userIndex: globalState.globalRewardIndex
      }).where(eq(users.id, userId));
    });
  }

  async getIndexAtBlock(blockNumber: number): Promise<string> {
    const [block] = await db
      .select()
      .from(miningBlocks)
      .where(eq(miningBlocks.blockNumber, blockNumber))
      .limit(1);
    
    return block?.cumulativeIndex || "0";
  }

  async settleUserRewards(userId: string): Promise<string> {
    const pending = await this.calculateUserPending(userId);
    const globalState = await this.getGlobalMiningState();
    
    await db.update(users).set({
      accruedPending: pending,
      userIndex: globalState.globalRewardIndex
    }).where(eq(users.id, userId));
    
    return pending;
  }

  async createMiningBlockWithIndex(blockNumber: number, reward: string, totalHashPower: string, cumulativeIndex: string): Promise<MiningBlock> {
    const now = new Date();
    const blockStartTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
    const blockEndTime = new Date(blockStartTime.getTime() + 3600000);
    
    const [block] = await db
      .insert(miningBlocks)
      .values({
        blockNumber,
        reward,
        totalHashPower,
        globalHashrate: totalHashPower,
        cumulativeIndex,
        blockStartTime,
        blockEndTime,
        timestamp: now,
      })
      .returning();
    
    return block;
  }

  async createMiningBlock(blockNumber: number, reward: string, totalHashPower: string, globalHashrate?: string): Promise<MiningBlock> {
    const now = new Date();
    const blockStartTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
    const blockEndTime = new Date(blockStartTime.getTime() + 3600000); // Add 1 hour
    
    const [block] = await db
      .insert(miningBlocks)
      .values({ 
        blockNumber, 
        reward, 
        totalHashPower,
        globalHashrate: globalHashrate || totalHashPower,
        blockStartTime,
        blockEndTime
      })
      .returning();
    return block;
  }
  
  async lockHashratesForBlock(blockNumber: number): Promise<void> {
    // Lock hashrates for all active miners
    const activeUsers = await db.select().from(users).where(eq(users.miningActive, true));
    
    for (const user of activeUsers) {
      // Copy nextBlockHashPower to lockedHashPower, or hashPower if nextBlockHashPower is 0
      const hashToLock = parseFloat(user.nextBlockHashPower || '0') > 0 ? user.nextBlockHashPower : (user.hashPower || '0.00');
      
      await db.update(users)
        .set({ 
          lockedHashPower: hashToLock || '0.00',
          nextBlockHashPower: user.hashPower || '0.00' // Current hashPower becomes next block's
        })
        .where(eq(users.id, user.id));
    }
  }
  
  async getUserMiningStatus(userId: string): Promise<{ personalBlockHeight: number; lastClaimedBlock: number | null; miningActive: boolean; blocksUntilSuspension: number }> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      return { personalBlockHeight: 0, lastClaimedBlock: null, miningActive: false, blocksUntilSuspension: 0 };
    }
    
    // Check if user has 24 or more unclaimed blocks and suspend if needed
    if ((user.unclaimedBlocksCount || 0) >= 24 && !user.miningSuspended) {
      await db.update(users).set({
        miningSuspended: true,
        miningActive: false
      }).where(eq(users.id, userId));
      user.miningSuspended = true;
      user.miningActive = false;
    }
    
    const blocksUntilSuspension = Math.max(0, 24 - (user.unclaimedBlocksCount || 0));
      
    return {
      personalBlockHeight: user.personalBlockHeight || 0,
      lastClaimedBlock: user.lastClaimedBlock,
      miningActive: !user.miningSuspended && (user.miningActive || false),
      blocksUntilSuspension
    };
  }
  
  async checkAndSuspendInactiveMiners(): Promise<void> {
    // Find users who haven't claimed in 24 blocks
    const inactiveUsers = await db.select().from(users)
      .where(sql`${users.miningActive} = true AND ${users.lastClaimedBlock} IS NOT NULL AND (${users.personalBlockHeight} - ${users.lastClaimedBlock}) >= 24`);
      
    for (const user of inactiveUsers) {
      await db.update(users)
        .set({ miningActive: false })
        .where(eq(users.id, user.id));
    }
  }
  
  async createMiningHistory(userId: string, blockNumber: number, lockedHashrate: string, reward: string): Promise<MiningHistory> {
    const [history] = await db.insert(miningHistory).values({
      userId,
      blockNumber,
      lockedHashrate,
      reward,
    }).returning();
    return history;
  }
  
  async getUserMiningHistory(userId: string, limit: number = 10): Promise<MiningHistory[]> {
    return await db.select()
      .from(miningHistory)
      .where(eq(miningHistory.userId, userId))
      .orderBy(desc(miningHistory.claimedAt))
      .limit(limit);
  }
  
  async calculateUserReward(userId: string, blockReward: string): Promise<string> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user || !user.miningActive) return "0";
    
    // Get total locked hashrate for this block
    const activeUsers = await db.select()
      .from(users)
      .where(eq(users.miningActive, true));
      
    const totalLockedHashrate = activeUsers.reduce((sum, u) => {
      return sum + parseFloat(u.lockedHashPower || '0');
    }, 0);
    
    if (totalLockedHashrate === 0) return "0";
    
    const userLockedHashrate = parseFloat(user.lockedHashPower || '0');
    let reward = (userLockedHashrate / totalLockedHashrate) * parseFloat(blockReward);
    
    // Check for referral bonus if user was referred
    if (user.referredBy) {
      const referrer = await this.findUserByOwnReferralCode(user.referredBy);
      if (referrer) {
        // Give 5% bonus to referred user's mining reward
        const miningBonus = reward * 0.05;
        reward = reward + miningBonus;
        
        // Give 10% commission to referrer from base reward (not from bonus)
        const originalReward = (userLockedHashrate / totalLockedHashrate) * parseFloat(blockReward);
        const referrerCommission = originalReward * 0.10;
        
        // Update referrer's unclaimed balance and total earnings
        const newUnclaimedBalance = (parseFloat(referrer.unclaimedBalance || "0") + referrerCommission).toFixed(8);
        const newTotalEarnings = (parseFloat(referrer.totalReferralEarnings || "0") + referrerCommission).toFixed(8);
        
        await db
          .update(users)
          .set({ 
            unclaimedBalance: newUnclaimedBalance,
            totalReferralEarnings: newTotalEarnings
          })
          .where(eq(users.id, referrer.id));
          
        // Create referral reward record for mining commission (isClaimed defaults to false)
        await this.createReferralReward({
          referrerId: referrer.id,
          referredUserId: userId,
          usdtReward: "0",
          hashReward: "0", 
          purchaseAmount: "0",
          purchaseHashrate: "0"
        });
      }
    }
    
    return reward.toFixed(8);
  }

  async getLatestBlock(): Promise<MiningBlock | undefined> {
    const [block] = await db
      .select()
      .from(miningBlocks)
      .orderBy(desc(miningBlocks.blockNumber))
      .limit(1);
    return block || undefined;
  }

  async getTotalHashPower(): Promise<string> {
    const [result] = await db
      .select({ total: sql<string>`COALESCE(SUM(${users.hashPower}), 0)` })
      .from(users);
    return result?.total || "0";
  }

  async getSystemSetting(key: string): Promise<SystemSetting | undefined> {
    const [setting] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, key));
    return setting || undefined;
  }

  async setSystemSetting(key: string, value: string): Promise<void> {
    await db
      .insert(systemSettings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value, updatedAt: new Date() }
      });
  }

  async getUserCount(): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(users);
    return result?.count || 0;
  }

  async getTotalDeposits(): Promise<string> {
    const [result] = await db
      .select({ total: sql<string>`COALESCE(SUM(${deposits.amount}), 0)` })
      .from(deposits)
      .where(eq(deposits.status, "completed"));
    return result?.total || "0";
  }

  async getTotalWithdrawals(): Promise<string> {
    const [result] = await db
      .select({ total: sql<string>`COALESCE(SUM(${withdrawals.amount}), 0)` })
      .from(withdrawals)
      .where(eq(withdrawals.status, "completed"));
    return result?.total || "0";
  }
  
  async createUnclaimedBlock(userId: string, blockNumber: number, txHash: string, reward: string): Promise<UnclaimedBlock> {
    // No expiry - rewards are permanent
    const [block] = await db.insert(unclaimedBlocks).values({
      userId,
      blockNumber,
      txHash,
      reward,
      expiresAt: null // Made nullable - rewards never expire
    }).returning();
    
    // Increment user's unclaimed blocks counter
    const user = await this.getUser(userId);
    if (user) {
      const newUnclaimedCount = (user.unclaimedBlocksCount || 0) + 1;
      const updates: any = {
        unclaimedBlocksCount: newUnclaimedCount
      };
      
      // Check if should suspend mining
      if (newUnclaimedCount >= 24) {
        updates.miningSuspended = true;
      }
      
      await db.update(users)
        .set(updates)
        .where(eq(users.id, userId));
    }
    
    return block;
  }
  
  async getUnclaimedBlocks(userId: string): Promise<UnclaimedBlock[]> {
    // No expiry check - rewards are permanent
    return await db.select()
      .from(unclaimedBlocks)
      .where(sql`${unclaimedBlocks.userId} = ${userId} AND ${unclaimedBlocks.claimed} = false`)
      .orderBy(desc(unclaimedBlocks.createdAt));
  }
  
  async claimBlock(blockId: string, userId: string): Promise<{ success: boolean; reward?: string; suspended?: boolean }> {
    // No expiry check - rewards are permanent
    const [block] = await db.select()
      .from(unclaimedBlocks)
      .where(sql`${unclaimedBlocks.id} = ${blockId} AND ${unclaimedBlocks.userId} = ${userId} AND ${unclaimedBlocks.claimed} = false`);
    
    if (!block) {
      return { success: false };
    }
    
    // Get user
    const user = await this.getUser(userId);
    if (!user) {
      return { success: false };
    }
    
    const wasSuspended = user.miningSuspended || false;
    
    await db.update(unclaimedBlocks)
      .set({ claimed: true, claimedAt: new Date() })
      .where(eq(unclaimedBlocks.id, blockId));
    
    // Update user - decrement unclaimed counter
    const newUnclaimedCount = Math.max(0, (user.unclaimedBlocksCount || 0) - 1);
    const updates: any = {
      b2bBalance: (parseFloat(user.b2bBalance || "0") + parseFloat(block.reward)).toFixed(8),
      lastClaimedBlock: block.blockNumber,
      lastActivityTime: new Date(),
      unclaimedBlocksCount: newUnclaimedCount
    };
    
    // Reset suspension if all blocks claimed
    if (newUnclaimedCount === 0) {
      updates.miningSuspended = false;
      updates.miningActive = true;
    }
    
    await db.update(users)
      .set(updates)
      .where(eq(users.id, userId));
    
    await this.updateMinerActivity(userId, true);
    
    return { success: true, reward: block.reward, suspended: wasSuspended };
  }
  
  async claimAllBlocks(userId: string): Promise<{ count: number; totalReward: string; suspended?: boolean }> {
    // No expiry check - rewards are permanent
    const blocks = await db.select()
      .from(unclaimedBlocks)
      .where(sql`${unclaimedBlocks.userId} = ${userId} AND ${unclaimedBlocks.claimed} = false`);
    
    if (blocks.length === 0) {
      return { count: 0, totalReward: '0' };
    }
    
    // Calculate total reward
    let totalReward = 0;
    for (const block of blocks) {
      totalReward += parseFloat(block.reward);
    }
    
    // Mark all blocks as claimed - no expiry check
    await db.update(unclaimedBlocks)
      .set({ claimed: true, claimedAt: new Date() })
      .where(sql`${unclaimedBlocks.userId} = ${userId} AND ${unclaimedBlocks.claimed} = false`);
    
    // Update user balance
    const user = await this.getUser(userId);
    let wasSuspended = false;
    
    if (user) {
      const newBalance = (parseFloat(user.b2bBalance || "0") + totalReward).toFixed(8);
      wasSuspended = user.miningSuspended || false;
      
      // Reset unclaimed counter and suspension since all blocks are claimed
      const maxBlockNumber = blocks.length > 0 ? Math.max(...blocks.map(b => b.blockNumber)) : null;
      const updates: any = {
        b2bBalance: newBalance,
        lastClaimedBlock: maxBlockNumber,
        lastActivityTime: new Date(),
        unclaimedBlocksCount: 0, // Reset to 0 since all blocks claimed
        miningSuspended: false, // Reset suspension
        miningActive: true // Reactivate mining
      };
      
      await db.update(users)
        .set(updates)
        .where(eq(users.id, userId));
        
      await this.updateMinerActivity(userId, true);
    }
    
    return { 
      count: blocks.length, 
      totalReward: totalReward.toFixed(8),
      suspended: wasSuspended
    };
  }
  
  // Removed expireOldBlocks method - rewards never expire
  
  async createTransfer(fromUserId: string, toUsername: string, amount: string): Promise<Transfer> {
    const toUser = await this.getUserByUsername(toUsername);
    if (!toUser) {
      throw new Error('Recipient not found');
    }
    
    const fromUser = await this.getUser(fromUserId);
    if (!fromUser) {
      throw new Error('Sender not found');
    }
    
    const senderBalance = parseFloat(fromUser.b2bBalance || "0");
    if (senderBalance < parseFloat(amount)) {
      throw new Error('Insufficient balance');
    }
    
    await db.update(users)
      .set({ b2bBalance: (senderBalance - parseFloat(amount)).toFixed(8) })
      .where(eq(users.id, fromUserId));
    
    await db.update(users)
      .set({ b2bBalance: (parseFloat(toUser.b2bBalance || "0") + parseFloat(amount)).toFixed(8) })
      .where(eq(users.id, toUser.id));
    
    const txHash = '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
    const [transfer] = await db.insert(transfers).values({
      fromUserId,
      toUserId: toUser.id,
      amount,
      txHash
    }).returning();
    
    return transfer;
  }
  
  async updateMinerActivity(userId: string, claimed: boolean): Promise<void> {
    const [activity] = await db.select()
      .from(minerActivity)
      .where(eq(minerActivity.userId, userId));
    
    if (!activity) {
      await db.insert(minerActivity).values({
        userId,
        lastClaimTime: claimed ? new Date() : null,
        totalClaims: claimed ? 1 : 0,
        missedClaims: claimed ? 0 : 1,
        isActive: claimed
      });
    } else {
      const now = new Date();
      const lastClaim = activity.lastClaimTime ? new Date(activity.lastClaimTime) : null;
      const hoursSinceLastClaim = lastClaim ? (now.getTime() - lastClaim.getTime()) / (1000 * 60 * 60) : 999;
      
      await db.update(minerActivity)
        .set({
          lastClaimTime: claimed ? now : activity.lastClaimTime,
          totalClaims: claimed ? (activity.totalClaims || 0) + 1 : (activity.totalClaims || 0),
          missedClaims: claimed ? (activity.missedClaims || 0) : (activity.missedClaims || 0) + 1,
          isActive: hoursSinceLastClaim < 48,
          updatedAt: now
        })
        .where(eq(minerActivity.userId, userId));
    }
  }
  
  async getMinersStatus(): Promise<(MinerActivity & { user: User })[]> {
    const result = await db.select({
      minerActivity,
      user: users
    })
    .from(minerActivity)
    .leftJoin(users, eq(minerActivity.userId, users.id));
    
    return result.map(r => ({
      ...r.minerActivity,
      user: r.user!
    }));
  }
  
  async getActiveMinerCount(): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(minerActivity)
      .where(eq(minerActivity.isActive, true));
    return result?.count || 0;
  }
  
  async getUserDeposits(userId: string): Promise<Deposit[]> {
    return await db
      .select()
      .from(deposits)
      .where(eq(deposits.userId, userId))
      .orderBy(desc(deposits.createdAt));
  }
  
  async getUserWithdrawals(userId: string): Promise<Withdrawal[]> {
    return await db
      .select()
      .from(withdrawals)
      .where(eq(withdrawals.userId, userId))
      .orderBy(desc(withdrawals.createdAt));
  }
  
  async getAllDeposits(): Promise<(Deposit & { user?: User })[]> {
    const result = await db
      .select()
      .from(deposits)
      .leftJoin(users, eq(deposits.userId, users.id))
      .orderBy(desc(deposits.createdAt));
    
    return result.map(row => ({
      ...row.deposits,
      user: row.users || undefined
    }));
  }
  
  async getAllWithdrawals(): Promise<(Withdrawal & { user?: User })[]> {
    const result = await db
      .select()
      .from(withdrawals)
      .leftJoin(users, eq(withdrawals.userId, users.id))
      .orderBy(desc(withdrawals.createdAt));
    
    return result.map(row => ({
      ...row.withdrawals,
      user: row.users || undefined,
      currency: row.withdrawals.currency || (row.withdrawals.network === 'BTC' ? 'BTC' : 
                 row.withdrawals.network === 'B2B' ? 'B2B' : 'USDT'),
      type: 'withdrawal' as const
    }));
  }
  
  async getSentTransfers(userId: string): Promise<Transfer[]> {
    const result = await db
      .select({
        transfer: transfers,
        toUser: users
      })
      .from(transfers)
      .leftJoin(users, eq(transfers.toUserId, users.id))
      .where(eq(transfers.fromUserId, userId))
      .orderBy(desc(transfers.createdAt));
    
    return result.map(r => ({
      ...r.transfer,
      toUsername: r.toUser?.username || 'Unknown'
    }));
  }
  
  async getReceivedTransfers(userId: string): Promise<Transfer[]> {
    const result = await db
      .select({
        transfer: transfers,
        fromUser: users
      })
      .from(transfers)
      .leftJoin(users, eq(transfers.fromUserId, users.id))
      .where(eq(transfers.toUserId, userId))
      .orderBy(desc(transfers.createdAt));
    
    return result.map(r => ({
      ...r.transfer,
      fromUsername: r.fromUser?.username || 'Unknown'
    }));
  }
  
  // For database storage, we'll return no cooldown for now (could be extended later)
  async getDepositCooldown(userId: string): Promise<{ canDeposit: boolean; hoursRemaining: number }> {
    return { canDeposit: true, hoursRemaining: 0 };
  }
  
  async getWithdrawalCooldown(userId: string): Promise<{ canWithdraw: boolean; hoursRemaining: number }> {
    return { canWithdraw: true, hoursRemaining: 0 };
  }
  
  // Supply tracking methods implementation
  async getTotalMinedSupply(): Promise<string> {
    try {
      // Get all mined blocks to calculate total mined supply
      const blocks = await db.select().from(miningBlocks);
      const totalMined = blocks.reduce((sum, block) => {
        return sum + parseFloat(block.reward || "0");
      }, 0);
      return totalMined.toFixed(8);
    } catch (error) {
      console.error("Error getting total mined supply:", error);
      return "0";
    }
  }
  
  async getCirculatingSupply(): Promise<string> {
    try {
      // Circulating supply = All B2B in user wallets (not unclaimed)
      const allUsers = await db.select().from(users);
      const circulatingSupply = allUsers.reduce((sum, user) => {
        return sum + parseFloat(user.b2bBalance || "0");
      }, 0);
      return circulatingSupply.toFixed(8);
    } catch (error) {
      console.error("Error getting circulating supply:", error);
      return "0";
    }
  }
  
  async getSupplyMetrics(): Promise<{
    totalMined: string;
    circulating: string;
    maxSupply: string;
    percentageMined: string;
    currentBlockReward: string;
    totalBlocks: number;
    halvingProgress: { current: number; nextHalving: number; blocksRemaining: number };
  }> {
    try {
      const MAX_SUPPLY = 21000000; // 21M B2B max supply
      const HALVING_INTERVAL = 2160; // Blocks between halvings (3 months: 24 blocks/day × 90 days)
      
      // Get total mined supply
      const totalMined = await this.getTotalMinedSupply();
      
      // Get circulating supply
      const circulating = await this.getCirculatingSupply();
      
      // Get current block reward
      const blockRewardSetting = await this.getSystemSetting("blockReward");
      const currentBlockReward = blockRewardSetting ? blockRewardSetting.value : "3200";
      
      // Get total blocks mined
      const totalBlockHeightSetting = await this.getSystemSetting("totalBlockHeight");
      const totalBlocks = totalBlockHeightSetting ? parseInt(totalBlockHeightSetting.value) : 0;
      
      // Calculate halving progress
      const currentHalvingPeriod = Math.floor(totalBlocks / HALVING_INTERVAL);
      const nextHalving = (currentHalvingPeriod + 1) * HALVING_INTERVAL;
      const blocksRemaining = nextHalving - totalBlocks;
      
      // Calculate percentage mined
      const percentageMined = ((parseFloat(totalMined) / MAX_SUPPLY) * 100).toFixed(2);
      
      return {
        totalMined,
        circulating,
        maxSupply: MAX_SUPPLY.toString(),
        percentageMined,
        currentBlockReward,
        totalBlocks,
        halvingProgress: {
          current: currentHalvingPeriod,
          nextHalving,
          blocksRemaining
        }
      };
    } catch (error) {
      console.error("Error getting supply metrics:", error);
      return {
        totalMined: "0",
        circulating: "0",
        maxSupply: "21000000",
        percentageMined: "0",
        currentBlockReward: "3200",
        totalBlocks: 0,
        halvingProgress: { current: 0, nextHalving: 2160, blocksRemaining: 2160 }
      };
    }
  }
  
  async createBtcConversion(userId: string, fromCurrency: string, toCurrency: string, fromAmount: string, toAmount: string, fee: string, rate: string): Promise<any> {
    const [conversion] = await db.insert(btcConversions).values({
      userId,
      fromCurrency,
      toCurrency,
      fromAmount,
      toAmount,
      fee,
      rate,
    }).returning();
    return conversion;
  }
  
  async getUserBtcConversions(userId: string): Promise<any[]> {
    return db.select().from(btcConversions).where(eq(btcConversions.userId, userId)).orderBy(desc(btcConversions.createdAt));
  }

  // BTC Staking methods
  async createBtcStake(userId: string, btcAmount: string, b2bHashrate: string, btcPrice: string, months: number = 12, apr: number = 20): Promise<any> {
    const dailyReward = (parseFloat(btcAmount) * apr / 100 / 365).toFixed(8); // Dynamic APR daily
    const unlockAt = new Date();
    unlockAt.setMonth(unlockAt.getMonth() + months); // Dynamic lock period

    const [stake] = await db.insert(btcStakes).values({
      userId,
      btcAmount,
      b2bHashrate,
      btcPriceAtStake: btcPrice,
      dailyReward,
      unlockAt,
    }).returning();

    return stake;
  }

  async getUserBtcStakes(userId: string): Promise<any[]> {
    const stakes = await db
      .select()
      .from(btcStakes)
      .where(eq(btcStakes.userId, userId))
      .orderBy(desc(btcStakes.stakedAt));

    return stakes;
  }

  async getActiveBtcStakes(): Promise<any[]> {
    const stakes = await db
      .select()
      .from(btcStakes)
      .where(eq(btcStakes.status, 'active'));

    return stakes;
  }

  async processDailyBtcRewards(): Promise<void> {
    const activeStakes = await this.getActiveBtcStakes();
    const currentBtcPrice = await this.getCurrentBtcPrice();

    for (const stake of activeStakes) {
      // Pay daily reward
      await db.insert(btcStakingRewards).values({
        stakeId: stake.id,
        userId: stake.userId,
        rewardAmount: stake.dailyReward,
        btcPrice: currentBtcPrice,
      });

      // Update user BTC balance
      const user = await this.getUser(stake.userId);
      if (user) {
        const newBtcBalance = (parseFloat(user.btcBalance || '0') + parseFloat(stake.dailyReward)).toFixed(8);
        await this.updateUserBtcBalance(stake.userId, newBtcBalance);
      }

      // Update stake's total rewards paid and last reward time
      await db
        .update(btcStakes)
        .set({
          totalRewardsPaid: (parseFloat(stake.totalRewardsPaid) + parseFloat(stake.dailyReward)).toFixed(8),
          lastRewardAt: new Date(),
        })
        .where(eq(btcStakes.id, stake.id));
    }
  }

  async getCurrentBtcPrice(): Promise<string> {
    // Get latest BTC price from history
    const [latestPrice] = await db
      .select()
      .from(btcPriceHistory)
      .orderBy(desc(btcPriceHistory.timestamp))
      .limit(1);

    if (latestPrice) {
      return latestPrice.price;
    }

    // If no price history, fetch from API
    const price = await fetchRealBtcPrice();
    await this.updateBtcPrice(price, 'api');
    return price;
  }

  async updateBtcPrice(price: string, source: string = 'system'): Promise<void> {
    await db.insert(btcPriceHistory).values({
      price,
      source,
    });
  }

  async getSystemHashratePrice(): Promise<string> {
    // Calculate price of 1 GH/s based on BTC price
    const btcPrice = await this.getCurrentBtcPrice();
    // 1 BTC worth of hashrate = btcPrice / 1000 (assuming 1000 GH/s = 1 BTC equivalent)
    const pricePerGH = (parseFloat(btcPrice) / 1000).toFixed(8);
    return pricePerGH;
  }

  async getUserBtcBalance(userId: string): Promise<string> {
    const user = await this.getUser(userId);
    return user?.btcBalance || '0.00000000';
  }

  async updateUserBtcBalance(userId: string, btcBalance: string): Promise<void> {
    await db
      .update(users)
      .set({ btcBalance })
      .where(eq(users.id, userId));
  }

  // Device Fingerprinting methods
  async upsertDevice(deviceData: { 
    serverDeviceId: string; 
    lastIp?: string; 
    asn?: string; 
    fingerprints: InsertDeviceFingerprint 
  }): Promise<{ device: Device; canRegister: boolean }> {
    const { serverDeviceId, lastIp, asn, fingerprints } = deviceData;
    
    // Check if device already exists
    let [device] = await db
      .select()
      .from(devices)
      .where(eq(devices.serverDeviceId, serverDeviceId));

    if (!device) {
      // Check for matching fingerprints first
      const matchingDevice = await this.findMatchingDevice(fingerprints);
      
      if (matchingDevice) {
        // Update existing device with new serverDeviceId
        await db
          .update(devices)
          .set({ 
            serverDeviceId, 
            lastSeen: new Date(),
            lastIp: lastIp || null,
            asn: asn || null
          })
          .where(eq(devices.id, matchingDevice.id));
        
        device = { ...matchingDevice, serverDeviceId, lastSeen: new Date(), lastIp: lastIp || null, asn: asn || null };
      } else {
        // Create new device
        [device] = await db
          .insert(devices)
          .values({
            serverDeviceId,
            lastIp: lastIp || null,
            asn: asn || null,
          })
          .returning();
      }

      // Add fingerprints
      await db
        .insert(deviceFingerprints)
        .values({
          ...fingerprints,
          deviceId: device.id,
        });
    } else {
      // Update existing device
      await db
        .update(devices)
        .set({ 
          lastSeen: new Date(),
          lastIp: lastIp || null,
          asn: asn || null
        })
        .where(eq(devices.id, device.id));
    }

    const canRegister = !device.blocked && device.registrations === 0;
    return { device, canRegister };
  }

  async findMatchingDevice(fingerprints: Omit<InsertDeviceFingerprint, 'deviceId'>): Promise<Device | null> {
    // Check for exact stable hash match (highest confidence)
    if (fingerprints.stableHash) {
      const exactMatch = await db
        .select({ device: devices })
        .from(deviceFingerprints)
        .innerJoin(devices, eq(deviceFingerprints.deviceId, devices.id))
        .where(eq(deviceFingerprints.stableHash, fingerprints.stableHash))
        .limit(1);
      
      if (exactMatch.length > 0) {
        return exactMatch[0].device;
      }
    }

    // Check for WebGL + Fonts combination (high confidence)
    if (fingerprints.webglHash && fingerprints.fontsHash) {
      const webglFontsMatch = await db
        .select({ device: devices })
        .from(deviceFingerprints)
        .innerJoin(devices, eq(deviceFingerprints.deviceId, devices.id))
        .where(sql`${deviceFingerprints.webglHash} = ${fingerprints.webglHash} AND ${deviceFingerprints.fontsHash} = ${fingerprints.fontsHash}`)
        .limit(1);
      
      if (webglFontsMatch.length > 0) {
        return webglFontsMatch[0].device;
      }
    }

    return null;
  }

  async linkUserToDevice(userId: string, deviceId: string): Promise<void> {
    // Check if link already exists
    const existing = await db
      .select()
      .from(userDevices)
      .where(sql`${userDevices.userId} = ${userId} AND ${userDevices.deviceId} = ${deviceId}`)
      .limit(1);

    if (existing.length === 0) {
      await db
        .insert(userDevices)
        .values({ userId, deviceId });
    }

    // Increment device registration count
    await db
      .update(devices)
      .set({ 
        registrations: sql`${devices.registrations} + 1`
      })
      .where(eq(devices.id, deviceId));
  }

  async blockDevice(deviceId: string): Promise<void> {
    await db
      .update(devices)
      .set({ blocked: true })
      .where(eq(devices.id, deviceId));
  }

  async allowlistDevice(deviceId: string, maxRegistrations: number = 2): Promise<void> {
    await db
      .update(devices)
      .set({ 
        blocked: false,
        registrations: 0 // Reset registrations for allowlisted device
      })
      .where(eq(devices.id, deviceId));
  }

  async resetDeviceRegistrations(deviceId: string): Promise<void> {
    await db
      .update(devices)
      .set({ 
        registrations: 0 // Reset registrations to allow new account creation
      })
      .where(eq(devices.serverDeviceId, deviceId));
  }

  // Referral code methods
  async generateReferralCodes(userId: string, count: number): Promise<ReferralCode[]> {
    const codes: ReferralCode[] = [];
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    
    for (let i = 0; i < count; i++) {
      let code = '';
      for (let j = 0; j < 8; j++) {
        code += charset.charAt(Math.floor(Math.random() * charset.length));
      }
      
      const [referralCode] = await db
        .insert(referralCodes)
        .values({ code, ownerId: userId })
        .returning();
      
      codes.push(referralCode);
    }
    
    // Update user's total referral codes count
    const user = await this.getUser(userId);
    if (user) {
      await db
        .update(users)
        .set({ totalReferralCodes: (user.totalReferralCodes || 0) + count })
        .where(eq(users.id, userId));
    }
    
    return codes;
  }

  async getUserReferralCodes(userId: string): Promise<ReferralCode[]> {
    return await db
      .select()
      .from(referralCodes)
      .where(eq(referralCodes.ownerId, userId))
      .orderBy(desc(referralCodes.createdAt));
  }

  async getReferralCodeByCode(code: string): Promise<ReferralCode | null> {
    const [referralCode] = await db
      .select()
      .from(referralCodes)
      .where(eq(referralCodes.code, code))
      .limit(1);
    return referralCode || null;
  }

  async markReferralCodeUsed(code: string, usedBy: string): Promise<void> {
    await db
      .update(referralCodes)
      .set({ 
        isUsed: true, 
        usedBy,
        usedAt: new Date()
      })
      .where(eq(referralCodes.code, code));
  }

  async checkAndGenerateReferralCodes(userId: string, newHashrate: number): Promise<ReferralCode[]> {
    const user = await this.getUser(userId);
    if (!user || !user.hasPaidPurchase) return [];
    
    const previousHashrate = parseFloat(user.baseHashPower || '0');
    const currentHashrate = previousHashrate + newHashrate;
    
    // Calculate milestones crossed (each 2000 KH/s)
    const previousMilestones = Math.floor(previousHashrate / 2000);
    const currentMilestones = Math.floor(currentHashrate / 2000);
    const milestonesReached = currentMilestones - previousMilestones;
    
    if (milestonesReached > 0) {
      // Generate 5 codes per milestone
      return await this.generateReferralCodes(userId, milestonesReached * 5);
    }
    
    return [];
  }

  // Referral reward methods
  async createReferralReward(reward: InsertReferralReward): Promise<ReferralReward> {
    const [referralReward] = await db
      .insert(referralRewards)
      .values(reward)
      .returning();
    
    // Update unclaimed rewards for the referrer (new rewards default to unclaimed)
    const referrer = await this.getUser(reward.referrerId);
    if (referrer) {
      await db
        .update(users)
        .set({
          unclaimedReferralUsdt: (parseFloat(referrer.unclaimedReferralUsdt || '0') + parseFloat(reward.usdtReward)).toFixed(2),
          unclaimedReferralHash: (parseFloat(referrer.unclaimedReferralHash || '0') + parseFloat(reward.hashReward)).toFixed(2)
        })
        .where(eq(users.id, reward.referrerId));
    }
    
    return referralReward;
  }

  async getUserUnclaimedRewards(userId: string): Promise<ReferralReward[]> {
    return await db
      .select()
      .from(referralRewards)
      .where(sql`${referralRewards.referrerId} = ${userId} AND ${referralRewards.isClaimed} = false`)
      .orderBy(desc(referralRewards.createdAt));
  }

  async getUserReferralSlots(userId: string): Promise<any[]> {
    const codes = await this.getUserReferralCodes(userId);
    const usedCodes = codes.filter(c => c.isUsed);
    
    const slots = [];
    for (const code of usedCodes) {
      if (!code.usedBy) continue;
      
      const referredUser = await this.getUser(code.usedBy);
      if (!referredUser) continue;
      
      const rewards = await db
        .select()
        .from(referralRewards)
        .where(sql`${referralRewards.referrerId} = ${userId} AND ${referralRewards.referredUserId} = ${code.usedBy}`)
        .orderBy(desc(referralRewards.createdAt));
      
      const pendingRewards = rewards.filter(r => !r.isClaimed);
      const pendingUsdt = pendingRewards.reduce((sum, r) => sum + parseFloat(r.usdtReward), 0);
      const pendingHash = pendingRewards.reduce((sum, r) => sum + parseFloat(r.hashReward), 0);
      
      slots.push({
        code: code.code,
        username: referredUser.username,
        userId: referredUser.id,
        hashPower: referredUser.hashPower,
        isActive: referredUser.hasPaidPurchase || false,
        joinedAt: code.usedAt,
        pendingUsdtRewards: pendingUsdt.toFixed(2),
        pendingHashRewards: pendingHash.toFixed(2),
        totalRewards: rewards.length
      });
    }
    
    return slots;
  }

  async claimReferralRewards(userId: string): Promise<{ usdtClaimed: string; hashClaimed: string; count: number }> {
    const unclaimedRewards = await this.getUserUnclaimedRewards(userId);
    
    if (unclaimedRewards.length === 0) {
      return { usdtClaimed: '0', hashClaimed: '0', count: 0 };
    }
    
    let totalUsdt = 0;
    let totalHash = 0;
    
    // Mark all rewards as claimed
    for (const reward of unclaimedRewards) {
      totalUsdt += parseFloat(reward.usdtReward);
      totalHash += parseFloat(reward.hashReward);
      
      await db
        .update(referralRewards)
        .set({ 
          isClaimed: true, 
          claimedAt: new Date() 
        })
        .where(eq(referralRewards.id, reward.id));
    }
    
    // Update user balances
    const user = await this.getUser(userId);
    if (user) {
      await db
        .update(users)
        .set({
          usdtBalance: (parseFloat(user.usdtBalance || '0') + totalUsdt).toFixed(2),
          hashPower: (parseFloat(user.hashPower || '0') + totalHash).toFixed(2),
          baseHashPower: (parseFloat(user.baseHashPower || '0') + totalHash).toFixed(2),
          totalReferralEarnings: (parseFloat(user.totalReferralEarnings || '0') + totalUsdt).toFixed(2),
          unclaimedReferralUsdt: '0',
          unclaimedReferralHash: '0'
        })
        .where(eq(users.id, userId));
    }
    
    return {
      usdtClaimed: totalUsdt.toFixed(2),
      hashClaimed: totalHash.toFixed(2),
      count: unclaimedRewards.length
    };
  }

  async getUserReferralStats(userId: string): Promise<{ totalCodes: number; usedCodes: number; totalUsdtEarned: string; totalHashEarned: string; pendingUsdtRewards: string; pendingHashRewards: string }> {
    const user = await this.getUser(userId);
    if (!user) {
      return {
        totalCodes: 0,
        usedCodes: 0,
        totalUsdtEarned: '0',
        totalHashEarned: '0',
        pendingUsdtRewards: '0',
        pendingHashRewards: '0'
      };
    }
    
    const codes = await this.getUserReferralCodes(userId);
    const usedCodes = codes.filter(c => c.isUsed).length;
    
    const allRewards = await db
      .select()
      .from(referralRewards)
      .where(eq(referralRewards.referrerId, userId));
    
    const claimedRewards = allRewards.filter(r => r.isClaimed);
    const totalUsdtEarned = claimedRewards.reduce((sum, r) => sum + parseFloat(r.usdtReward), 0);
    const totalHashEarned = claimedRewards.reduce((sum, r) => sum + parseFloat(r.hashReward), 0);
    
    return {
      totalCodes: user.totalReferralCodes || 0,
      usedCodes,
      totalUsdtEarned: totalUsdtEarned.toFixed(2),
      totalHashEarned: totalHashEarned.toFixed(2),
      pendingUsdtRewards: user.unclaimedReferralUsdt || '0',
      pendingHashRewards: user.unclaimedReferralHash || '0'
    };
  }

  async updateReferralRewardsOnPurchase(purchaserId: string, amount: number, hashrate: number): Promise<void> {
    const purchaser = await this.getUser(purchaserId);
    if (!purchaser || !purchaser.referredBy) return;
    
    // Find the referrer
    const referrer = await this.findUserByOwnReferralCode(purchaser.referredBy);
    if (!referrer) return;
    
    // Only create rewards if purchaser has made a paid purchase
    if (purchaser.hasPaidPurchase) {
      // Calculate 10% rewards for USDT and hash power
      const usdtReward = (amount * 0.1).toFixed(2);
      const hashReward = (hashrate * 0.1).toFixed(2);
      
      // Immediately credit USDT commission to referrer's balance
      const newUsdtBalance = (parseFloat(referrer.usdtBalance || "0") + parseFloat(usdtReward)).toFixed(2);
      const newHashPower = (parseFloat(referrer.hashPower || "0") + parseFloat(hashReward)).toFixed(2);
      const newTotalEarnings = (parseFloat(referrer.totalReferralEarnings || "0") + parseFloat(usdtReward)).toFixed(2);
      
      // Update referrer's balances immediately
      await db
        .update(users)
        .set({ 
          usdtBalance: newUsdtBalance,
          hashPower: newHashPower,
          totalReferralEarnings: newTotalEarnings,
          referralHashBonus: (parseFloat(referrer.referralHashBonus || "0") + parseFloat(hashReward)).toFixed(2)
        })
        .where(eq(users.id, referrer.id));
      
      // Create referral reward record for tracking
      const reward = await this.createReferralReward({
        referrerId: referrer.id,
        referredUserId: purchaserId,
        usdtReward,
        hashReward,
        purchaseAmount: amount.toFixed(2),
        purchaseHashrate: hashrate.toFixed(2)
      });
      
      // Mark as claimed immediately since we credited the balances
      await db.update(referralRewards)
        .set({ isClaimed: true, claimedAt: new Date() })
        .where(eq(referralRewards.id, reward.id));
    }
  }

  // Implementation of missing admin methods
  async getSetting(key: string): Promise<string | null> {
    const setting = await this.getSystemSetting(key);
    return setting ? setting.value : null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.setSystemSetting(key, value);
  }

  async getAllTransactions(): Promise<any[]> {
    // Get all deposits
    const allDeposits = await db
      .select({
        id: deposits.id,
        type: sql<string>`'deposit'`,
        userId: deposits.userId,
        username: users.username,
        amount: deposits.amount,
        currency: deposits.currency,
        status: deposits.status,
        txHash: deposits.txHash,
        network: deposits.network,
        createdAt: deposits.createdAt
      })
      .from(deposits)
      .leftJoin(users, eq(deposits.userId, users.id))
      .orderBy(desc(deposits.createdAt));

    // Get all withdrawals
    const allWithdrawals = await db
      .select({
        id: withdrawals.id,
        type: sql<string>`'withdrawal'`,
        userId: withdrawals.userId,
        username: users.username,
        amount: withdrawals.amount,
        currency: sql<string>`CASE WHEN ${withdrawals.network} IN ('ERC20', 'BSC', 'TRC20') THEN 'USDT' ELSE 'B2B' END`,
        status: withdrawals.status,
        txHash: withdrawals.txHash,
        network: withdrawals.network,
        createdAt: withdrawals.createdAt
      })
      .from(withdrawals)
      .leftJoin(users, eq(withdrawals.userId, users.id))
      .orderBy(desc(withdrawals.createdAt));

    // Get all transfers
    const allTransfers = await db
      .select({
        id: transfers.id,
        type: sql<string>`'transfer'`,
        userId: transfers.fromUserId,
        username: users.username,
        amount: transfers.amount,
        currency: sql<string>`'B2B'`,
        status: sql<string>`'completed'`,
        txHash: sql<string>`NULL`,
        network: sql<string>`'internal'`,
        createdAt: transfers.createdAt
      })
      .from(transfers)
      .leftJoin(users, eq(transfers.fromUserId, users.id))
      .orderBy(desc(transfers.createdAt));

    // Combine all transactions and sort by date
    const allTransactions = [...allDeposits, ...allWithdrawals, ...allTransfers]
      .sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

    return allTransactions;
  }

  async generateReferralCode(userId: string): Promise<ReferralCode> {
    // Generate a single referral code using the existing method
    const codes = await this.generateReferralCodes(userId, 1);
    return codes[0];
  }

  async getAllReferralCodes(): Promise<ReferralCode[]> {
    return await db
      .select()
      .from(referralCodes)
      .orderBy(desc(referralCodes.createdAt));
  }

  // Deposit Address Management implementations
  async createDepositAddress(address: string): Promise<void> {
    await db
      .insert(depositAddresses)
      .values({ address, isActive: true });
  }

  async assignDepositAddress(userId: string, currency: 'USDT' | 'BTC', network?: string): Promise<{
    address: string;
    assignedAt: Date;
    expiresAt: Date;
    isNewAssignment: boolean;
  }> {
    const now = new Date();
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Check if user has an existing assignment within 24 hours for this currency+network
    const existingAssignment = await db
      .select()
      .from(userAddressAssignments)
      .where(
        and(
          eq(userAddressAssignments.userId, userId),
          eq(userAddressAssignments.currency, currency),
          network ? eq(userAddressAssignments.network, network) : sql`${userAddressAssignments.network} IS NULL`,
          gte(userAddressAssignments.expiresAt, now)
        )
      )
      .limit(1);

    if (existingAssignment.length > 0) {
      // Return existing assignment that's still valid
      const assignment = existingAssignment[0];
      return {
        address: assignment.address,
        assignedAt: assignment.assignedAt!,
        expiresAt: assignment.expiresAt,
        isNewAssignment: false
      };
    }

    // Get a random available address from the pool
    const availableAddresses = await db
      .select()
      .from(depositAddresses)
      .where(eq(depositAddresses.isActive, true));

    if (availableAddresses.length === 0) {
      throw new Error('No available deposit addresses in the pool');
    }

    // Select a random address
    const randomIndex = Math.floor(Math.random() * availableAddresses.length);
    const selectedAddress = availableAddresses[randomIndex];

    // Create new assignment
    const [newAssignment] = await db
      .insert(userAddressAssignments)
      .values({
        userId,
        currency,
        network,
        address: selectedAddress.address,
        expiresAt: twentyFourHoursFromNow
      })
      .returning();

    return {
      address: newAssignment.address,
      assignedAt: newAssignment.assignedAt!,
      expiresAt: newAssignment.expiresAt,
      isNewAssignment: true
    };
  }

  async getUserAddressAssignment(userId: string, currency: 'USDT' | 'BTC', network?: string): Promise<UserAddressAssignment | null> {
    const now = new Date();
    
    const result = await db
      .select()
      .from(userAddressAssignments)
      .where(
        and(
          eq(userAddressAssignments.userId, userId),
          eq(userAddressAssignments.currency, currency),
          network ? eq(userAddressAssignments.network, network) : sql`${userAddressAssignments.network} IS NULL`,
          gte(userAddressAssignments.expiresAt, now)
        )
      )
      .limit(1);

    return result[0] || null;
  }

  async getRandomAvailableAddress(userId: string): Promise<{ 
    address: string | null; 
    canGetNewAddress: boolean; 
    hoursUntilNewAddress: number; 
  }> {
    // Simplified version - just return a random active address
    // No cooldown, no user assignment tracking
    
    const activeAddresses = await db
      .select()
      .from(depositAddresses)
      .where(eq(depositAddresses.isActive, true));
    
    if (activeAddresses.length === 0) {
      return {
        address: null,
        canGetNewAddress: true,
        hoursUntilNewAddress: 0
      };
    }
    
    // Pick a random address from the pool
    const randomIndex = Math.floor(Math.random() * activeAddresses.length);
    const selectedAddress = activeAddresses[randomIndex];
    
    return {
      address: selectedAddress.address,
      canGetNewAddress: true,
      hoursUntilNewAddress: 0
    };
  }

  async releaseAddress(userId: string): Promise<void> {
    // CRITICAL SECURITY FIX: This method is now a no-op
    // Addresses are permanently assigned and should NEVER be released
    // Keeping the method to avoid breaking existing code, but it does nothing
    
    // Log warning if this method is called (for debugging)
    console.warn(`Warning: releaseAddress() called for userId ${userId} but addresses are now permanently assigned`);
    return;
  }

  async getDepositAddresses(): Promise<DepositAddress[]> {
    return await db
      .select()
      .from(depositAddresses)
      .orderBy(desc(depositAddresses.createdAt));
  }

  async getAllActiveDepositAddresses(): Promise<DepositAddress[]> {
    return await db
      .select()
      .from(depositAddresses)
      .where(eq(depositAddresses.isActive, true))
      .orderBy(desc(depositAddresses.createdAt));
  }

  async bulkCreateAddresses(addresses: string[]): Promise<void> {
    if (addresses.length === 0) return;
    
    // SECURITY FIX: Filter out duplicates and validate addresses
    const uniqueAddresses = Array.from(new Set(addresses));
    const validAddresses = uniqueAddresses.filter(address => {
      // Validate address format (ERC20/BSC or TRON)
      const isValidERC20 = /^0x[a-fA-F0-9]{40}$/.test(address);
      const isValidTRON = /^T[A-Za-z1-9]{33}$/.test(address);
      return isValidERC20 || isValidTRON;
    });
    
    if (validAddresses.length === 0) {
      console.log('No valid addresses to insert');
      return;
    }
    
    const values = validAddresses.map(address => ({
      address,
      isActive: true
    }));
    
    // Skip duplicates silently (since address has unique constraint)
    const result = await db
      .insert(depositAddresses)
      .values(values)
      .onConflictDoNothing()
      .returning();
    
    console.log(`Bulk insert: ${result.length} new addresses added out of ${validAddresses.length} provided`);
  }

  async deleteAddress(id: string): Promise<void> {
    await db
      .delete(depositAddresses)
      .where(eq(depositAddresses.id, id));
  }

  async updateAddressStatus(id: string, isActive: boolean): Promise<void> {
    await db
      .update(depositAddresses)
      .set({ 
        isActive,
        updatedAt: new Date()
      })
      .where(eq(depositAddresses.id, id));
  }
}

import { MemoryStorage } from "./memoryStorage";

// Cache for BTC price to avoid rate limiting
let btcPriceCache: { price: string; timestamp: number } | null = null;
const CACHE_DURATION = 30000; // Cache for 30 seconds

// Helper function to fetch real BTC price
export async function fetchRealBtcPrice(): Promise<string> {
  try {
    // Check cache first
    if (btcPriceCache && Date.now() - btcPriceCache.timestamp < CACHE_DURATION) {
      return btcPriceCache.price;
    }

    // Fetch from CoinGecko's free API (no API key required)
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
    
    if (!response.ok) {
      throw new Error('Failed to fetch BTC price');
    }
    
    const data = await response.json();
    const price = data.bitcoin?.usd;
    
    if (!price) {
      throw new Error('Invalid price data');
    }
    
    // Cache the price
    btcPriceCache = {
      price: price.toFixed(2),
      timestamp: Date.now()
    };
    
    return price.toFixed(2);
  } catch (error) {
    console.error('Error fetching BTC price:', error);
    // Fallback to a reasonable default if API fails
    return "98000.00";
  }
}

// Storage variables will be initialized during server startup

async function testDatabaseConnection(): Promise<boolean> {
  try {
    // Test database connection with a simple query
    const result = await db.execute(sql`SELECT 1 as test`);
    console.log('✅ Database connection test successful');
    return true;
  } catch (error: any) {
    console.error('❌ Database connection test failed:', error.message);
    return false;
  }
}

// Initialize storage with fallback
async function initializeStorage() {
  const dbAvailable = await testDatabaseConnection();
  
  if (dbAvailable) {
    // Using PostgreSQL database
    storage = new DatabaseStorage();
    isUsingMemoryStorage = false;
  } else {
    // Using in-memory storage - default accounts created
    storage = new MemoryStorage();
    isUsingMemoryStorage = true;
  }
}

// Initialize storage (will be set during server startup)
let storage: IStorage;
let isUsingMemoryStorage = false;

// Export the initialization function to be called during server startup
export async function initStorage() {
  const dbAvailable = await testDatabaseConnection();
  
  if (dbAvailable) {
    // Using PostgreSQL database - ALWAYS preferred
    storage = new DatabaseStorage();
    isUsingMemoryStorage = false;
    console.log('✅ Initialized DatabaseStorage - all data will be persisted to PostgreSQL');
    
    // Run database fixes and initialization
    await storage.fixDepositStatuses();
    console.log('✅ Database initialization and fixes completed');
  } else {
    // CRITICAL: User requested NO memory storage fallback
    console.error('❌ FATAL: Database connection failed and user requires database storage only');
    console.error('❌ Please ensure DATABASE_URL is set and database is accessible');
    throw new Error('Database connection required - memory storage fallback disabled per user requirements');
  }
  
  return storage;
}

export { storage, isUsingMemoryStorage };
