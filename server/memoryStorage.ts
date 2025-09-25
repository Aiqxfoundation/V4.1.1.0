import { 
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
  type InsertReferralReward
} from "@shared/schema";
import { IStorage } from "./storage";
import session from "express-session";
import MemoryStore from "memorystore";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);
const MemoryStoreSession = MemoryStore(session);

export class MemoryStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private usersByUsername: Map<string, string> = new Map(); // username -> userId
  private passwords: Map<string, string> = new Map(); // userId -> password
  private deposits: Map<string, Deposit> = new Map();
  private withdrawals: Map<string, Withdrawal> = new Map();
  private miningBlocks: Map<string, MiningBlock> = new Map();
  private btcPriceCache: { price: string; timestamp: number } | null = null;
  private readonly PRICE_CACHE_DURATION = 30000; // 30 seconds cache
  private systemSettings: Map<string, SystemSetting> = new Map();
  private unclaimedBlocks: Map<string, UnclaimedBlock> = new Map();
  private transfers: Map<string, Transfer> = new Map();
  private minerActivity: Map<string, MinerActivity> = new Map();
  private lastDepositTime: Map<string, Date> = new Map(); // userId -> last deposit timestamp
  private lastWithdrawalTime: Map<string, Date> = new Map(); // userId -> last withdrawal timestamp
  private btcConversions: Map<string, any[]> = new Map(); // userId -> BTC/USDT conversions
  
  // Device fingerprinting storage
  private devices: Map<string, Device> = new Map(); // deviceId -> Device
  private devicesByServerDeviceId: Map<string, string> = new Map(); // serverDeviceId -> deviceId  
  private deviceFingerprints: Map<string, DeviceFingerprint[]> = new Map(); // deviceId -> fingerprints[]
  private userDevices: Map<string, string[]> = new Map(); // userId -> deviceId[]
  private miningHistoryData: Map<string, MiningHistory[]> = new Map(); // userId -> MiningHistory[]
  
  // Referral codes storage
  private referralCodes: ReferralCode[] = [];
  
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new MemoryStoreSession({
      checkPeriod: 86400000 // prune expired entries every 24h
    });
    
    // Initialize default admin user
    this.initializeDefaultData();
  }

  private async initializeDefaultData() {
    // Create default admin user
    const adminId = 'admin-' + randomBytes(8).toString('hex');
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync('123456', salt, 64)) as Buffer;
    const hashedPassword = `${buf.toString("hex")}.${salt}`;
    
    const adminUser: User = {
      id: adminId,
      username: 'admin',
      accessKey: 'admin-key-' + randomBytes(16).toString('hex'),
      referralCode: 'ADM1N0X7',
      referredBy: null,  // No referrer for admin
      usdtBalance: '10000.00',

      btcBalance: '10.00000000',  // Added BTC balance for testing
      hashPower: '1104.50', // 1000 base + 104.5 bonus from referrals (increased for staking)
      baseHashPower: '1000.00',
      referralHashBonus: '104.50', // 5% of 90 TH/s from 3 referrals
      b2bBalance: '50.00000000',  // Added B2B balance for testing
      unclaimedBalance: '0.00000000',
      totalReferralEarnings: '0.00',
      totalReferralCodes: 0,
      unclaimedReferralUsdt: '0.00',
      unclaimedReferralHash: '0.00',
      lastActiveBlock: 0,
      personalBlockHeight: 0,
      lastClaimedBlock: null,
      lockedHashPower: '0.00',
      miningActive: true,
      lastActivityTime: null,
      nextBlockHashPower: '0.00',
      isAdmin: true,
      isFrozen: false,
      isBanned: false,
      hasStartedMining: false,
      hasPaidPurchase: false,
      unclaimedBlocksCount: 0,
      miningSuspended: false,
      userIndex: '0',
      accruedPending: '0',
      suspensionAtBlock: null,
      registrationIp: null,
      createdAt: new Date()
    };
    
    this.users.set(adminId, adminUser);
    this.usersByUsername.set('admin', adminId);
    this.passwords.set(adminId, hashedPassword); // Store password separately
    
    // Create super_admin user - always unbanned
    const superAdminId = 'super-admin-' + randomBytes(8).toString('hex');
    const superAdminSalt = randomBytes(16).toString("hex");
    const superAdminBuf = (await scryptAsync('SuperAdmin@2025', superAdminSalt, 64)) as Buffer;
    const superAdminHashedPassword = `${superAdminBuf.toString("hex")}.${superAdminSalt}`;
    
    const superAdminUser: User = {
      id: superAdminId,
      username: 'super_admin',
      accessKey: 'super-admin-key-' + randomBytes(16).toString('hex'),
      referralCode: 'SUPER0X1',
      referredBy: null,  // No referrer for super admin
      usdtBalance: '50000.00',
      btcBalance: '100.00000000',  
      hashPower: '5000.00', 
      baseHashPower: '5000.00',
      referralHashBonus: '0.00',
      b2bBalance: '1000.00000000',
      unclaimedBalance: '0.00000000',
      totalReferralEarnings: '0.00',
      totalReferralCodes: 0,
      unclaimedReferralUsdt: '0.00',
      unclaimedReferralHash: '0.00',
      lastActiveBlock: 0,
      personalBlockHeight: 0,
      lastClaimedBlock: null,
      lockedHashPower: '0.00',
      miningActive: true,
      lastActivityTime: null,
      nextBlockHashPower: '0.00',
      isAdmin: true,
      isFrozen: false,
      isBanned: false,  // CRITICAL: super_admin is NEVER banned
      hasStartedMining: true,
      hasPaidPurchase: true,
      unclaimedBlocksCount: 0,
      miningSuspended: false,
      userIndex: '0',
      accruedPending: '0',
      suspensionAtBlock: null,
      registrationIp: null,
      createdAt: new Date()
    };
    
    this.users.set(superAdminId, superAdminUser);
    this.usersByUsername.set('super_admin', superAdminId);
    this.passwords.set(superAdminId, superAdminHashedPassword);
    
    // CRITICAL SAFEGUARD: Force unban super_admin on every initialization
    // This ensures super_admin is ALWAYS unbanned even if data was corrupted
    if (superAdminUser.isBanned) {
      superAdminUser.isBanned = false;
      console.log('CRITICAL FIX: super_admin was banned, forcefully unbanning on initialization');
    }
    
    console.log('=====================================')
    console.log('SUPER ADMIN USER CREATED:');
    console.log('Username: super_admin');
    console.log('Password: SuperAdmin@2025');
    console.log('Status: UNBANNED (Always)');
    console.log('Admin: true');
    console.log('=====================================');
    
    // Create tempuser for testing
    const tempUserId = 'user-temp' + randomBytes(6).toString('hex');
    const tempBuf = (await scryptAsync('123456', salt, 64)) as Buffer;
    const tempHashedPassword = `${tempBuf.toString("hex")}.${salt}`;
    
    const tempUser: User = {
      id: tempUserId,
      username: 'tempuser',
      accessKey: 'temp-key-' + randomBytes(16).toString('hex'),
      referralCode: 'TEMP1234',
      referredBy: 'admin',  // Referred by admin (using username)
      usdtBalance: '1000.00',

      btcBalance: '0.50000000',
      hashPower: '10.00',
      baseHashPower: '10.00',
      referralHashBonus: '0.00',
      b2bBalance: '5.00000000',
      unclaimedBalance: '0.00000000',
      totalReferralEarnings: '0.00',
      totalReferralCodes: 0,
      unclaimedReferralUsdt: '0.00',
      unclaimedReferralHash: '0.00',
      lastActiveBlock: 0,
      personalBlockHeight: 0,
      lastClaimedBlock: null,
      lockedHashPower: '0.00',
      miningActive: true,
      lastActivityTime: null,
      nextBlockHashPower: '0.00',
      isAdmin: false,
      isFrozen: false,
      isBanned: false,
      hasStartedMining: false,
      hasPaidPurchase: false,
      unclaimedBlocksCount: 0,
      miningSuspended: false,
      userIndex: '0',
      accruedPending: '0',
      suspensionAtBlock: null,
      registrationIp: null,
      createdAt: new Date()
    };
    
    this.users.set(tempUserId, tempUser);
    this.usersByUsername.set('tempuser', tempUserId);
    this.passwords.set(tempUserId, tempHashedPassword); // Store password separately
    
    // Create PROPER TEST USER with known credentials for testing
    const testUserId = 'user-test-' + randomBytes(8).toString('hex');
    const testAccessKey = 'B2B-TEST1-USER2-KEY3X-4DEMO';
    
    // Hash the access key using the same logic as auth.ts
    const accessKeySalt = randomBytes(16);
    const accessKeyHash = (await scryptAsync(testAccessKey, accessKeySalt, 32)) as Buffer;
    const hashedAccessKey = `${accessKeySalt.toString('hex')}:${accessKeyHash.toString('hex')}`;
    
    // Create test user with proper hashed access key
    const testUser: User = {
      id: testUserId,
      username: 'testuser',
      accessKey: hashedAccessKey, // Properly hashed access key in salt:hash format
      referralCode: 'TEST1234',
      referredBy: 'admin',  // Referred by admin (using username)
      usdtBalance: '1000.00',
      btcBalance: '0.50000000',
      hashPower: '50.00',
      baseHashPower: '50.00',
      referralHashBonus: '0.00',
      b2bBalance: '10.00000000',
      unclaimedBalance: '0.00000000',
      totalReferralEarnings: '0.00',
      totalReferralCodes: 0,
      unclaimedReferralUsdt: '0.00',
      unclaimedReferralHash: '0.00',
      lastActiveBlock: 0,
      personalBlockHeight: 0,
      lastClaimedBlock: null,
      lockedHashPower: '0.00',
      miningActive: true,
      lastActivityTime: null,
      nextBlockHashPower: '0.00',
      isAdmin: false,
      isFrozen: false,
      isBanned: false,
      hasStartedMining: true, // Set to true for testing
      hasPaidPurchase: false,
      unclaimedBlocksCount: 0,
      miningSuspended: false,
      userIndex: '0',
      accruedPending: '0',
      suspensionAtBlock: null,
      registrationIp: null,
      createdAt: new Date()
    };
    
    this.users.set(testUserId, testUser);
    this.usersByUsername.set('testuser', testUserId);
    
    // Log the test credentials clearly for the user
    console.log('=====================================');
    console.log('TEST USER CREDENTIALS CREATED:');
    console.log('Username: testuser');
    console.log('Access Key: B2B-TEST1-USER2-KEY3X-4DEMO');
    console.log('Initial USDT Balance: 1000.00');
    console.log('Initial BTC Balance: 0.50000000');
    console.log('Initial B2B Balance: 10.00000000');
    console.log('Initial Hash Power: 50.00 TH/s');
    console.log('=====================================');
    
    // Create demo miners for testuser
    const demoMiners = [
      { username: 'miner1', hashPower: '100.00', b2bBalance: '2.50000000', miningActive: true, daysAgo: 7 },
      { username: 'miner2', hashPower: '250.00', b2bBalance: '8.75000000', miningActive: true, daysAgo: 14 },
      { username: 'miner3', hashPower: '500.00', b2bBalance: '15.25000000', miningActive: false, daysAgo: 21 },
      { username: 'miner4', hashPower: '150.00', b2bBalance: '3.50000000', miningActive: true, daysAgo: 5 },
      { username: 'miner5', hashPower: '75.00', b2bBalance: '1.20000000', miningActive: true, daysAgo: 10 },
      { username: 'miner6', hashPower: '200.00', b2bBalance: '6.80000000', miningActive: false, daysAgo: 3 }
    ];
    
    const createdMinersUsernames: string[] = [];
    
    for (const minerConfig of demoMiners) {
      const minerId = 'user-miner-' + randomBytes(8).toString('hex');
      const minerAccessKey = 'MINER-' + minerConfig.username.toUpperCase() + '-' + randomBytes(12).toString('hex');
      
      // Hash the access key using the same logic as testuser
      const minerAccessKeySalt = randomBytes(16);
      const minerAccessKeyHash = (await scryptAsync(minerAccessKey, minerAccessKeySalt, 32)) as Buffer;
      const hashedMinerAccessKey = `${minerAccessKeySalt.toString('hex')}:${minerAccessKeyHash.toString('hex')}`;
      
      // Generate unique referral code for this miner
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz';
      let minerRefCode = '';
      for (let j = 0; j < 8; j++) {
        minerRefCode += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      
      // Calculate created date (days ago from now)
      const minerCreatedAt = new Date();
      minerCreatedAt.setDate(minerCreatedAt.getDate() - minerConfig.daysAgo);
      
      const miner: User = {
        id: minerId,
        username: minerConfig.username,
        accessKey: hashedMinerAccessKey, // Properly hashed access key
        referralCode: minerRefCode,
        referredBy: 'testuser', // CRITICAL: Referred by testuser (using username)
        usdtBalance: (Math.random() * 500 + 100).toFixed(2), // Random USDT balance 100-600
        btcBalance: (Math.random() * 0.1).toFixed(8), // Random BTC balance 0-0.1
        hashPower: minerConfig.hashPower,
        baseHashPower: minerConfig.hashPower,
        referralHashBonus: '0.00',
        b2bBalance: minerConfig.b2bBalance,
        unclaimedBalance: (Math.random() * 0.5).toFixed(8), // Small unclaimed balance
        totalReferralEarnings: '0.00',
        totalReferralCodes: 0,
        unclaimedReferralUsdt: '0.00',
        unclaimedReferralHash: '0.00',
        lastActiveBlock: minerConfig.miningActive ? Math.floor(Math.random() * 10) : 0,
        personalBlockHeight: Math.floor(Math.random() * 20),
        lastClaimedBlock: minerConfig.miningActive ? Math.floor(Math.random() * 10) : null,
        lockedHashPower: '0.00',
        miningActive: minerConfig.miningActive,
        lastActivityTime: minerConfig.miningActive ? new Date(Date.now() - Math.random() * 86400000) : null, // Random time within last 24h
        nextBlockHashPower: '0.00',
        isAdmin: false,
        isFrozen: false,
        isBanned: false,
        hasStartedMining: minerConfig.miningActive, // Started if active
        hasPaidPurchase: false,
        unclaimedBlocksCount: 0,
        miningSuspended: false,
        userIndex: '0',
        accruedPending: '0',
        suspensionAtBlock: null,
        registrationIp: null,
        createdAt: minerCreatedAt
      };
      
      this.users.set(minerId, miner);
      this.usersByUsername.set(minerConfig.username, minerId);
      createdMinersUsernames.push(minerConfig.username);
    }
    
    // Log the demo miners created
    console.log('=====================================');
    console.log(`DEMO MINERS CREATED FOR TESTUSER:`);
    console.log(`Total miners created: ${createdMinersUsernames.length}`);
    console.log(`Miners usernames: ${createdMinersUsernames.join(', ')}`);
    console.log('All demo miners are referred by testuser (username-based)');
    console.log('=====================================');
    
    // Create test referral users for admin
    for (let i = 1; i <= 3; i++) {
      const refUserId = 'user-ref' + i + randomBytes(6).toString('hex');
      const refBuf = (await scryptAsync('123456', salt, 64)) as Buffer;
      const refHashedPassword = `${refBuf.toString("hex")}.${salt}`;
      
      // Generate unique referral code for this user
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz';
      let refCode = '';
      for (let j = 0; j < 8; j++) {
        refCode += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      
      const refUser: User = {
        id: refUserId,
        username: 'refuser' + i,
        accessKey: 'ref-key-' + i + '-' + randomBytes(16).toString('hex'),
        referralCode: refCode,
        referredBy: 'admin', // Referred by admin (using username)
        usdtBalance: '500.00',
  
        btcBalance: '0.00000000',
        hashPower: (20 + i * 5).toFixed(2), // 25, 30, 35 TH/s
        baseHashPower: (20 + i * 5).toFixed(2),
        referralHashBonus: '0.00',
        b2bBalance: '0.00000000',
        unclaimedBalance: '0.00000000',
        totalReferralEarnings: '0.00',
        totalReferralCodes: 0,
        unclaimedReferralUsdt: '0.00',
        unclaimedReferralHash: '0.00',
        lastActiveBlock: 0,
        personalBlockHeight: 0,
        lastClaimedBlock: null,
        lockedHashPower: '0.00',
        miningActive: true,
        lastActivityTime: null,
        nextBlockHashPower: '0.00',
        isAdmin: false,
        isFrozen: false,
        isBanned: false,
        hasStartedMining: false,
        hasPaidPurchase: false,
        unclaimedBlocksCount: 0,
        miningSuspended: false,
        userIndex: '0',
        accruedPending: '0',
        suspensionAtBlock: null,
        registrationIp: null,
        createdAt: new Date()
      };
      
      this.users.set(refUserId, refUser);
      this.usersByUsername.set('refuser' + i, refUserId);
      this.passwords.set(refUserId, refHashedPassword); // Store password separately
    }
    
    // Initialize system settings
    this.systemSettings.set('blockReward-1', {
      id: 'blockReward-1',
      key: 'blockReward',
      value: '3200',
      updatedAt: new Date()
    });
    
    this.systemSettings.set('blockNumber-1', {
      id: 'blockNumber-1',
      key: 'blockNumber',
      value: '1',
      updatedAt: new Date()
    });
    
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const userId = this.usersByUsername.get(username);
    if (!userId) return undefined;
    return this.users.get(userId);
  }
  
  // Removed checkDuplicateFaceHash - no longer needed without KYC

  async getUserByAccessKey(accessKey: string): Promise<User | undefined> {
    // For memory storage, find user by hashed access key
    for (const user of Array.from(this.users.values())) {
      if ((user as any).accessKey === accessKey) {
        return user;
      }
    }
    return undefined;
  }

  async getUsersByReferralCode(referralCode: string): Promise<User[]> {
    const referredUsers: User[] = [];
    for (const user of Array.from(this.users.values())) {
      if (user.referredBy === referralCode) {
        referredUsers.push(user);
      }
    }
    return referredUsers;
  }

  async findUserByOwnReferralCode(referralCode: string): Promise<User | null> {
    for (const user of Array.from(this.users.values())) {
      if (user.referralCode === referralCode) {
        return user;
      }
    }
    return null;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const userId = 'user-' + randomBytes(8).toString('hex');
    // Generate unique hash-style referral code (8 characters, alphanumeric)
    const generateReferralCode = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz';
      let code = '';
      // Generate a more hash-like code with mixed case
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      // Add timestamp component for uniqueness
      const timestamp = Date.now().toString(36).slice(-2).toUpperCase();
      return code.slice(0, 6) + timestamp;
    };
    
    // Ensure referral code is unique
    let referralCode = generateReferralCode();
    const existingCodes = Array.from(this.users.values()).map(u => u.referralCode).filter(Boolean);
    while (existingCodes.includes(referralCode)) {
      referralCode = generateReferralCode();
    }
    
    const user: User = {
      id: userId,
      username: insertUser.username,
      accessKey: (insertUser as any).accessKey || '',
      referralCode,
      referredBy: insertUser.referredBy || null,
      registrationIp: (insertUser as any).registrationIp || null,
      usdtBalance: '0.00',
      btcBalance: '0.00000000',
      hashPower: '0.00',
      baseHashPower: '0.00',
      referralHashBonus: '0.00',
      b2bBalance: '0.00000000',
      unclaimedBalance: '0.00000000',
      totalReferralEarnings: '0.00',
      totalReferralCodes: 0,
      unclaimedReferralUsdt: '0.00',
      unclaimedReferralHash: '0.00',
      lastActiveBlock: null,
      personalBlockHeight: 0,
      lastClaimedBlock: null,
      lockedHashPower: '0.00',
      miningActive: true,
      lastActivityTime: null,
      nextBlockHashPower: '0.00',
      isAdmin: false,
      isFrozen: false,
      isBanned: false,
      hasStartedMining: false,
      hasPaidPurchase: false,
      unclaimedBlocksCount: 0,
      miningSuspended: false,
      userIndex: '0',
      accruedPending: '0',
      suspensionAtBlock: null,
      createdAt: new Date()
    };
    
    this.users.set(userId, user);
    this.usersByUsername.set(insertUser.username, userId);
    return user;
  }

  async hasIpRegistered(ip: string): Promise<boolean> {
    for (const user of Array.from(this.users.values())) {
      if (user.registrationIp === ip) {
        return true;
      }
    }
    return false;
  }

  async updateUserBalance(userId: string, usdtBalance: string, hashPower: string, b2bBalance: string, unclaimedBalance: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.usdtBalance = usdtBalance;
      user.hashPower = hashPower;
      user.b2bBalance = b2bBalance;
      user.unclaimedBalance = unclaimedBalance;
    }
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      Object.assign(user, updates);
    }
  }

  async freezeUser(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.isFrozen = true;
    }
  }

  async unfreezeUser(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.isFrozen = false;
    }
  }

  async banUser(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      // CRITICAL: super_admin can NEVER be banned
      if (user.username === 'super_admin') {
        console.log('WARNING: Attempt to ban super_admin blocked - super_admin cannot be banned');
        return; // Exit immediately without banning
      }
      user.isBanned = true;
    }
  }

  async unbanUser(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.isBanned = false;
    }
    
    // EXTRA SAFEGUARD: Always ensure super_admin is unbanned
    const superAdminId = this.usersByUsername.get('super_admin');
    if (superAdminId) {
      const superAdmin = this.users.get(superAdminId);
      if (superAdmin && superAdmin.isBanned) {
        console.log('AUTO-FIX: Forcefully unbanning super_admin');
        superAdmin.isBanned = false;
      }
    }
  }

  async getGlobalDepositAddress(currency: 'USDT' | 'BTC'): Promise<string> {
    const key = `${currency}_DEPOSIT_ADDRESS`;
    const setting = this.systemSettings.get(key);
    if (currency === 'BTC') {
      return setting?.value || 'bc1qy8zzqsarhp0s63txsfnn3q3nvuu0g83mv3hwrv';
    }
    return setting?.value || 'TBGxYmP3tFrbKvJRvQcF9cENKixQeJdfQc';
  }

  async setGlobalDepositAddress(currency: 'USDT' | 'BTC', address: string): Promise<void> {
    const key = `${currency}_DEPOSIT_ADDRESS`;
    const settingId = `${key}-${randomBytes(8).toString('hex')}`;
    this.systemSettings.set(key, {
      id: settingId,
      key: key,
      value: address,
      updatedAt: new Date()
    });
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values()).sort((a, b) => 
      (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
    );
  }

  async updateUserBalances(userId: string, balances: { usdtBalance?: string; b2bBalance?: string; hashPower?: string }): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      if (balances.usdtBalance !== undefined) user.usdtBalance = balances.usdtBalance;
      if (balances.b2bBalance !== undefined) user.b2bBalance = balances.b2bBalance;
      if (balances.hashPower !== undefined) user.hashPower = balances.hashPower;
    }
  }

  async createDeposit(deposit: InsertDeposit & { userId: string }): Promise<Deposit> {
    // Check cooldown (24 hours = 86400000 ms)
    const lastRequest = this.lastDepositTime.get(deposit.userId);
    if (lastRequest) {
      const timePassed = Date.now() - lastRequest.getTime();
      const cooldownRemaining = 86400000 - timePassed; // 24 hours in ms
      if (cooldownRemaining > 0) {
        const hoursRemaining = Math.ceil(cooldownRemaining / (1000 * 60 * 60));
        throw new Error(`Please wait ${hoursRemaining} hours before making another deposit request`);
      }
    }
    
    const depositId = 'dep-' + randomBytes(8).toString('hex');
    const newDeposit: Deposit = {
      id: depositId,
      userId: deposit.userId,
      network: deposit.network,
      currency: deposit.network === 'BTC' ? 'BTC' : 'USDT',
      txHash: deposit.txHash,
      amount: deposit.amount,
      status: 'pending',
      adminNote: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.deposits.set(depositId, newDeposit);
    // Track the time of this deposit request
    this.lastDepositTime.set(deposit.userId, new Date());
    return newDeposit;
  }

  async getPendingDeposits(): Promise<(Deposit & { user: User })[]> {
    const pendingDeposits: (Deposit & { user: User })[] = [];
    
    for (const deposit of Array.from(this.deposits.values())) {
      if (deposit.status === 'pending') {
        const user = this.users.get(deposit.userId);
        if (user) {
          pendingDeposits.push({ ...deposit, user });
        }
      }
    }
    
    return pendingDeposits.sort((a, b) => 
      (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
    );
  }

  async approveDeposit(depositId: string, adminNote?: string, actualAmount?: string): Promise<void> {
    const deposit = this.deposits.get(depositId);
    if (!deposit) throw new Error("Deposit not found");
    
    // Use actualAmount if provided (admin verified amount), otherwise use original amount
    const amountToCredit = actualAmount || deposit.amount;
    
    deposit.status = 'completed';
    deposit.adminNote = adminNote || null;
    deposit.amount = amountToCredit; // Update with verified amount
    deposit.updatedAt = new Date();
    
    const user = this.users.get(deposit.userId);
    if (user) {
      // Check deposit currency
      if (deposit.currency === 'BTC') {
        const newBalance = (parseFloat(user.btcBalance || "0") + parseFloat(amountToCredit)).toFixed(8);
        user.btcBalance = newBalance;
      } else {
        const newBalance = (parseFloat(user.usdtBalance || "0") + parseFloat(amountToCredit)).toFixed(2);
        user.usdtBalance = newBalance;
      }
    }
  }

  async rejectDeposit(depositId: string, adminNote?: string): Promise<void> {
    const deposit = this.deposits.get(depositId);
    if (deposit) {
      deposit.status = 'rejected';
      deposit.adminNote = adminNote || null;
      deposit.updatedAt = new Date();
    }
  }

  async createWithdrawal(withdrawal: InsertWithdrawal & { userId: string }): Promise<Withdrawal> {
    // Check cooldown (24 hours = 86400000 ms)
    const lastRequest = this.lastWithdrawalTime.get(withdrawal.userId);
    if (lastRequest) {
      const timePassed = Date.now() - lastRequest.getTime();
      const cooldownRemaining = 86400000 - timePassed; // 24 hours in ms
      if (cooldownRemaining > 0) {
        const hoursRemaining = Math.ceil(cooldownRemaining / (1000 * 60 * 60));
        throw new Error(`Please wait ${hoursRemaining} hours before making another withdrawal request`);
      }
    }
    
    const withdrawalId = 'with-' + randomBytes(8).toString('hex');
    const newWithdrawal: Withdrawal = {
      id: withdrawalId,
      userId: withdrawal.userId,
      amount: withdrawal.amount,
      address: withdrawal.address,
      network: withdrawal.network,
      currency: withdrawal.network === 'B2B' ? 'B2B' : 'USDT',
      status: 'pending',
      txHash: null,
      createdAt: new Date()
    };
    
    this.withdrawals.set(withdrawalId, newWithdrawal);
    // Track the time of this withdrawal request
    this.lastWithdrawalTime.set(withdrawal.userId, new Date());
    return newWithdrawal;
  }

  async getPendingWithdrawals(): Promise<any[]> {
    const pendingWithdrawals = Array.from(this.withdrawals.values())
      .filter(w => w.status === 'pending')
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
    
    // Add user information
    return pendingWithdrawals.map(withdrawal => {
      const user = this.users.get(withdrawal.userId);
      return {
        ...withdrawal,
        user: user ? {
          id: user.id,
          username: user.username,
          usdtBalance: user.usdtBalance,
          b2bBalance: user.b2bBalance,
          btcBalance: user.btcBalance
        } : null
      };
    });
  }

  async approveWithdrawal(withdrawalId: string, txHash?: string): Promise<void> {
    const withdrawal = this.withdrawals.get(withdrawalId);
    if (!withdrawal) {
      throw new Error('Withdrawal not found');
    }

    const user = this.users.get(withdrawal.userId);
    if (!user) {
      throw new Error('User not found');
    }

    const amount = parseFloat(withdrawal.amount);
    const isUSDT = withdrawal.network === 'ERC20' || withdrawal.network === 'BSC' || withdrawal.network === 'TRC20';
    const isBTC = withdrawal.network === 'BTC';

    // Check balance and deduct
    if (isBTC) {
      const btcBalance = parseFloat(user.btcBalance || "0");
      if (btcBalance < amount) {
        throw new Error('Insufficient BTC balance');
      }
      user.btcBalance = (btcBalance - amount).toFixed(8);
    } else if (isUSDT) {
      const usdtBalance = parseFloat(user.usdtBalance || "0");
      if (usdtBalance < amount) {
        throw new Error('Insufficient USDT balance');
      }
      user.usdtBalance = (usdtBalance - amount).toFixed(2);
    } else {
      const b2bBalance = parseFloat(user.b2bBalance || "0");
      if (b2bBalance < amount) {
        throw new Error('Insufficient B2B balance');
      }
      user.b2bBalance = (b2bBalance - amount).toFixed(8);
    }

    // Update withdrawal status
    withdrawal.status = 'completed';
    if (txHash) {
      withdrawal.txHash = txHash;
    }
  }

  async rejectWithdrawal(withdrawalId: string): Promise<void> {
    const withdrawal = this.withdrawals.get(withdrawalId);
    if (!withdrawal) {
      throw new Error('Withdrawal not found');
    }
    withdrawal.status = 'rejected';
  }

  async createMiningBlock(blockNumber: number, reward: string, totalHashPower: string, globalHashrate?: string): Promise<MiningBlock> {
    const blockId = 'block-' + randomBytes(8).toString('hex');
    const now = new Date();
    const blockStartTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
    const blockEndTime = new Date(blockStartTime.getTime() + 3600000); // Add 1 hour
    
    const block: MiningBlock = {
      id: blockId,
      blockNumber,
      reward,
      totalHashPower,
      globalHashrate: globalHashrate || totalHashPower,
      cumulativeIndex: null, // Add missing cumulativeIndex
      blockStartTime,
      blockEndTime,
      timestamp: new Date()
    };
    
    this.miningBlocks.set(blockId, block);
    return block;
  }

  async getLatestBlock(): Promise<MiningBlock | undefined> {
    let latestBlock: MiningBlock | undefined;
    let maxBlockNumber = -1;
    
    for (const block of Array.from(this.miningBlocks.values())) {
      if (block.blockNumber > maxBlockNumber) {
        maxBlockNumber = block.blockNumber;
        latestBlock = block;
      }
    }
    
    return latestBlock;
  }

  async getTotalHashPower(): Promise<string> {
    let total = 0;
    for (const user of Array.from(this.users.values())) {
      // Exclude frozen and suspended users from total network hash
      if (user.isFrozen !== true && user.miningSuspended !== true) {
        total += parseFloat(user.hashPower || "0");
      }
    }
    return total.toFixed(2);
  }
  
  async lockHashratesForBlock(blockNumber: number): Promise<void> {
    // Lock hashrates for all active miners
    for (const [userId, user] of Array.from(this.users.entries())) {
      if (user.miningActive) {
        // Copy nextBlockHashPower to lockedHashPower, or hashPower if nextBlockHashPower is 0
        const hashToLock = parseFloat(user.nextBlockHashPower || '0') > 0 ? user.nextBlockHashPower : user.hashPower;
        
        user.lockedHashPower = hashToLock || '0.00';
        user.nextBlockHashPower = user.hashPower; // Current hashPower becomes next block's
        this.users.set(userId, user);
      }
    }
  }
  
  async getUserMiningStatus(userId: string): Promise<{ personalBlockHeight: number; lastClaimedBlock: number | null; miningActive: boolean; blocksUntilSuspension: number }> {
    const user = this.users.get(userId);
    if (!user) {
      return { personalBlockHeight: 0, lastClaimedBlock: null, miningActive: false, blocksUntilSuspension: 0 };
    }
    
    const blocksUntilSuspension = user.lastClaimedBlock !== null && user.lastClaimedBlock !== undefined
      ? Math.max(0, 24 - ((user.personalBlockHeight || 0) - user.lastClaimedBlock))
      : 24;
      
    return {
      personalBlockHeight: user.personalBlockHeight || 0,
      lastClaimedBlock: user.lastClaimedBlock || null,
      miningActive: user.miningActive !== false,
      blocksUntilSuspension
    };
  }
  
  async checkAndSuspendInactiveMiners(): Promise<void> {
    // Find users who haven't claimed in 24 blocks
    for (const [userId, user] of Array.from(this.users.entries())) {
      if (user.miningActive && user.lastClaimedBlock !== null && user.lastClaimedBlock !== undefined) {
        const blocksSinceLastClaim = (user.personalBlockHeight || 0) - user.lastClaimedBlock;
        if (blocksSinceLastClaim >= 24) {
          user.miningActive = false;
          this.users.set(userId, user);
        }
      }
    }
  }
  
  async createMiningHistory(userId: string, blockNumber: number, lockedHashrate: string, reward: string): Promise<MiningHistory> {
    const history: MiningHistory = {
      id: 'history-' + randomBytes(8).toString('hex'),
      userId,
      blockNumber,
      lockedHashrate,
      reward,
      claimedAt: new Date()
    };
    
    if (!this.miningHistoryData.has(userId)) {
      this.miningHistoryData.set(userId, []);
    }
    this.miningHistoryData.get(userId)!.push(history);
    
    return history;
  }
  
  async getUserMiningHistory(userId: string, limit: number = 10): Promise<MiningHistory[]> {
    const history = this.miningHistoryData.get(userId) || [];
    return history
      .sort((a, b) => (b.claimedAt?.getTime() || 0) - (a.claimedAt?.getTime() || 0))
      .slice(0, limit);
  }
  
  async calculateUserReward(userId: string, blockReward: string): Promise<string> {
    const user = this.users.get(userId);
    
    // Check if user is frozen, suspended, or mining inactive - they get NO rewards
    if (!user || !user.miningActive || user.isFrozen === true || user.miningSuspended === true) {
      return "0";
    }
    
    // Get total locked hashrate for this block (excluding frozen/suspended users)
    let totalLockedHashrate = 0;
    for (const [_, u] of Array.from(this.users.entries())) {
      if (u.miningActive && u.isFrozen !== true && u.miningSuspended !== true) {
        totalLockedHashrate += parseFloat(u.lockedHashPower || '0');
      }
    }
    
    if (totalLockedHashrate === 0) return "0";
    
    const userLockedHashrate = parseFloat(user.lockedHashPower || '0');
    const reward = (userLockedHashrate / totalLockedHashrate) * parseFloat(blockReward);
    
    return reward.toFixed(8);
  }

  async getSystemSetting(key: string): Promise<SystemSetting | undefined> {
    for (const setting of Array.from(this.systemSettings.values())) {
      if (setting.key === key) {
        return setting;
      }
    }
    return undefined;
  }

  async setSystemSetting(key: string, value: string): Promise<void> {
    const existingSetting = await this.getSystemSetting(key);
    if (existingSetting) {
      existingSetting.value = value;
      existingSetting.updatedAt = new Date();
    } else {
      const settingId = key + '-' + randomBytes(4).toString('hex');
      this.systemSettings.set(settingId, {
        id: settingId,
        key,
        value,
        updatedAt: new Date()
      });
    }
  }

  async getUserCount(): Promise<number> {
    return this.users.size;
  }

  async getTotalDeposits(): Promise<string> {
    let total = 0;
    for (const deposit of Array.from(this.deposits.values())) {
      if (deposit.status === 'approved') {
        total += parseFloat(deposit.amount);
      }
    }
    return total.toFixed(2);
  }

  async getTotalWithdrawals(): Promise<string> {
    let total = 0;
    for (const withdrawal of Array.from(this.withdrawals.values())) {
      if (withdrawal.status === 'completed') {
        total += parseFloat(withdrawal.amount);
      }
    }
    return total.toFixed(2);
  }

  async getActiveMinerCount(): Promise<number> {
    let count = 0;
    for (const activity of Array.from(this.minerActivity.values())) {
      if (activity.isActive) {
        count++;
      }
    }
    return count;
  }

  async createUnclaimedBlock(userId: string, blockNumber: number, txHash: string, reward: string): Promise<UnclaimedBlock> {
    const blockId = 'unclaimed-' + randomBytes(8).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    const block: UnclaimedBlock = {
      id: blockId,
      userId,
      blockNumber,
      txHash,
      reward,
      expiresAt,
      claimed: false,
      claimedAt: null,
      createdAt: new Date()
    };
    
    this.unclaimedBlocks.set(blockId, block);
    return block;
  }

  async getUnclaimedBlocks(userId: string): Promise<UnclaimedBlock[]> {
    const blocks: UnclaimedBlock[] = [];
    const now = new Date();
    
    for (const block of Array.from(this.unclaimedBlocks.values())) {
      if (block.userId === userId && !block.claimed && block.expiresAt && block.expiresAt > now) {
        blocks.push(block);
      }
    }
    
    return blocks.sort((a, b) => 
      (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
    );
  }

  async claimBlock(blockId: string, userId: string): Promise<{ success: boolean; reward?: string; suspended?: boolean }> {
    const block = this.unclaimedBlocks.get(blockId);
    const now = new Date();
    
    if (!block || block.userId !== userId || block.claimed || (block.expiresAt && block.expiresAt <= now)) {
      return { success: false };
    }
    
    // Get user and check 24-block requirement
    const user = this.users.get(userId);
    if (!user) {
      return { success: false };
    }
    
    // Check if user is suspended due to 24-block rule
    const blocksUnclaimed = user.lastClaimedBlock !== null && user.lastClaimedBlock !== undefined
      ? (user.personalBlockHeight || 0) - user.lastClaimedBlock 
      : (user.personalBlockHeight || 0);
      
    const wasSuspended = blocksUnclaimed >= 24;
    
    block.claimed = true;
    block.claimedAt = now;
    this.unclaimedBlocks.set(blockId, block);
    
    // Update user
    const newBalance = (parseFloat(user.b2bBalance || "0") + parseFloat(block.reward)).toFixed(8);
    user.b2bBalance = newBalance;
    user.personalBlockHeight = (user.personalBlockHeight || 0) + 1;
    user.lastClaimedBlock = user.personalBlockHeight;
    user.lastActivityTime = new Date();
    
    // If user was suspended, reactivate but no rewards until next block
    if (wasSuspended) {
      user.miningActive = true;
      user.lockedHashPower = '0.00'; // No locked hashrate until next block
    }
    
    this.users.set(userId, user);
    await this.updateMinerActivity(userId, true);
    
    return { success: true, reward: block.reward, suspended: wasSuspended };
  }

  async claimAllBlocks(userId: string): Promise<{ count: number; totalReward: string; suspended?: boolean }> {
    const blocks = await this.getUnclaimedBlocks(userId);
    
    if (blocks.length === 0) {
      return { count: 0, totalReward: '0' };
    }
    
    let totalReward = 0;
    const now = new Date();
    
    for (const block of blocks) {
      block.claimed = true;
      block.claimedAt = now;
      totalReward += parseFloat(block.reward);
    }
    
    const user = this.users.get(userId);
    if (user) {
      user.b2bBalance = (parseFloat(user.b2bBalance || '0') + totalReward).toFixed(8);
      
      // Check if user was suspended
      const blocksUnclaimed = user.lastClaimedBlock !== null && user.lastClaimedBlock !== undefined
        ? (user.personalBlockHeight || 0) - user.lastClaimedBlock + blocks.length
        : (user.personalBlockHeight || 0) + blocks.length;
      const wasSuspended = blocksUnclaimed >= 24;
      
      // Update user block heights and status
      user.personalBlockHeight = (user.personalBlockHeight || 0) + blocks.length;
      user.lastClaimedBlock = user.personalBlockHeight;
      user.lastActivityTime = new Date();
      
      if (wasSuspended) {
        user.miningActive = true;
        user.lockedHashPower = '0.00';
      }
      
      this.users.set(userId, user);
      await this.updateMinerActivity(userId, true);
      
      return { 
        count: blocks.length, 
        totalReward: totalReward.toFixed(8),
        suspended: wasSuspended
      };
    }
    
    return { 
      count: blocks.length, 
      totalReward: totalReward.toFixed(8) 
    };
  }

  async expireOldBlocks(): Promise<void> {
    const now = new Date();
    
    for (const block of Array.from(this.unclaimedBlocks.values())) {
      if (!block.claimed && block.expiresAt && block.expiresAt <= now) {
        await this.updateMinerActivity(block.userId, false);
      }
    }
  }

  async createTransfer(fromUserId: string, toUsername: string, amount: string): Promise<Transfer> {
    const toUserId = this.usersByUsername.get(toUsername);
    if (!toUserId) {
      throw new Error('Recipient not found');
    }
    
    const fromUser = this.users.get(fromUserId);
    const toUser = this.users.get(toUserId);
    
    if (!fromUser) {
      throw new Error('Sender not found');
    }
    
    if (!toUser) {
      throw new Error('Recipient not found');
    }
    
    const senderBalance = parseFloat(fromUser.b2bBalance || "0");
    if (senderBalance < parseFloat(amount)) {
      throw new Error('Insufficient balance');
    }
    
    fromUser.b2bBalance = (senderBalance - parseFloat(amount)).toFixed(8);
    toUser.b2bBalance = (parseFloat(toUser.b2bBalance || "0") + parseFloat(amount)).toFixed(8);
    
    const transferId = 'transfer-' + randomBytes(8).toString('hex');
    const txHash = '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
    
    const transfer: Transfer = {
      id: transferId,
      fromUserId,
      toUserId,
      amount,
      txHash,
      createdAt: new Date()
    };
    
    this.transfers.set(transferId, transfer);
    return transfer;
  }

  async getMinersStatus(): Promise<(MinerActivity & { user: User })[]> {
    const result: (MinerActivity & { user: User })[] = [];
    
    for (const activity of Array.from(this.minerActivity.values())) {
      const user = this.users.get(activity.userId);
      if (user) {
        result.push({ ...activity, user });
      }
    }
    
    return result;
  }

  async updateMinerActivity(userId: string, claimed: boolean): Promise<void> {
    const activity = this.minerActivity.get(userId);
    const now = new Date();
    
    if (!activity) {
      const newActivity: MinerActivity = {
        id: 'activity-' + randomBytes(8).toString('hex'),
        userId,
        lastClaimTime: claimed ? now : null,
        totalClaims: claimed ? 1 : 0,
        missedClaims: claimed ? 0 : 1,
        isActive: claimed,
        updatedAt: now
      };
      this.minerActivity.set(userId, newActivity);
    } else {
      const lastClaim = activity.lastClaimTime;
      const hoursSinceLastClaim = lastClaim ? (now.getTime() - lastClaim.getTime()) / (1000 * 60 * 60) : 999;
      
      activity.lastClaimTime = claimed ? now : activity.lastClaimTime;
      activity.totalClaims = claimed ? (activity.totalClaims || 0) + 1 : (activity.totalClaims || 0);
      activity.missedClaims = claimed ? (activity.missedClaims || 0) : (activity.missedClaims || 0) + 1;
      activity.isActive = hoursSinceLastClaim < 48;
      activity.updatedAt = now;
    }
  }

  async getUserDeposits(userId: string): Promise<Deposit[]> {
    const userDeposits: Deposit[] = [];
    
    for (const deposit of Array.from(this.deposits.values())) {
      if (deposit.userId === userId) {
        userDeposits.push(deposit);
      }
    }
    
    return userDeposits.sort((a, b) => 
      (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
    );
  }

  async getUserWithdrawals(userId: string): Promise<Withdrawal[]> {
    const userWithdrawals: Withdrawal[] = [];
    
    for (const withdrawal of Array.from(this.withdrawals.values())) {
      if (withdrawal.userId === userId) {
        userWithdrawals.push(withdrawal);
      }
    }
    
    return userWithdrawals.sort((a, b) => 
      (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
    );
  }

  async getSentTransfers(userId: string): Promise<Transfer[]> {
    const sentTransfers: Transfer[] = [];
    
    for (const transfer of Array.from(this.transfers.values())) {
      if (transfer.fromUserId === userId) {
        const toUser = this.users.get(transfer.toUserId);
        sentTransfers.push({
          ...transfer,
          toUsername: toUser?.username || 'Unknown'
        } as any);
      }
    }
    
    return sentTransfers.sort((a, b) => 
      (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
    );
  }

  async getReceivedTransfers(userId: string): Promise<Transfer[]> {
    const receivedTransfers: Transfer[] = [];
    
    for (const transfer of Array.from(this.transfers.values())) {
      if (transfer.toUserId === userId) {
        const fromUser = this.users.get(transfer.fromUserId);
        receivedTransfers.push({
          ...transfer,
          fromUsername: fromUser?.username || 'Unknown'
        } as any);
      }
    }
    
    return receivedTransfers.sort((a, b) => 
      (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
    );
  }

  async getDepositCooldown(userId: string): Promise<{ canDeposit: boolean; hoursRemaining: number }> {
    const lastRequest = this.lastDepositTime.get(userId);
    if (!lastRequest) {
      return { canDeposit: true, hoursRemaining: 0 };
    }
    
    const timePassed = Date.now() - lastRequest.getTime();
    const cooldownRemaining = 86400000 - timePassed; // 24 hours in ms
    
    if (cooldownRemaining > 0) {
      // Return precise hours remaining (with decimal) for accurate countdown
      const hoursRemaining = cooldownRemaining / (1000 * 60 * 60);
      return { canDeposit: false, hoursRemaining };
    }
    
    return { canDeposit: true, hoursRemaining: 0 };
  }

  async getWithdrawalCooldown(userId: string): Promise<{ canWithdraw: boolean; hoursRemaining: number }> {
    const lastRequest = this.lastWithdrawalTime.get(userId);
    if (!lastRequest) {
      return { canWithdraw: true, hoursRemaining: 0 };
    }
    
    const timePassed = Date.now() - lastRequest.getTime();
    const cooldownRemaining = 86400000 - timePassed; // 24 hours in ms
    
    if (cooldownRemaining > 0) {
      // Return precise hours remaining (with decimal) for accurate countdown
      const hoursRemaining = cooldownRemaining / (1000 * 60 * 60);
      return { canWithdraw: false, hoursRemaining };
    }
    
    return { canWithdraw: true, hoursRemaining: 0 };
  }
  
  // Supply tracking methods implementation
  async getTotalMinedSupply(): Promise<string> {
    // Calculate total mined supply from all mining blocks
    let totalMined = 0;
    for (const block of Array.from(this.miningBlocks.values())) {
      totalMined += parseFloat(block.reward || "0");
    }
    return totalMined.toFixed(8);
  }
  
  async getCirculatingSupply(): Promise<string> {
    // Circulating supply = All B2B in user wallets (not unclaimed)
    let circulatingSupply = 0;
    for (const user of Array.from(this.users.values())) {
      circulatingSupply += parseFloat(user.b2bBalance || "0");
    }
    return circulatingSupply.toFixed(8);
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
    const MAX_SUPPLY = 21000000; // 21M B2B max supply
    const HALVING_INTERVAL = 2160; // Blocks between halvings (3 months: 24 blocks/day × 90 days)
    
    // Get total mined supply
    const totalMined = await this.getTotalMinedSupply();
    
    // Get circulating supply
    const circulating = await this.getCirculatingSupply();
    
    // Get current block reward
    const blockRewardSetting = this.systemSettings.get("blockReward");
    const currentBlockReward = blockRewardSetting ? blockRewardSetting.value : "3200";
    
    // Get total blocks mined
    const totalBlockHeightSetting = this.systemSettings.get("totalBlockHeight");
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
  }
  
  // Track BTC/USDT conversions
  async createBtcConversion(userId: string, fromCurrency: string, toCurrency: string, fromAmount: string, toAmount: string, fee: string, rate: string): Promise<any> {
    const conversionId = 'btc-conv-' + randomBytes(8).toString('hex');
    const conversion = {
      id: conversionId,
      userId,
      fromCurrency,
      toCurrency,
      fromAmount,
      toAmount,
      fee,
      rate,
      createdAt: new Date()
    };
    
    if (!this.btcConversions.has(userId)) {
      this.btcConversions.set(userId, []);
    }
    this.btcConversions.get(userId)!.push(conversion);
    return conversion;
  }

  async getUserBtcConversions(userId: string): Promise<any[]> {
    return this.btcConversions.get(userId) || [];
  }

  // BTC Staking methods
  private btcStakes: Map<string, any> = new Map();
  private btcStakingRewards: Map<string, any[]> = new Map();
  private btcPriceHistory: any[] = [];

  async createBtcStake(userId: string, btcAmount: string, b2bHashrate: string, btcPrice: string, months: number = 12, apr: number = 20): Promise<any> {
    const stakeId = 'stake-' + randomBytes(8).toString('hex');
    const dailyReward = (parseFloat(btcAmount) * apr / 100 / 365).toFixed(8); // Dynamic APR daily
    const unlockAt = new Date();
    unlockAt.setMonth(unlockAt.getMonth() + months); // Dynamic lock period

    const stake = {
      id: stakeId,
      userId,
      btcAmount,
      b2bHashrate,
      btcPriceAtStake: btcPrice,
      aprRate: apr.toFixed(2),
      dailyReward,
      totalRewardsPaid: '0.00000000',
      stakedAt: new Date(),
      unlockAt,
      status: 'active',
      lastRewardAt: null,
      lockMonths: months
    };

    this.btcStakes.set(stakeId, stake);
    return stake;
  }

  async getUserBtcStakes(userId: string): Promise<any[]> {
    const stakes: any[] = [];
    for (const stake of Array.from(this.btcStakes.values())) {
      if (stake.userId === userId) {
        stakes.push(stake);
      }
    }
    return stakes.sort((a, b) => b.stakedAt.getTime() - a.stakedAt.getTime());
  }

  async getActiveBtcStakes(): Promise<any[]> {
    const stakes: any[] = [];
    for (const stake of Array.from(this.btcStakes.values())) {
      if (stake.status === 'active') {
        stakes.push(stake);
      }
    }
    return stakes;
  }

  async processDailyBtcRewards(): Promise<void> {
    const activeStakes = await this.getActiveBtcStakes();
    const currentBtcPrice = await this.getCurrentBtcPrice();

    for (const stake of activeStakes) {
      // Record reward payment
      const rewardId = 'reward-' + randomBytes(8).toString('hex');
      const reward = {
        id: rewardId,
        stakeId: stake.id,
        userId: stake.userId,
        rewardAmount: stake.dailyReward,
        btcPrice: currentBtcPrice,
        paidAt: new Date()
      };

      if (!this.btcStakingRewards.has(stake.userId)) {
        this.btcStakingRewards.set(stake.userId, []);
      }
      this.btcStakingRewards.get(stake.userId)!.push(reward);

      // Update user BTC balance
      const user = this.users.get(stake.userId);
      if (user) {
        const currentBalance = parseFloat((user as any).btcBalance || '0');
        (user as any).btcBalance = (currentBalance + parseFloat(stake.dailyReward)).toFixed(8);
      }

      // Update stake's total rewards paid
      stake.totalRewardsPaid = (parseFloat(stake.totalRewardsPaid) + parseFloat(stake.dailyReward)).toFixed(8);
      stake.lastRewardAt = new Date();
    }
  }

  async getCurrentBtcPrice(): Promise<string> {
    // Check if we have a cached price that's still fresh
    const now = Date.now();
    if (this.btcPriceCache && (now - this.btcPriceCache.timestamp) < this.PRICE_CACHE_DURATION) {
      return this.btcPriceCache.price;
    }

    // Fetch fresh price from public API
    try {
      // Using CoinGecko public API (no key required)
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
      if (response.ok) {
        const data = await response.json();
        const price = data.bitcoin?.usd || 111000;
        const priceStr = price.toFixed(2);
        
        // Cache the price
        this.btcPriceCache = {
          price: priceStr,
          timestamp: now
        };
        
        // Price fetched successfully
        return priceStr;
      }
    } catch (error) {
      // Failed to fetch price, using fallback
    }
    
    // Fallback to a default if API fails
    return "111000.00";
  }

  async updateBtcPrice(price: string, source: string = 'system'): Promise<void> {
    this.btcPriceHistory.push({
      price,
      source,
      timestamp: new Date()
    });
  }

  async getSystemHashratePrice(): Promise<string> {
    // Fixed pricing model: 1 GH/s = 1 USD
    // This means if BTC = $111,000, you need 111,000 GH/s to stake 1 BTC
    return "1.00";
  }

  async getUserBtcBalance(userId: string): Promise<string> {
    const user = this.users.get(userId);
    return (user as any)?.btcBalance || '0.00000000';
  }

  async updateUserBtcBalance(userId: string, btcBalance: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      (user as any).btcBalance = btcBalance;
    }
  }

  // Device Fingerprinting methods
  async upsertDevice(deviceData: { 
    serverDeviceId: string; 
    lastIp?: string; 
    asn?: string; 
    fingerprints: InsertDeviceFingerprint 
  }): Promise<{ device: Device; canRegister: boolean }> {
    const { serverDeviceId, lastIp, asn, fingerprints } = deviceData;
    
    // Check if device already exists by serverDeviceId
    let deviceId = this.devicesByServerDeviceId.get(serverDeviceId);
    let device: Device;

    if (!deviceId) {
      // Check for matching fingerprints first
      const matchingDevice = await this.findMatchingDevice(fingerprints);
      
      if (matchingDevice) {
        // Update existing device with new serverDeviceId
        device = { 
          ...matchingDevice, 
          serverDeviceId, 
          lastSeen: new Date(),
          lastIp: lastIp || null,
          asn: asn || null
        };
        this.devices.set(matchingDevice.id, device);
        this.devicesByServerDeviceId.set(serverDeviceId, matchingDevice.id);
      } else {
        // Create new device
        deviceId = 'device-' + randomBytes(8).toString('hex');
        device = {
          id: deviceId,
          serverDeviceId,
          firstSeen: new Date(),
          lastSeen: new Date(),
          lastIp: lastIp || null,
          asn: asn || null,
          registrations: 0,
          riskScore: 0,
          blocked: false,
          signalsVersion: '1.0'
        };
        this.devices.set(deviceId, device);
        this.devicesByServerDeviceId.set(serverDeviceId, deviceId);
      }

      // Add fingerprints - use the deviceId we either created or found from matching device
      const finalDeviceId = deviceId || matchingDevice?.id;
      if (!finalDeviceId) {
        throw new Error('Device ID not found');
      }
      
      const fingerprint: DeviceFingerprint = {
        id: 'fp-' + randomBytes(8).toString('hex'),
        deviceId: finalDeviceId,
        stableHash: fingerprints.stableHash,
        volatileHash: fingerprints.volatileHash,
        chUaHash: fingerprints.chUaHash || null,
        webglHash: fingerprints.webglHash || null,
        canvasHash: fingerprints.canvasHash || null,
        fontsHash: fingerprints.fontsHash || null,
        storageFlags: fingerprints.storageFlags || null,
        createdAt: new Date()
      };
      
      const existingFingerprints = this.deviceFingerprints.get(finalDeviceId) || [];
      this.deviceFingerprints.set(finalDeviceId, [...existingFingerprints, fingerprint]);
    } else {
      // Update existing device
      device = this.devices.get(deviceId)!;
      device = { 
        ...device, 
        lastSeen: new Date(),
        lastIp: lastIp || null,
        asn: asn || null
      };
      this.devices.set(deviceId, device);
    }

    const canRegister = !device.blocked && device.registrations === 0;
    return { device, canRegister };
  }

  async findMatchingDevice(fingerprints: Omit<InsertDeviceFingerprint, 'deviceId'>): Promise<Device | null> {
    // Check for exact stable hash match (highest confidence)
    if (fingerprints.stableHash) {
      for (const [deviceId, fpList] of Array.from(this.deviceFingerprints.entries())) {
        for (const fp of fpList) {
          if (fp.stableHash === fingerprints.stableHash) {
            return this.devices.get(deviceId) || null;
          }
        }
      }
    }

    // Check for WebGL + Fonts combination (high confidence)
    if (fingerprints.webglHash && fingerprints.fontsHash) {
      for (const [deviceId, fpList] of Array.from(this.deviceFingerprints.entries())) {
        for (const fp of fpList) {
          if (fp.webglHash === fingerprints.webglHash && fp.fontsHash === fingerprints.fontsHash) {
            return this.devices.get(deviceId) || null;
          }
        }
      }
    }

    return null;
  }

  async linkUserToDevice(userId: string, deviceId: string): Promise<void> {
    // Check if link already exists
    const userDevicesList = this.userDevices.get(userId) || [];
    
    if (!userDevicesList.includes(deviceId)) {
      userDevicesList.push(deviceId);
      this.userDevices.set(userId, userDevicesList);
    }

    // Increment device registration count
    const device = this.devices.get(deviceId);
    if (device) {
      device.registrations = (device.registrations || 0) + 1;
      this.devices.set(deviceId, device);
    }
  }

  async blockDevice(deviceId: string): Promise<void> {
    const device = this.devices.get(deviceId);
    if (device) {
      device.blocked = true;
      this.devices.set(deviceId, device);
    }
  }

  async allowlistDevice(deviceId: string, maxRegistrations: number = 2): Promise<void> {
    const device = this.devices.get(deviceId);
    if (device) {
      device.blocked = false;
      device.registrations = 0; // Reset registrations for allowlisted device
      this.devices.set(deviceId, device);
    }
  }

  async resetDeviceRegistrations(deviceId: string): Promise<void> {
    // Find device by serverDeviceId
    const deviceIdByServer = this.devicesByServerDeviceId.get(deviceId);
    if (deviceIdByServer) {
      const device = this.devices.get(deviceIdByServer);
      if (device) {
        device.registrations = 0; // Reset registrations to allow new account creation
        this.devices.set(deviceIdByServer, device);
      }
    }
    
    // Also check if deviceId is a direct device ID
    const device = this.devices.get(deviceId);
    if (device) {
      device.registrations = 0;
      this.devices.set(deviceId, device);
    }
  }

  // Referral code methods - stub implementations for testing
  async generateReferralCodes(userId: string, count: number): Promise<ReferralCode[]> {
    // Return empty array for testing - actual implementation in DatabaseStorage
    return [];
  }

  async getUserReferralCodes(userId: string): Promise<ReferralCode[]> {
    // Return empty array for testing
    return [];
  }

  async getReferralCodeByCode(code: string): Promise<ReferralCode | null> {
    // Return null for testing
    return null;
  }

  async markReferralCodeUsed(code: string, usedBy: string): Promise<void> {
    // No-op for testing
    return;
  }

  async checkAndGenerateReferralCodes(userId: string, newHashrate: number): Promise<ReferralCode[]> {
    // Return empty array for testing
    return [];
  }

  // Referral reward methods - stub implementations for testing
  async createReferralReward(reward: InsertReferralReward): Promise<ReferralReward> {
    // Return a mock referral reward for testing
    const mockReward: ReferralReward = {
      id: 'mock-reward-' + Date.now(),
      referrerId: reward.referrerId,
      referredUserId: reward.referredUserId,
      usdtReward: reward.usdtReward || '0',
      hashReward: reward.hashReward || '0',
      purchaseAmount: reward.purchaseAmount || '0',
      purchaseHashrate: reward.purchaseHashrate || '0',
      isClaimed: false,
      claimedAt: null,
      createdAt: new Date()
    };
    return mockReward;
  }

  async getUserUnclaimedRewards(userId: string): Promise<ReferralReward[]> {
    // Return empty array for testing
    return [];
  }

  async getUserReferralSlots(userId: string): Promise<any[]> {
    // Return empty array for testing
    return [];
  }

  async claimReferralRewards(userId: string): Promise<{ usdtClaimed: string; hashClaimed: string; count: number }> {
    // Return zero values for testing
    return {
      usdtClaimed: '0',
      hashClaimed: '0',
      count: 0
    };
  }

  async getUserReferralStats(userId: string): Promise<{ totalCodes: number; usedCodes: number; totalUsdtEarned: string; totalHashEarned: string; pendingUsdtRewards: string; pendingHashRewards: string }> {
    // Return zero stats for testing
    return {
      totalCodes: 0,
      usedCodes: 0,
      totalUsdtEarned: '0',
      totalHashEarned: '0',
      pendingUsdtRewards: '0',
      pendingHashRewards: '0'
    };
  }

  async updateReferralRewardsOnPurchase(purchaserId: string, amount: number, hashrate: number): Promise<void> {
    // No-op for testing
    return;
  }

  // Additional methods for admin dashboard
  async generateReferralCode(userId: string): Promise<any> {
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    const newCode = {
      id: Math.random().toString(36),
      code,
      ownerId: userId,
      owner: this.users.get(userId),
      usedBy: null,
      usedByUser: null,
      isUsed: false,
      createdAt: new Date(),
      usedAt: null
    };
    
    // Store the code in memory (you may want to add a referralCodes array to track these)
    if (!this.referralCodes) {
      this.referralCodes = [];
    }
    this.referralCodes.push(newCode);
    
    return newCode;
  }

  async getAllReferralCodes(): Promise<any[]> {
    if (!this.referralCodes) {
      this.referralCodes = [];
    }
    
    return this.referralCodes.map(code => {
      let owner = undefined;
      let usedByUser = undefined;
      
      // Find owner using Map methods
      for (const [, user] of Array.from(this.users.entries())) {
        if (user.id === code.ownerId) {
          owner = user;
          break;
        }
      }
      
      // Find usedByUser if exists
      if (code.usedBy) {
        for (const [, user] of Array.from(this.users.entries())) {
          if (user.id === code.usedBy) {
            usedByUser = user;
            break;
          }
        }
      }
      
      return {
        ...code,
        owner,
        usedByUser: usedByUser || null
      };
    });
  }

  async getAllTransactions(): Promise<any[]> {
    const allTransactions = [];
    
    // Add all deposits
    for (const [, deposit] of Array.from(this.deposits.entries())) {
      const user = this.users.get(deposit.userId);
      allTransactions.push({
        ...deposit,
        type: 'deposit',
        user
      });
    }
    
    // Add all withdrawals  
    for (const [, withdrawal] of Array.from(this.withdrawals.entries())) {
      const user = this.users.get(withdrawal.userId);
      allTransactions.push({
        ...withdrawal,
        type: 'withdrawal',
        user
      });
    }
    
    // Sort by date descending
    return allTransactions.sort((a, b) => {
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }

  async getSetting(key: string): Promise<string | null> {
    // Find setting using Map methods
    for (const [, setting] of Array.from(this.systemSettings.entries())) {
      if (setting.key === key) {
        return setting.value;
      }
    }
    return null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    // Find existing setting
    let existingId: string | null = null;
    for (const [id, setting] of Array.from(this.systemSettings.entries())) {
      if (setting.key === key) {
        existingId = id;
        break;
      }
    }
    
    if (existingId) {
      const setting = this.systemSettings.get(existingId)!;
      setting.value = value;
      setting.updatedAt = new Date();
    } else {
      const newId = Math.random().toString(36);
      this.systemSettings.set(newId, {
        id: newId,
        key,
        value,
        updatedAt: new Date()
      });
    }
  }

  // Add missing deposit address methods for compatibility
  async bulkCreateAddresses(addresses: string[]): Promise<void> {
    // Memory storage doesn't need to store these addresses
    // Memory storage: Address creation not implemented
  }

  async deleteAddress(id: string): Promise<void> {
    // Memory storage doesn't track individual addresses by ID
    // Memory storage: Address deletion not implemented
  }

  async updateAddressStatus(id: string, isActive: boolean): Promise<void> {
    // Memory storage doesn't track address status
    // Memory storage: Address status update not implemented
  }

  async getAllActiveDepositAddresses(): Promise<any[]> {
    // Memory storage returns empty array for active addresses
    return [];
  }

  async fixDepositStatuses(): Promise<void> {
    // Fix any deposits with "approved" status - they should be "completed"
    let fixedCount = 0;
    
    for (const [depositId, deposit] of Array.from(this.deposits.entries())) {
      if (deposit.status === 'approved' as any) {
        // Update deposit status to completed
        deposit.status = 'completed';
        deposit.updatedAt = new Date();
        
        // Ensure user balance is updated if not already
        const user = this.users.get(deposit.userId);
        if (user) {
          // Check and update balance
          const depositAmount = parseFloat(deposit.amount);
          if (deposit.currency === 'BTC') {
            const currentBalance = parseFloat(user.btcBalance || "0");
            user.btcBalance = (currentBalance + depositAmount).toFixed(8);
          } else if (deposit.currency === 'USDT') {
            const currentBalance = parseFloat(user.usdtBalance || "0");
            user.usdtBalance = (currentBalance + depositAmount).toFixed(2);
          }
        }
        
        fixedCount++;
      }
    }
    
    // Fixed deposit statuses in memory storage
  }

  // Global index methods for O(1) mining calculations - NOT IMPLEMENTED IN MEMORY STORAGE
  async getGlobalMiningState(): Promise<{
    totalHashPower: string;
    globalRewardIndex: string;
    currentBlock: number;
    lastIndexUpdate: Date;
  }> {
    throw new Error('Not implemented in MemoryStorage');
  }

  async updateGlobalIndex(newIndex: string, blockNumber: number): Promise<void> {
    throw new Error('Not implemented in MemoryStorage');
  }

  async calculateUserPending(userId: string): Promise<string> {
    throw new Error('Not implemented in MemoryStorage');
  }

  async updateUserHashrate(userId: string, newHashrate: string): Promise<void> {
    throw new Error('Not implemented in MemoryStorage');
  }

  async getIndexAtBlock(blockNumber: number): Promise<string> {
    throw new Error('Not implemented in MemoryStorage');
  }

  async settleUserRewards(userId: string): Promise<string> {
    throw new Error('Not implemented in MemoryStorage');
  }

  async createMiningBlockWithIndex(blockNumber: number, reward: string, totalHashPower: string, cumulativeIndex: string): Promise<MiningBlock> {
    throw new Error('Not implemented in MemoryStorage');
  }

  // Deposit Address Management methods - NOT IMPLEMENTED IN MEMORY STORAGE
  async createDepositAddress(address: string): Promise<void> {
    throw new Error('Not implemented in MemoryStorage');
  }

  async assignDepositAddress(userId: string, currency: 'USDT' | 'BTC', network?: string): Promise<{
    address: string;
    assignedAt: Date;
    expiresAt: Date;
    isNewAssignment: boolean;
  }> {
    throw new Error('Not implemented in MemoryStorage');
  }

  async getUserAddressAssignment(userId: string, currency: 'USDT' | 'BTC', network?: string): Promise<any | null> {
    throw new Error('Not implemented in MemoryStorage');
  }

  async getRandomAvailableAddress(userId: string): Promise<{ 
    address: string | null; 
    canGetNewAddress: boolean; 
    hoursUntilNewAddress: number; 
  }> {
    throw new Error('Not implemented in MemoryStorage');
  }

  async releaseAddress(userId: string): Promise<void> {
    throw new Error('Not implemented in MemoryStorage');
  }

  async getDepositAddresses(): Promise<any[]> {
    throw new Error('Not implemented in MemoryStorage');
  }

  async fixDepositStatuses2(): Promise<void> {
    // Fix any deposits with wrong status
    for (const deposit of Array.from(this.deposits.values())) {
      if ((deposit.status as any) === 'approved') {
        deposit.status = 'completed';
        deposit.updatedAt = new Date();
      }
    }
  }

  // Missing methods for IStorage interface
  async getAllDeposits(): Promise<(Deposit & { user?: User })[]> {
    const allDeposits: (Deposit & { user?: User })[] = [];
    
    for (const deposit of Array.from(this.deposits.values())) {
      const user = this.users.get(deposit.userId);
      allDeposits.push({ ...deposit, user });
    }
    
    return allDeposits.sort((a, b) => 
      (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
    );
  }

  async getAllWithdrawals(): Promise<(Withdrawal & { user?: User })[]> {
    const allWithdrawals: (Withdrawal & { user?: User })[] = [];
    
    for (const withdrawal of Array.from(this.withdrawals.values())) {
      const user = this.users.get(withdrawal.userId);
      allWithdrawals.push({ ...withdrawal, user });
    }
    
    return allWithdrawals.sort((a, b) => 
      (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
    );
  }
}