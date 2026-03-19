import { Router } from "express";
import { z } from "zod";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { setupMining, forceGenerateBlock } from "./mining";
import type { Request, Response, NextFunction, Express } from "express";
import { insertDepositSchema, insertWithdrawalSchema, insertDeviceFingerprintSchema, users } from "@shared/schema";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import Decimal from "decimal.js";
import { db } from "./db";
import { eq, sql } from "drizzle-orm";
import { randomBytes, scrypt } from "crypto";
import { promisify } from "util";

const asyncScrypt = promisify(scrypt);

async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await asyncScrypt(pin, salt, 32) as Buffer;
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

async function verifyPin(pin: string, hashedPin: string): Promise<boolean> {
  try {
    const [saltHex, hashHex] = hashedPin.split(':');
    if (!saltHex || !hashHex) return false;
    const salt = Buffer.from(saltHex, 'hex');
    const hash = await asyncScrypt(pin, salt, 32) as Buffer;
    return hash.toString('hex') === hashHex;
  } catch {
    return false;
  }
}

export async function registerRoutes(app: Express) {
  // Setup authentication first
  setupAuth(app);
  
  // DISABLED: Node.js mining engine - using Go backend as single source of truth
  // setupMining();
  
  // Create HTTP server
  const server = createServer(app);
  
  // WebSocket proxy to forward to Go backend
  const wss = new WebSocketServer({ noServer: true });
  
  // Handle WebSocket upgrade requests
  server.on('upgrade', (request, socket, head) => {
    if (request.url === '/api/ws') {
      // Proxy WebSocket to Go backend on port 8080
      const goBackendUrl = 'ws://localhost:8080/api/ws';
      
      try {
        const goWs = new WebSocket(goBackendUrl);
        
        goWs.on('open', () => {
          wss.handleUpgrade(request, socket, head, (ws) => {
            // Bridge between client WebSocket and Go backend WebSocket
            ws.on('message', (data) => {
              if (goWs.readyState === WebSocket.OPEN) {
                goWs.send(data);
              }
            });
            
            goWs.on('message', (data) => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(data);
              }
            });
            
            ws.on('close', () => {
              goWs.close();
            });
            
            goWs.on('close', () => {
              ws.close();
            });
            
            ws.on('error', (error) => {
              console.error('Client WebSocket error:', error);
              goWs.close();
            });
            
            goWs.on('error', (error) => {
              console.error('Go backend WebSocket error:', error);
              ws.close();
            });
          });
        });
        
        goWs.on('error', (error) => {
          console.error('Failed to connect to Go backend WebSocket:', error);
          socket.end('HTTP/1.1 502 Bad Gateway\r\n\r\n');
        });
      } catch (error) {
        console.error('WebSocket proxy error:', error);
        socket.end('HTTP/1.1 500 Internal Server Error\r\n\r\n');
      }
    }
  });
  
  // Device fingerprinting endpoints
  app.post("/api/device/check", async (req, res, next) => {
    try {
      const deviceCheckSchema = z.object({
        serverDeviceId: z.string().min(1),
        fingerprints: insertDeviceFingerprintSchema.omit({ deviceId: true })
      });
      
      const { serverDeviceId, fingerprints } = deviceCheckSchema.parse(req.body);
      
      // Get client IP and basic network info
      const clientIp = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for']?.toString().split(',')[0];
      
      // Check device and determine if it can register
      const result = await storage.upsertDevice({
        serverDeviceId,
        lastIp: clientIp,
        fingerprints: {
          ...fingerprints,
          deviceId: '' // Will be set by storage
        }
      });
      
      res.json({
        deviceId: result.device.id,
        canRegister: result.canRegister,
        registrations: result.device.registrations,
        blocked: result.device.blocked,
        riskScore: result.device.riskScore
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Invalid device data format",
          errors: error.errors 
        });
      }
      next(error);
    }
  });

  app.post("/api/device/link", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const linkSchema = z.object({
        deviceId: z.string().min(1)
      });
      
      const { deviceId } = linkSchema.parse(req.body);
      
      // Link user to device (called after successful registration)
      await storage.linkUserToDevice(req.user!.id, deviceId);
      
      res.json({ success: true });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Invalid device ID format" 
        });
      }
      next(error);
    }
  });

  // Admin device management endpoints
  app.post("/api/admin/device/:deviceId/block", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user!.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { deviceId } = req.params;
      await storage.blockDevice(deviceId);
      
      res.json({ success: true, message: "Device has been blocked" });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/device/:deviceId/allowlist", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user!.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const allowlistSchema = z.object({
        maxRegistrations: z.number().min(1).max(10).optional().default(2)
      });
      
      const { maxRegistrations } = allowlistSchema.parse(req.body);
      const { deviceId } = req.params;
      
      await storage.allowlistDevice(deviceId, maxRegistrations);
      
      res.json({ 
        success: true, 
        message: `Device has been allowlisted with ${maxRegistrations} max registrations` 
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Invalid allowlist parameters" 
        });
      }
      next(error);
    }
  });
  
  // Get user endpoint with hash zeroing for suspended/frozen users
  app.get("/api/user", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const userId = req.user!.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // If user is frozen or mining suspended, zero out hash power in response only
      // This preserves the original values for when the user is unfrozen
      if (user.isFrozen === true || user.miningSuspended === true) {
        // Log for debugging
        if (user.isFrozen || user.miningSuspended) {
          console.log(`Frozen/suspended user ${user.username} logged in - mining/rewards suspended`);
        }
        
        res.json({
          ...user,
          hashPower: "0.00",
          baseHashPower: "0.00",
          referralHashBonus: "0.00",
          lockedHashPower: "0.00",
          nextBlockHashPower: "0.00"
        });
      } else {
        res.json(user);
      }
    } catch (error) {
      next(error);
    }
  });
  
  // Get wallet balances with proper decimal precision
  app.get("/api/wallet/balances", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const userId = req.user!.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get pending transactions
      const deposits = await storage.getUserDeposits(userId);
      const withdrawals = await storage.getUserWithdrawals(userId);
      const unclaimedBlocks = await storage.getUnclaimedBlocks(userId);

      // Calculate pending amounts using Decimal for precision
      let pendingUsdtDeposits = new Decimal(0);
      let pendingBtcDeposits = new Decimal(0);
      let pendingUsdtWithdrawals = new Decimal(0);
      let pendingBtcWithdrawals = new Decimal(0);
      let pendingB2bWithdrawals = new Decimal(0);
      let unclaimedB2b = new Decimal(0);

      // Calculate pending deposits - filter by currency server-side
      for (const deposit of deposits) {
        if (deposit.status === 'pending') {
          if (deposit.currency === 'BTC') {
            pendingBtcDeposits = pendingBtcDeposits.plus(deposit.amount || 0);
          } else if (deposit.currency === 'USDT') {
            pendingUsdtDeposits = pendingUsdtDeposits.plus(deposit.amount || 0);
          }
        }
      }

      // Calculate pending withdrawals - filter by currency server-side
      for (const withdrawal of withdrawals) {
        if (withdrawal.status === 'pending') {
          if (withdrawal.currency === 'BTC') {
            pendingBtcWithdrawals = pendingBtcWithdrawals.plus(withdrawal.amount || 0);
          } else if (withdrawal.currency === 'B2B') {
            pendingB2bWithdrawals = pendingB2bWithdrawals.plus(withdrawal.amount || 0);
          } else if (withdrawal.currency === 'USDT') {
            pendingUsdtWithdrawals = pendingUsdtWithdrawals.plus(withdrawal.amount || 0);
          }
        }
      }

      // Calculate unclaimed B2B rewards
      for (const block of unclaimedBlocks) {
        unclaimedB2b = unclaimedB2b.plus(block.reward || 0);
      }

      // Calculate available balances (balance - pending withdrawals) using Decimal
      const usdtBalance = new Decimal(user.usdtBalance || "0");
      const btcBalance = new Decimal(user.btcBalance || "0");
      const b2bBalance = new Decimal(user.b2bBalance || "0");
      
      // Available balance is total balance minus pending withdrawals
      const availableUsdt = Decimal.max(0, usdtBalance.minus(pendingUsdtWithdrawals));
      const availableBtc = Decimal.max(0, btcBalance.minus(pendingBtcWithdrawals));
      const availableB2b = Decimal.max(0, b2bBalance.minus(pendingB2bWithdrawals));

      // Convert to strings only at final output to preserve precision
      // Return flat object structure that client expects
      res.json({
        btcBalance: user.btcBalance || "0",
        usdtBalance: user.usdtBalance || "0",
        b2bBalance: user.b2bBalance || "0"
      });
    } catch (error) {
      next(error);
    }
  });

  // Get deposit cooldown status
  app.get("/api/deposits/cooldown", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const cooldown = await storage.getDepositCooldown(req.user!.id);
      res.json(cooldown);
    } catch (error) {
      next(error);
    }
  });

  // Get withdrawal cooldown status
  app.get("/api/withdrawals/cooldown", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const cooldown = await storage.getWithdrawalCooldown(req.user!.id);
      res.json(cooldown);
    } catch (error) {
      next(error);
    }
  });

  // Get all users (admin only)
  app.get("/api/users", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user!.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      next(error);
    }
  });
  
  // Admin endpoint to force-generate blocks for testing
  app.post("/api/admin/force-generate-blocks", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user!.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { count = 1 } = req.body;
      const blocksToGenerate = Math.min(Math.max(1, parseInt(count) || 1), 50);

      for (let i = 0; i < blocksToGenerate; i++) {
        await forceGenerateBlock();
        if (i < blocksToGenerate - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      res.json({ success: true, message: `Generated ${blocksToGenerate} block(s) successfully` });
    } catch (error) {
      next(error);
    }
  });

  // Admin endpoint to fix deposit statuses
  app.post("/api/admin/fix-deposit-statuses", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user!.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      // Run the fix for existing deposits with incorrect status
      await storage.fixDepositStatuses();
      
      res.json({ 
        success: true, 
        message: "Deposit statuses have been fixed. Any deposits with 'approved' status have been updated to 'completed' and balances adjusted." 
      });
    } catch (error) {
      next(error);
    }
  });
  
  // Admin dashboard stats
  app.get("/api/admin/stats", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user!.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const [userCount, totalDeposits, totalWithdrawals, totalHashPower] = await Promise.all([
        storage.getUserCount(),
        storage.getTotalDeposits(),
        storage.getTotalWithdrawals(),
        storage.getTotalHashPower()
      ]);

      res.json({
        userCount,
        totalDeposits,
        totalWithdrawals,
        totalHashPower
      });
    } catch (error) {
      next(error);
    }
  });

  // Get all users with details for admin
  app.get("/api/admin/users", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user!.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      next(error);
    }
  });

  // Get active miners (actively mining users)
  app.get("/api/admin/miners/active", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user!.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const users = await storage.getAllUsers();
      // Filter for active miners: hashPower > 0, hasStartedMining = true, not banned, not frozen
      const activeMiners = users.filter(user => {
        const hashPower = parseFloat(user.hashPower || "0");
        return hashPower > 0 && 
               user.hasStartedMining === true && 
               user.isBanned !== true && 
               user.isFrozen !== true;
      });

      res.json(activeMiners);
    } catch (error) {
      next(error);
    }
  });

  // Get inactive miners (have hash power but not mining)
  app.get("/api/admin/miners/inactive", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user!.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const users = await storage.getAllUsers();
      // Filter for inactive miners: hashPower > 0 BUT (hasStartedMining = false OR frozen = true)
      const inactiveMiners = users.filter(user => {
        const hashPower = parseFloat(user.hashPower || "0");
        return hashPower > 0 && 
               (user.hasStartedMining === false || user.isFrozen === true) &&
               user.isBanned !== true; // Exclude banned users from inactive list
      });

      res.json(inactiveMiners);
    } catch (error) {
      next(error);
    }
  });

  // Get default miners (only have base 100 KH/s)
  app.get("/api/admin/miners/default", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user!.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const users = await storage.getAllUsers();
      // Filter for default miners: hashPower = 100 or baseHashPower = 100 (only base, no additional)
      const defaultMiners = users.filter(user => {
        const hashPower = parseFloat(user.hashPower || "0");
        const baseHashPower = parseFloat(user.baseHashPower || "0");
        // Users with exactly 100 hash power and base hash power of 100 or 0
        return (hashPower === 100 && (baseHashPower === 100 || baseHashPower === 0)) ||
               (baseHashPower === 100 && hashPower === 100);
      });

      res.json(defaultMiners);
    } catch (error) {
      next(error);
    }
  });

  // Get all transactions for admin
  app.get("/api/admin/transactions", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user!.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const transactions = await storage.getAllTransactions();
      
      // Add userId field to each transaction for easier filtering
      const enhancedTransactions = transactions.map(t => ({
        ...t,
        userId: t.userId || (t.type === 'deposit' || t.type === 'withdrawal' ? t.userId : 
                t.type === 'transfer_out' ? t.fromUser : 
                t.type === 'transfer_in' ? t.toUser : null)
      }));
      
      res.json(enhancedTransactions);
    } catch (error) {
      next(error);
    }
  });

  // Get all referral codes for admin - REMOVED
  // The admin referrals feature has been removed from the admin dashboard
  /*
  app.get("/api/admin/referral-codes", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user!.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const codes = await storage.getAllReferralCodes();
      res.json(codes);
    } catch (error) {
      next(error);
    }
  });

  // Alias for referral codes - admin/referrals
  app.get("/api/admin/referrals", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user!.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const codes = await storage.getAllReferralCodes();
      res.json(codes);
    } catch (error) {
      next(error);
    }
  });
  */

  // Generate referral code for a user - DISABLED
  // This endpoint has been disabled as per request to prevent new referral code generation
  /*
  app.post("/api/admin/generate-referral-code", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user!.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { username } = req.body;
      if (!username) {
        return res.status(400).json({ message: "Username required" });
      }

      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const code = await storage.generateReferralCode(user.id);
      res.json(code);
    } catch (error) {
      next(error);
    }
  });
  */

  // Get system settings for admin
  app.get("/api/admin/system-settings", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user!.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const settings = {
        hashratePrice: await storage.getSetting("hashratePrice") || "1.00",
        miningPaused: await storage.getSetting("miningPaused") === "true",
        blockReward: await storage.getSetting("blockReward") || "50"
      };
      
      res.json(settings);
    } catch (error) {
      next(error);
    }
  });

  // Update hashrate price
  app.post("/api/admin/update-hashrate-price", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user!.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { price } = req.body;
      if (!price || isNaN(parseFloat(price))) {
        return res.status(400).json({ message: "Valid price required" });
      }

      await storage.setSetting("hashratePrice", price.toString());
      res.json({ success: true, price });
    } catch (error) {
      next(error);
    }
  });

  // Also support PUT method
  app.put("/api/admin/update-hashrate-price", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user!.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { price } = req.body;
      if (!price || isNaN(parseFloat(price))) {
        return res.status(400).json({ message: "Valid price required" });
      }

      await storage.setSetting("hashratePrice", price.toString());
      res.json({ success: true, price });
    } catch (error) {
      next(error);
    }
  });

  // Toggle global mining pause/resume
  app.post("/api/admin/toggle-global-mining", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user!.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { pause } = req.body;
      await storage.setSetting("miningPaused", pause ? "true" : "false");
      res.json({ success: true, paused: pause });
    } catch (error) {
      next(error);
    }
  });

  // Also support PUT method
  app.put("/api/admin/toggle-global-mining", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user!.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { pause } = req.body;
      await storage.setSetting("miningPaused", pause ? "true" : "false");
      res.json({ success: true, paused: pause });
    } catch (error) {
      next(error);
    }
  });

  // Suspend/Resume user mining
  app.patch("/api/admin/users/:userId/suspend-mining", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user!.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { userId } = req.params;
      await storage.updateUser(userId, { miningActive: false });
      res.json({ success: true, message: "User mining suspended" });
    } catch (error) {
      next(error);
    }
  });

  // Support PUT method
  app.put("/api/admin/users/:userId/suspend-mining", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user!.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { userId } = req.params;
      await storage.updateUser(userId, { miningActive: false });
      res.json({ success: true, message: "User mining suspended" });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/admin/users/:userId/resume-mining", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user!.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { userId } = req.params;
      await storage.updateUser(userId, { miningActive: true, miningSuspended: false, unclaimedBlocksCount: 0 });
      res.json({ success: true, message: "User mining resumed" });
    } catch (error) {
      next(error);
    }
  });

  // Support PUT method
  app.put("/api/admin/users/:userId/resume-mining", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user!.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { userId } = req.params;
      await storage.updateUser(userId, { miningActive: true, miningSuspended: false, unclaimedBlocksCount: 0 });
      res.json({ success: true, message: "User mining resumed" });
    } catch (error) {
      next(error);
    }
  });

  // Deposit endpoints
  app.post("/api/deposits", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const depositData = insertDepositSchema.parse(req.body);
      const deposit = await storage.createDeposit({
        ...depositData,
        userId: req.user!.id
      });

      res.status(201).json(deposit);
    } catch (error: any) {
      if (error?.message?.includes('wait')) {
        return res.status(429).json({ message: error.message });
      }
      if (error?.code === '23505' || error?.message?.includes('deposits_tx_hash_unique') || error?.message?.includes('unique constraint')) {
        return res.status(400).json({ message: "This transaction hash has already been submitted. Please check your transaction and try again with a different hash." });
      }
      next(error);
    }
  });

  app.get("/api/admin/deposits", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user!.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const deposits = await storage.getAllDeposits();
      res.json(deposits);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/withdrawals", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user!.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const withdrawals = await storage.getAllWithdrawals();
      res.json(withdrawals);
    } catch (error) {
      next(error);
    }
  });

  // Also support the route the frontend is using
  app.get("/api/deposits/pending", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user!.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const deposits = await storage.getPendingDeposits();
      res.json(deposits);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/deposits/:id/approve", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user!.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { adminNote, actualAmount } = req.body;
      await storage.approveDeposit(req.params.id, adminNote, actualAmount);
      res.json({ message: "Deposit approved" });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/deposits/:id/reject", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user!.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { adminNote } = req.body;
      await storage.rejectDeposit(req.params.id, adminNote);
      res.json({ message: "Deposit rejected" });
    } catch (error) {
      next(error);
    }
  });

  // Hash power purchase with referral commission
  app.post("/api/purchase-power", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { amount } = z.object({ amount: z.number().min(1) }).parse(req.body);
      const user = req.user!;

      if (parseFloat(user.usdtBalance || "0") < amount) {
        return res.status(400).json({ message: "Insufficient USDT balance" });
      }

      // Check if this is the user's first paid purchase
      const isFirstPaidPurchase = !user.hasPaidPurchase;

      // Deduct USDT and add base hash power to the user
      // 1 USDT = 100 KH/s = 0.1 hashPower in the system
      const purchasedHashPower = amount * 0.1; // Convert USDT to hashPower (1 USDT = 0.1 hashPower)
      const newUsdtBalance = (parseFloat(user.usdtBalance || "0") - amount).toFixed(2);
      const newBaseHashPower = (parseFloat(user.baseHashPower || "0") + purchasedHashPower).toFixed(2);
      
      // Calculate total hash power (base + referral bonus)
      const totalHashPower = (parseFloat(newBaseHashPower) + parseFloat(user.referralHashBonus || "0")).toFixed(2);

      // Update user with new hash power and mark as paid user
      await storage.updateUser(user.id, {
        usdtBalance: newUsdtBalance,
        baseHashPower: newBaseHashPower,
        hashPower: totalHashPower,
        hasPaidPurchase: true // Mark user as having made a paid purchase
      });

      // Generate referral codes if milestones reached (2000 KH/s = 5 codes)
      const purchasedHashPowerInKH = amount * 100; // 1 USDT = 100 KH/s
      const generatedCodes = await storage.checkAndGenerateReferralCodes(user.id, purchasedHashPowerInKH);

      // Handle referral rewards using the new system
      if (user.referredBy && user.hasPaidPurchase) {
        await storage.updateReferralRewardsOnPurchase(user.id, amount, purchasedHashPowerInKH);
      }

      // Legacy referral commission for backward compatibility (if still needed)
      if (user.referredBy) {
        const referrers = await storage.getUsersByReferralCode(user.referredBy);
        if (referrers.length > 0) {
          const referrer = referrers[0];
          
          // Calculate 5% hashrate boost for backward compatibility (different from new 10% system)
          const hashBoost = purchasedHashPower * 0.05; // 5% of purchased hash power for legacy system
          
          // If this is the user's FIRST paid purchase, also add retroactive bonus for the initial 100 KH/s
          let retroactiveBonus = 0;
          if (isFirstPaidPurchase && user.hasStartedMining) {
            // User got 100 KH/s (0.1) when they started, give referrer 5% of that now
            retroactiveBonus = 0.005; // 5% of 0.1 (100 KH/s)
          }
          
          // Add hash boost to referrer's referral bonus (including retroactive bonus if applicable)
          const totalHashBoost = hashBoost + retroactiveBonus;
          const referrerNewHashBonus = (parseFloat(referrer.referralHashBonus || "0") + totalHashBoost).toFixed(2);
          const referrerTotalHash = (parseFloat(referrer.baseHashPower || "0") + parseFloat(referrerNewHashBonus)).toFixed(2);
          
          await storage.updateUser(referrer.id, {
            referralHashBonus: referrerNewHashBonus,
            hashPower: referrerTotalHash
          });
        }
      }

      res.json({ 
        message: "Hash power purchased successfully",
        codesGenerated: generatedCodes.length 
      });
    } catch (error) {
      next(error);
    }
  });


  // Claim mining rewards with strict participation rules
  app.post("/api/claim-rewards", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = req.user!;
      
      // Check if user is frozen
      if (user.isFrozen) {
        return res.status(403).json({ message: "Your account is frozen. Mining and rewards are suspended." });
      }
      
      const unclaimedAmount = parseFloat(user.unclaimedBalance || "0");
      
      if (unclaimedAmount <= 0) {
        return res.status(400).json({ message: "No rewards to claim" });
      }

      // Get current block number
      const blockSetting = await storage.getSystemSetting("blockNumber");
      const currentBlock = blockSetting ? parseInt(blockSetting.value) : 1;

      const newB2bBalance = (parseFloat(user.b2bBalance || "0") + unclaimedAmount).toFixed(8);

      await storage.updateUser(user.id, {
        b2bBalance: newB2bBalance,
        unclaimedBalance: "0.00000000",
        lastActiveBlock: currentBlock // Update last active block
      });

      res.json({ message: "Rewards claimed successfully" });
    } catch (error) {
      next(error);
    }
  });

  // Start mining for the first time - gives FREE 100 KH/s to new users
  app.post("/api/start-mining", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = req.user!;
      
      // Check if user is frozen
      if (user.isFrozen) {
        return res.status(403).json({ message: "Your account is frozen. Mining and rewards are suspended." });
      }
      
      // Check if user has already started mining
      if (user.hasStartedMining) {
        return res.status(400).json({ message: "Mining already started" });
      }

      // Give FREE 100 KH/s (0.1 hashPower) to new users
      const freeHashPower = 0.1; // 100 KH/s = 0.1 in the system
      const newBaseHashPower = (parseFloat(user.baseHashPower || "0") + freeHashPower).toFixed(2);
      const newHashPower = (parseFloat(newBaseHashPower) + parseFloat(user.referralHashBonus || "0")).toFixed(2);

      // Update user with free hash power and mark as started
      await storage.updateUser(user.id, {
        baseHashPower: newBaseHashPower,
        hashPower: newHashPower,
        hasStartedMining: true
      });

      // IMPORTANT: NO referral bonus is given for free users
      // Referral bonuses are only given after the user makes a paid purchase
      // This prevents abuse of the referral system with fake/free accounts
      // The upline will receive the retroactive bonus when the user makes their first purchase

      res.json({ 
        message: "Mining started successfully! You've received 100 KH/s FREE bonus!",
        freeHashPower: "100 KH/s"
      });
    } catch (error) {
      next(error);
    }
  });

  // Get all miners globally
  app.get("/api/all-miners", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Get all users who are actively mining
      const allUsers = await storage.getAllUsers();
      const blockSetting = await storage.getSystemSetting("totalBlockHeight");
      const currentBlock = blockSetting ? parseInt(blockSetting.value) : 1;

      // Filter for active miners (have hash power and have mined recently)
      const activeMiners = allUsers.filter(user => {
        const hashPower = parseFloat(user.hashPower || "0");
        const lastActive = user.lastActiveBlock || 0;
        const blocksSinceActive = currentBlock - lastActive;
        // Consider active if they have hash power and mined in last 100 blocks
        return hashPower > 0 && user.hasStartedMining && blocksSinceActive < 100;
      });

      // Calculate total earnings (b2bBalance + unclaimedBalance)
      const minersWithEarnings = activeMiners.map(miner => ({
        id: miner.id,
        username: miner.username,
        hashPower: parseFloat(miner.hashPower || "0"),
        b2bBalance: miner.b2bBalance,
        usdtBalance: miner.usdtBalance,
        lastActiveBlock: miner.lastActiveBlock,
        referredBy: miner.referredBy,
        totalEarned: (parseFloat(miner.b2bBalance || "0") + parseFloat(miner.unclaimedBalance || "0")).toFixed(8),
        referralCount: allUsers.filter(u => u.referredBy === miner.referralCode).length
      }));

      // Sort by hash power descending
      minersWithEarnings.sort((a, b) => b.hashPower - a.hashPower);

      // Calculate total network hash power
      const totalHashPower = minersWithEarnings.reduce((sum, miner) => sum + miner.hashPower, 0);

      res.json({
        miners: minersWithEarnings,
        totalHashPower,
        totalActiveMiners: minersWithEarnings.length,
        currentBlock
      });
    } catch (error) {
      next(error);
    }
  });


  // Admin endpoint for all withdrawals
  app.get("/api/admin/withdrawals", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user!.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const withdrawals = await storage.getAllWithdrawals();
      res.json(withdrawals);
    } catch (error) {
      next(error);
    }
  });
  
  // Withdrawal endpoints
  app.post("/api/withdrawals", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const withdrawalData = insertWithdrawalSchema.parse(req.body);
      const withdrawal = await storage.createWithdrawal({
        ...withdrawalData,
        userId: req.user!.id
      });

      res.status(201).json(withdrawal);
    } catch (error: any) {
      if (error?.message?.includes('wait')) {
        return res.status(429).json({ message: error.message });
      }
      next(error);
    }
  });

  // Also support the route the frontend is using
  app.get("/api/withdrawals/pending", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user!.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const withdrawals = await storage.getPendingWithdrawals();
      res.json(withdrawals);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/withdrawals/:id/approve", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user!.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { txHash } = req.body;
      await storage.approveWithdrawal(req.params.id, txHash);
      res.json({ message: "Withdrawal approved" });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/withdrawals/:id/reject", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user!.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      await storage.rejectWithdrawal(req.params.id);
      res.json({ message: "Withdrawal rejected" });
    } catch (error) {
      next(error);
    }
  });

  // Update user balances manually (admin only)
  app.patch("/api/users/:userId/balances", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user!.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { usdtBalance, b2bBalance, hashPower } = req.body;
      
      // Validate and only update fields with actual numeric values (skip empty strings and null)
      const validatedBalances: any = {};
      
      if (usdtBalance !== undefined && usdtBalance !== "" && usdtBalance !== null) {
        validatedBalances.usdtBalance = usdtBalance;
        if (isNaN(parseFloat(validatedBalances.usdtBalance))) {
          return res.status(400).json({ message: "Invalid USDT balance value" });
        }
      }
      
      if (b2bBalance !== undefined && b2bBalance !== "" && b2bBalance !== null) {
        validatedBalances.b2bBalance = b2bBalance;
        if (isNaN(parseFloat(validatedBalances.b2bBalance))) {
          return res.status(400).json({ message: "Invalid B2B balance value" });
        }
      }
      
      if (hashPower !== undefined && hashPower !== "" && hashPower !== null) {
        validatedBalances.hashPower = hashPower;
        if (isNaN(parseFloat(validatedBalances.hashPower))) {
          return res.status(400).json({ message: "Invalid hash power value" });
        }
      }
      
      await storage.updateUserBalances(req.params.userId, validatedBalances);
      
      res.json({ message: "User balances updated successfully" });
    } catch (error) {
      next(error);
    }
  });

  // Alias for admin user balance update
  app.patch("/api/admin/users/:userId/balances", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user!.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { usdt, btc, b2b, hashPower } = req.body;
      
      // Validate and only update fields with actual numeric values (skip empty strings and null)
      const validatedBalances: any = {};
      
      if (usdt !== undefined && usdt !== "" && usdt !== null) {
        validatedBalances.usdtBalance = usdt;
        if (isNaN(parseFloat(validatedBalances.usdtBalance))) {
          return res.status(400).json({ message: "Invalid USDT balance value" });
        }
      }
      
      if (btc !== undefined && btc !== "" && btc !== null) {
        // Handle BTC balance update
        const btcValue = btc;
        if (isNaN(parseFloat(btcValue))) {
          return res.status(400).json({ message: "Invalid BTC balance value" });
        }
        await storage.updateUserBtcBalance(req.params.userId, btcValue);
      }
      
      if (b2b !== undefined && b2b !== "" && b2b !== null) {
        validatedBalances.b2bBalance = b2b;
        if (isNaN(parseFloat(validatedBalances.b2bBalance))) {
          return res.status(400).json({ message: "Invalid B2B balance value" });
        }
      }
      
      if (hashPower !== undefined && hashPower !== "" && hashPower !== null) {
        validatedBalances.hashPower = hashPower;
        if (isNaN(parseFloat(validatedBalances.hashPower))) {
          return res.status(400).json({ message: "Invalid hash power value" });
        }
      }
      
      // Only update if there are balances to update
      if (Object.keys(validatedBalances).length > 0) {
        await storage.updateUserBalances(req.params.userId, validatedBalances);
      }
      
      res.json({ message: "User balances updated successfully" });
    } catch (error) {
      next(error);
    }
  });
  
  // Also support PUT method for balance update
  app.put("/api/admin/users/:userId/balances", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user!.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { usdt, btc, b2b, hashPower } = req.body;
      
      // Validate and only update fields with actual numeric values (skip empty strings and null)
      const validatedBalances: any = {};
      
      if (usdt !== undefined && usdt !== "" && usdt !== null) {
        validatedBalances.usdtBalance = usdt;
        if (isNaN(parseFloat(validatedBalances.usdtBalance))) {
          return res.status(400).json({ message: "Invalid USDT balance value" });
        }
      }
      
      if (btc !== undefined && btc !== "" && btc !== null) {
        // Handle BTC balance update
        const btcValue = btc;
        if (isNaN(parseFloat(btcValue))) {
          return res.status(400).json({ message: "Invalid BTC balance value" });
        }
        await storage.updateUserBtcBalance(req.params.userId, btcValue);
      }
      
      if (b2b !== undefined && b2b !== "" && b2b !== null) {
        validatedBalances.b2bBalance = b2b;
        if (isNaN(parseFloat(validatedBalances.b2bBalance))) {
          return res.status(400).json({ message: "Invalid B2B balance value" });
        }
      }
      
      if (hashPower !== undefined && hashPower !== "" && hashPower !== null) {
        validatedBalances.hashPower = hashPower;
        if (isNaN(parseFloat(validatedBalances.hashPower))) {
          return res.status(400).json({ message: "Invalid hash power value" });
        }
      }
      
      // Only update if there are balances to update
      if (Object.keys(validatedBalances).length > 0) {
        await storage.updateUserBalances(req.params.userId, validatedBalances);
      }
      
      res.json({ message: "User balances updated successfully" });
    } catch (error) {
      next(error);
    }
  });

  // System settings
  app.get("/api/settings/:key", async (req, res, next) => {
    try {
      const setting = await storage.getSystemSetting(req.params.key);
      res.json(setting);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/settings", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user!.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { key, value } = z.object({
        key: z.string(),
        value: z.string()
      }).parse(req.body);

      await storage.setSystemSetting(key, value);
      res.json({ message: "Setting updated" });
    } catch (error) {
      next(error);
    }
  });

  // User management
  app.patch("/api/users/:id/freeze", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user!.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      await storage.freezeUser(req.params.id);
      res.json({ message: "User frozen" });
    } catch (error) {
      next(error);
    }
  });

  // Support PUT method
  app.put("/api/users/:id/freeze", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user!.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      await storage.freezeUser(req.params.id);
      res.json({ message: "User frozen" });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/users/:id/unfreeze", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user!.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      await storage.unfreezeUser(req.params.id);
      res.json({ message: "User unfrozen" });
    } catch (error) {
      next(error);
    }
  });

  // Support PUT method
  app.put("/api/users/:id/unfreeze", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user!.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      await storage.unfreezeUser(req.params.id);
      res.json({ message: "User unfrozen" });
    } catch (error) {
      next(error);
    }
  });

  // Ban/unban user endpoints
  app.patch("/api/users/:userId/ban", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user!.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      await storage.banUser(req.params.userId);
      res.json({ message: "User banned successfully" });
    } catch (error) {
      next(error);
    }
  });

  // Support PUT method
  app.put("/api/users/:userId/ban", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user!.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      await storage.banUser(req.params.userId);
      res.json({ message: "User banned successfully" });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/users/:userId/unban", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user!.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      await storage.unbanUser(req.params.userId);
      res.json({ message: "User unbanned successfully" });
    } catch (error) {
      next(error);
    }
  });

  // Support PUT method
  app.put("/api/users/:userId/unban", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user!.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      await storage.unbanUser(req.params.userId);
      res.json({ message: "User unbanned successfully" });
    } catch (error) {
      next(error);
    }
  });

  // Get global deposit addresses (public endpoint for all users)
  app.get("/api/deposit-addresses", async (req, res, next) => {
    try {
      const usdtAddress = await storage.getGlobalDepositAddress('USDT');
      const btcAddress = await storage.getGlobalDepositAddress('BTC');
      
      res.json({ usdt: usdtAddress, btc: btcAddress });
    } catch (error) {
      next(error);
    }
  });

  // DEPRECATED: This endpoint is now secured and should not expose the entire address pool
  // Use POST /api/deposit-addresses/assign instead
  app.get("/api/deposit-addresses/all", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // SECURITY: Don't expose the entire address pool to clients
      // Instead, return an error directing them to use the new endpoint
      return res.status(403).json({ 
        message: "This endpoint is deprecated for security reasons. Use POST /api/deposit-addresses/assign instead" 
      });
    } catch (error) {
      next(error);
    }
  });

  // Assign a deposit address to a user with 24-hour cooldown
  app.post("/api/deposit-addresses/assign", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const assignSchema = z.object({
        currency: z.enum(['USDT', 'BTC']),
        network: z.string().optional() // 'ERC20', 'BSC' for USDT, null/undefined for BTC
      });

      const { currency, network } = assignSchema.parse(req.body);
      const userId = req.user!.id;

      // Validate network for currency
      if (currency === 'USDT' && network && !['ERC20', 'BSC'].includes(network)) {
        return res.status(400).json({ 
          message: "Invalid network for USDT. Must be 'ERC20' or 'BSC'" 
        });
      }

      if (currency === 'BTC' && network) {
        return res.status(400).json({ 
          message: "BTC does not support network selection" 
        });
      }

      // Assign or retrieve existing address with cooldown
      const assignment = await storage.assignDepositAddress(userId, currency, network);

      res.json({
        address: assignment.address,
        assignedAt: assignment.assignedAt.toISOString(),
        expiresAt: assignment.expiresAt.toISOString(),
        isNewAssignment: assignment.isNewAssignment,
        currency,
        network
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Invalid request format",
          errors: error.errors 
        });
      }
      next(error);
    }
  });
  
  // Deposit Address Management endpoints
  
  // Get user's deposit address with 24-hour cooldown mechanism
  // Users can only get a new address once every 24 hours
  app.get("/api/deposit-address/get-random", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // This method now implements 24-hour cooldown:
      // - If user has an address assigned within last 24 hours, returns same address with cooldown info
      // - If cooldown expired or no recent assignment, releases old addresses and assigns new one
      // - Uses atomic operations to prevent race conditions
      const result = await storage.getRandomAvailableAddress(req.user!.id);
      
      if (!result.address) {
        return res.status(404).json({ 
          message: "No available deposit addresses. Please contact administrator." 
        });
      }

      // Success - return the address with cooldown status
      res.json({
        address: result.address,
        canGetNewAddress: result.canGetNewAddress,
        hoursUntilNewAddress: result.hoursUntilNewAddress
      });
    } catch (error) {
      // Log critical errors for debugging
      console.error('Error in deposit address assignment:', error);
      next(error);
    }
  });

  // Admin: Get all deposit addresses
  app.get("/api/admin/deposit-addresses", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user!.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const addresses = await storage.getDepositAddresses();
      res.json(addresses);
    } catch (error) {
      next(error);
    }
  });

  // Admin: Add single or bulk addresses
  app.post("/api/admin/deposit-addresses", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user!.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const addressSchema = z.object({
        address: z.string().regex(/^(0x[a-fA-F0-9]{40}|T[A-Za-z1-9]{33})$/, "Invalid address format"),
        addresses: z.array(z.string().regex(/^(0x[a-fA-F0-9]{40}|T[A-Za-z1-9]{33})$/)).optional()
      }).partial();

      const data = addressSchema.parse(req.body);

      if (data.addresses && data.addresses.length > 0) {
        // Bulk create
        await storage.bulkCreateAddresses(data.addresses);
        res.json({ 
          success: true, 
          message: `${data.addresses.length} addresses added successfully` 
        });
      } else if (data.address) {
        // Single create
        await storage.createDepositAddress(data.address);
        res.json({ 
          success: true, 
          message: "Address added successfully" 
        });
      } else {
        return res.status(400).json({ 
          message: "Either 'address' or 'addresses' must be provided" 
        });
      }
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Invalid address format. Must be valid ERC20/BSC (0x...) or TRON (T...) address",
          errors: error.errors 
        });
      }
      next(error);
    }
  });

  // Admin: Delete an address
  app.delete("/api/admin/deposit-addresses/:id", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user!.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { id } = req.params;
      await storage.deleteAddress(id);
      
      res.json({ 
        success: true, 
        message: "Address deleted successfully" 
      });
    } catch (error) {
      next(error);
    }
  });

  // Admin: Update address status
  app.patch("/api/admin/deposit-addresses/:id", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user!.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const statusSchema = z.object({
        isActive: z.boolean()
      });

      const { id } = req.params;
      const { isActive } = statusSchema.parse(req.body);
      
      await storage.updateAddressStatus(id, isActive);
      
      res.json({ 
        success: true, 
        message: `Address ${isActive ? 'activated' : 'deactivated'} successfully` 
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Invalid status. Must be a boolean value.",
          errors: error.errors 
        });
      }
      next(error);
    }
  });

  // Admin: Bulk action on addresses (activate/deactivate)
  app.post("/api/admin/deposit-addresses/bulk-action", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user!.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const bulkActionSchema = z.object({
        action: z.enum(["activate", "deactivate"]),
        addressIds: z.array(z.string()).min(1, "At least one address ID required")
      });

      const data = bulkActionSchema.parse(req.body);
      const isActive = data.action === "activate";
      
      // Update each address status
      let updated = 0;
      for (const addressId of data.addressIds) {
        try {
          await storage.updateAddressStatus(addressId, isActive);
          updated++;
        } catch (err) {
          console.error(`Failed to update address ${addressId}:`, err);
        }
      }
      
      res.json({ 
        success: true,
        updated,
        message: `Successfully ${data.action}d ${updated} out of ${data.addressIds.length} addresses` 
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Invalid request body",
          errors: error.errors 
        });
      }
      next(error);
    }
  });

  // Admin-only endpoint to manage global deposit addresses (for backwards compatibility)
  app.post("/api/admin/deposit-address", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user!.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { currency, address } = z.object({
        currency: z.enum(['USDT', 'BTC']),
        address: z.string()
      }).parse(req.body);

      await storage.setGlobalDepositAddress(currency, address);
      res.json({ message: `${currency} deposit address updated successfully` });
    } catch (error) {
      next(error);
    }
  });
  
  // Get supply metrics
  app.get("/api/supply-metrics", async (req, res, next) => {
    try {
      const metrics = await storage.getSupplyMetrics();
      const totalHashPower = await storage.getTotalHashPower();
      res.json({ ...metrics, totalHashrate: parseFloat(totalHashPower) });
    } catch (error) {
      next(error);
    }
  });
  
  // Get global mining stats
  app.get("/api/global-stats", async (req, res, next) => {
    try {
      const totalHashPower = await storage.getTotalHashPower();
      const blockHeight = await storage.getSystemSetting("blockNumber");
      const totalBlockHeight = await storage.getSystemSetting("totalBlockHeight");
      const activeMiners = await storage.getActiveMinerCount();
      const supplyMetrics = await storage.getSupplyMetrics();
      
      const currentBlock = blockHeight ? parseInt(blockHeight.value) : 1;
      const totalBlocks = totalBlockHeight ? parseInt(totalBlockHeight.value) : 0;
      
      res.json({
        totalHashrate: parseFloat(totalHashPower),
        blockHeight: currentBlock,
        totalBlockHeight: totalBlocks,
        activeMiners,
        blockReward: parseFloat(supplyMetrics.currentBlockReward),
        totalCirculation: parseFloat(supplyMetrics.circulating),
        maxSupply: 21000000,
        nextHalving: supplyMetrics.halvingProgress.nextHalving,
        blocksUntilHalving: supplyMetrics.halvingProgress.blocksRemaining
      });
    } catch (error) {
      next(error);
    }
  });
  
  // Get unclaimed blocks for current user
  app.get("/api/unclaimed-blocks", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const blocks = await storage.getUnclaimedBlocks(req.user!.id);
      res.json(blocks);
    } catch (error) {
      next(error);
    }
  });
  
  // Claim a single block
  app.post("/api/claim-block/:blockId", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Check if user is frozen
      if (req.user!.isFrozen) {
        return res.status(403).json({ message: "Your account is frozen. Mining and rewards are suspended." });
      }
      
      const result = await storage.claimBlock(req.params.blockId, req.user!.id);
      
      if (!result.success) {
        return res.status(400).json({ message: "Block not found or already claimed" });
      }
      
      if (result.suspended) {
        res.json({ 
          message: `You were suspended for missing 24+ blocks. You are now reactivated and will receive rewards from the next block.`,
          reward: result.reward,
          suspended: true
        });
      } else {
        res.json({ message: `Successfully claimed ${result.reward} B2B`, reward: result.reward });
      }
    } catch (error) {
      next(error);
    }
  });
  
  // Claim all blocks
  app.post("/api/claim-all-blocks", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Check if user is frozen
      if (req.user!.isFrozen) {
        return res.status(403).json({ message: "Your account is frozen. Mining and rewards are suspended." });
      }
      
      const result = await storage.claimAllBlocks(req.user!.id);
      
      if (result.count === 0) {
        return res.status(400).json({ message: "No blocks to claim" });
      }
      
      // Get current block number
      const blockSetting = await storage.getSystemSetting("totalBlockHeight");
      const currentBlock = blockSetting ? parseInt(blockSetting.value) : 1;

      // Update user's last active block
      await storage.updateUser(req.user!.id, {
        lastActiveBlock: currentBlock
      });

      if (result.suspended) {
        res.json({ 
          message: `You were suspended for missing 24+ blocks. You are now reactivated and will receive rewards from the next block. ${result.count} blocks claimed for ${result.totalReward} B2B`,
          count: result.count,
          totalReward: result.totalReward,
          suspended: true
        });
      } else {
        res.json({ 
          message: `Successfully claimed ${result.count} blocks for ${result.totalReward} B2B`,
          count: result.count,
          totalReward: result.totalReward
        });
      }
    } catch (error) {
      next(error);
    }
  });
  
  // New claim-all endpoint using the O(1) index-based reward calculation
  app.post("/api/mining/claim-all", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const userId = req.user!.id;
      
      // Check if user is frozen
      if (req.user!.isFrozen) {
        return res.status(403).json({ message: "Your account is frozen. Mining and rewards are suspended." });
      }
      
      // Calculate pending rewards using the global index (O(1) calculation)
      const pending = await storage.calculateUserPending(userId);
      const pendingFloat = parseFloat(pending);
      
      if (pendingFloat === 0) {
        return res.status(400).json({ 
          message: "No unclaimed rewards available",
          claimedAmount: "0",
          newBalance: req.user!.b2bBalance || "0"
        });
      }
      
      const globalState = await storage.getGlobalMiningState();
      
      // Claim rewards and update user state atomically
      await db.transaction(async (tx) => {
        // Add pending to balance and reset tracking
        await tx.update(users).set({
          b2bBalance: sql`COALESCE(b2b_balance, '0')::decimal + ${pending}::decimal`,
          accruedPending: "0",
          userIndex: globalState.globalRewardIndex,
          unclaimedBlocksCount: 0,
          miningSuspended: false,
          suspensionAtBlock: globalState.currentBlock + 24,
          lastActiveBlock: globalState.currentBlock
        }).where(eq(users.id, userId));
      });
      
      // Get updated user data for new balance
      const updatedUser = await storage.getUser(userId);
      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to retrieve updated balance" });
      }
      
      // Prepare response
      const wasMiningSuspended = req.user!.miningSuspended || false;
      let message: string;
      if (wasMiningSuspended) {
        message = `Mining reactivated! Claimed ${pendingFloat.toFixed(8)} B2B. You will now receive rewards from future blocks.`;
      } else {
        message = `Successfully claimed ${pendingFloat.toFixed(8)} B2B`;
      }
      
      res.json({
        message,
        claimedAmount: pending,
        newBalance: updatedUser.b2bBalance || "0",
        wasMiningSuspended
      });
      
    } catch (error) {
      console.error("Error in /api/mining/claim-all:", error);
      next(error);
    }
  });

  // Get user mining status
  app.get("/api/mining/status", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const status = await storage.getUserMiningStatus(req.user!.id);
      const user = req.user!;
      
      // Calculate time until next block (next hour)
      const now = new Date();
      const nextHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0, 0);
      const timeUntilNextBlock = Math.floor((nextHour.getTime() - now.getTime()) / 1000); // in seconds
      
      res.json({
        ...status,
        hashPower: user.hashPower || '0.00',
        lockedHashPower: user.lockedHashPower || '0.00',
        nextBlockHashPower: user.nextBlockHashPower || user.hashPower || '0.00',
        timeUntilNextBlock,
        currentBlockNumber: await storage.getSystemSetting("totalBlockHeight").then(s => s ? parseInt(s.value) : 0)
      });
    } catch (error) {
      next(error);
    }
  });
  
  // Get mining info
  app.get("/api/mining/info", async (req, res, next) => {
    try {
      const blockHeightSetting = await storage.getSystemSetting("totalBlockHeight");
      const blockRewardSetting = await storage.getSystemSetting("blockReward");
      const totalBlockHeight = blockHeightSetting ? parseInt(blockHeightSetting.value) : 0;
      const blockReward = blockRewardSetting ? parseFloat(blockRewardSetting.value) : 3200;
      
      const latestBlock = await storage.getLatestBlock();
      const totalMinedSupply = await storage.getTotalMinedSupply();
      const totalHashPower = await storage.getTotalHashPower();
      
      // Calculate next halving
      const HALVING_INTERVAL = 2160; // 3 months: 24 blocks/day × 90 days
      const blocksUntilHalving = HALVING_INTERVAL - (totalBlockHeight % HALVING_INTERVAL);
      const nextHalvingBlock = totalBlockHeight + blocksUntilHalving;
      
      // Calculate time until next block (next hour)
      const now = new Date();
      const nextHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0, 0);
      const timeUntilNextBlock = Math.floor((nextHour.getTime() - now.getTime()) / 1000); // in seconds
      
      // User-specific data if logged in
      let userMiningStatus = null;
      let userMiningHistory = null;
      
      if (req.isAuthenticated()) {
        userMiningStatus = await storage.getUserMiningStatus(req.user!.id);
        userMiningHistory = await storage.getUserMiningHistory(req.user!.id, 10);
      }
      
      res.json({
        blockHeight: totalBlockHeight,
        blockReward: blockReward.toFixed(8),
        totalHashPower,
        totalMinedSupply,
        globalHashrate: latestBlock?.globalHashrate || '0.00',
        blocksUntilHalving,
        nextHalvingBlock,
        timeUntilNextBlock,
        userMiningStatus,
        userMiningHistory,
        blockTime: 3600, // 1 hour in seconds
        blocksPerDay: 24,
        maxSupply: 21000000
      });
    } catch (error) {
      next(error);
    }
  });
  
  // Get user mining history
  app.get("/api/mining/history", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const history = await storage.getUserMiningHistory(req.user!.id, 50);
      res.json(history);
    } catch (error) {
      next(error);
    }
  });
  
  // Proxy to Go backend for unclaimed blocks
  app.get("/api/mining/unclaimed-blocks", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Forward request to Go backend
      const response = await fetch("http://localhost:8080/api/mining/unclaimed-blocks", {
        method: "GET",
        headers: {
          "X-User-ID": req.user!.id,
          "X-User-Name": req.user!.username
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Go backend error:", errorText);
        return res.status(response.status).json({ message: "Failed to fetch unclaimed blocks" });
      }
      
      const data = await response.json();
      res.json(data || []);
    } catch (error: any) {
      console.error("Error proxying to Go backend:", error);
      // Fallback to local storage if Go backend is unavailable
      try {
        const blocks = await storage.getUnclaimedBlocks(req.user!.id);
        res.json(blocks);
      } catch (fallbackError) {
        next(error);
      }
    }
  });
  
  // Admin endpoint to view miner statuses
  app.get("/api/admin/miners", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || !req.user!.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const miners = await storage.getMinersStatus();
      res.json(miners);
    } catch (error) {
      next(error);
    }
  });
  
  // Get user transactions
  app.get("/api/transactions", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const userId = req.user!.id;
      const [deposits, withdrawals, sentTransfers, receivedTransfers] = await Promise.all([
        storage.getUserDeposits(userId),
        storage.getUserWithdrawals(userId),
        storage.getSentTransfers(userId),
        storage.getReceivedTransfers(userId)
      ]);
      
      res.json({
        deposits,
        withdrawals,
        sentTransfers,
        receivedTransfers
      });
    } catch (error) {
      next(error);
    }
  });
  
  // Get cooldown status
  app.get("/api/cooldowns", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const userId = req.user!.id;
      const [depositCooldown, withdrawalCooldown] = await Promise.all([
        storage.getDepositCooldown(userId),
        storage.getWithdrawalCooldown(userId)
      ]);
      
      res.json({
        deposit: depositCooldown,
        withdrawal: withdrawalCooldown
      });
    } catch (error) {
      next(error);
    }
  });
  
  // Change PIN
  app.post("/api/change-pin", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { currentPin, newPin } = z.object({
        currentPin: z.string().optional(),
        newPin: z.string().length(6).regex(/^\d{6}$/, "PIN must be exactly 6 digits")
      }).parse(req.body);

      const freshUser = await storage.getUser(req.user!.id);
      if (!freshUser) return res.status(404).json({ message: "User not found" });

      // If PIN already set, verify current PIN before allowing change
      if (freshUser.securityPin) {
        if (!currentPin) {
          return res.status(400).json({ message: "Current PIN is required to change an existing PIN" });
        }
        const isValid = await verifyPin(currentPin, freshUser.securityPin);
        if (!isValid) {
          return res.status(400).json({ message: "Current PIN is incorrect" });
        }
      }

      const hashedNewPin = await hashPin(newPin);
      await db.update(users).set({ securityPin: hashedNewPin }).where(eq(users.id, req.user!.id));

      res.json({ message: "PIN changed successfully" });
    } catch (error) {
      next(error);
    }
  });

  // Verify PIN
  app.post("/api/verify-pin", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { pin } = z.object({ pin: z.string().length(6) }).parse(req.body);

      const freshUser = await storage.getUser(req.user!.id);
      if (!freshUser) return res.status(404).json({ message: "User not found" });

      if (!freshUser.securityPin) {
        return res.json({ valid: true, pinSet: false });
      }

      const isValid = await verifyPin(pin, freshUser.securityPin);
      res.json({ valid: isValid, pinSet: true });
    } catch (error) {
      next(error);
    }
  });

  // Get referral data with detailed tracking
  app.get("/api/referrals", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = req.user!;
      
      // Get user's referral code
      const referralCode = user.referralCode || user.username.toUpperCase().slice(0, 6);

      // Get all users referred by this user
      const referredUsers = await storage.getUsersByReferralCode(referralCode);
      
      // Calculate stats
      const totalReferrals = referredUsers.length;
      const activeReferrals = referredUsers.filter(u => parseFloat(u.baseHashPower || u.hashPower || "0") > 0).length;
      
      // Use the stored total referral earnings
      const totalEarnings = user.totalReferralEarnings || "0.00";

      // Format referral list with details
      const referrals = referredUsers.map(u => ({
        id: u.id,
        username: u.username,
        joinedAt: u.createdAt,
        status: parseFloat(u.baseHashPower || u.hashPower || "0") > 0 ? 'mining' : 'inactive',
        hashPower: u.baseHashPower || u.hashPower || "0",
        earned: "0.00" // Actual earnings are tracked in totalReferralEarnings on the referrer
      }));

      const referralData = {
        referralCode: referralCode,
        totalReferrals: totalReferrals,
        activeReferrals: activeReferrals,
        totalEarnings: totalEarnings,
        referrals: referrals
      };

      res.json(referralData);
    } catch (error) {
      next(error);
    }
  });
  
  // Transfer B2B
  app.post("/api/transfer", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const { toUsername, amount } = z.object({
        toUsername: z.string(),
        amount: z.string()
      }).parse(req.body);
      
      const transfer = await storage.createTransfer(req.user!.id, toUsername, amount);
      res.json({ message: "Transfer successful", transfer });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // BTC Staking endpoints
  
  // Get current BTC price and hashrate price
  app.get("/api/btc/prices", async (req, res, next) => {
    try {
      const btcPrice = await storage.getCurrentBtcPrice();
      const hashratePrice = await storage.getSystemHashratePrice();
      
      res.json({
        btcPrice,
        hashratePrice,
        requiredHashratePerBTC: btcPrice, // 1 BTC requires btcPrice amount of GH/s (since 1 GH/s = 1 USD)
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  });

  // Create BTC stake
  app.post("/api/btc/stake", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { btcAmount, months, apr } = z.object({
        btcAmount: z.string().refine(val => parseFloat(val) >= 0.1, "Minimum stake is 0.1 BTC"),
        months: z.number().optional().default(12),
        apr: z.number().optional().default(20)
      }).parse(req.body);

      const user = req.user!;
      const btcBalance = parseFloat(user.btcBalance || "0");
      const userHashPower = parseFloat(user.hashPower || "0");
      const btcPrice = await storage.getCurrentBtcPrice();
      
      // Check BTC balance
      if (btcBalance < parseFloat(btcAmount)) {
        return res.status(400).json({ message: "Insufficient BTC balance" });
      }

      // Calculate required hashrate (1 GH/s = 1 USD, so GH/s needed = BTC amount * BTC price)
      const requiredHashrate = parseFloat(btcAmount) * parseFloat(btcPrice);
      
      // Check if user has enough hashrate (but don't deduct it - mining continues!)
      if (userHashPower < requiredHashrate) {
        return res.status(400).json({ 
          message: `Insufficient hashrate. Need ${requiredHashrate} GH/s but you have ${userHashPower} GH/s` 
        });
      }

      // Create stake with dynamic lock period and APR
      const stake = await storage.createBtcStake(
        user.id,
        btcAmount,
        requiredHashrate.toString(),
        btcPrice,
        months,
        apr
      );

      // Only deduct BTC balance (NOT hashrate - mining continues!)
      const newBtcBalance = (btcBalance - parseFloat(btcAmount)).toFixed(8);
      await storage.updateUserBtcBalance(user.id, newBtcBalance);
      
      // DON'T deduct hashrate - mining continues to work normally!
      // The staked hashrate is tracked in the stake record but doesn't affect mining
      // Mining rewards continue based on full hashPower

      res.json({
        message: "BTC stake created successfully",
        stake,
        lockDuration: `${months} month${months !== 1 ? 's' : ''}`,
        aprRate: `${apr}%`,
        dailyReward: stake.dailyReward
      });
    } catch (error) {
      next(error);
    }
  });

  // Get user's BTC stakes
  app.get("/api/btc/stakes", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const stakes = await storage.getUserBtcStakes(req.user!.id);
      const btcPrice = await storage.getCurrentBtcPrice();

      res.json({
        stakes,
        currentBtcPrice: btcPrice,
        totalStaked: stakes.reduce((sum, s) => sum + parseFloat(s.btcAmount), 0).toFixed(8),
        totalDailyRewards: stakes.filter(s => s.status === 'active')
          .reduce((sum, s) => sum + parseFloat(s.dailyReward), 0).toFixed(8)
      });
    } catch (error) {
      next(error);
    }
  });

  // Get user's BTC balance
  app.get("/api/btc/balance", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const btcBalance = await storage.getUserBtcBalance(req.user!.id);
      res.json({ btcBalance });
    } catch (error) {
      next(error);
    }
  });

  // BTC deposit
  app.post("/api/btc/deposit", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const { txHash, amount } = z.object({
        txHash: z.string(),
        amount: z.string().refine(val => parseFloat(val) >= 0.0001, "Minimum deposit is 0.0001 BTC")
      }).parse(req.body);
      
      const deposit = await storage.createDeposit({
        txHash,
        amount,
        network: "BTC",
        userId: req.user!.id
      });
      
      res.json({ message: "BTC deposit submitted for approval", deposit });
    } catch (error: any) {
      if (error?.message?.includes('duplicate key')) {
        return res.status(400).json({ message: "Transaction hash already submitted" });
      }
      next(error);
    }
  });

  // BTC withdrawal
  app.post("/api/btc/withdraw", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const { amount, address } = z.object({
        amount: z.string().refine(val => {
          const amt = parseFloat(val);
          return amt >= 0.001 && amt <= 10;
        }, "Amount must be between 0.001 and 10 BTC"),
        address: z.string()
      }).parse(req.body);
      
      const user = req.user!;
      const btcBalance = parseFloat(user.btcBalance || "0");
      
      if (btcBalance < parseFloat(amount)) {
        return res.status(400).json({ message: "Insufficient BTC balance" });
      }
      
      const withdrawal = await storage.createWithdrawal({
        amount,
        address,
        network: "BTC",
        userId: user.id
      });
      
      // Deduct balance immediately
      const newBalance = (btcBalance - parseFloat(amount)).toFixed(8);
      await storage.updateUserBtcBalance(user.id, newBalance);
      
      res.json({ message: "BTC withdrawal request submitted", withdrawal });
    } catch (error) {
      next(error);
    }
  });

  // Get conversion history
  app.get("/api/conversions", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const btcConversions = await storage.getUserBtcConversions(req.user!.id);
    
    // Sort conversions by date
    const allConversions = btcConversions
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    res.json(allConversions);
  });

  // BTC/USDT Conversion endpoint
  app.post("/api/convert", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { fromCurrency, toCurrency, amount } = z.object({
        fromCurrency: z.enum(["BTC", "USDT"]),
        toCurrency: z.enum(["BTC", "USDT"]),
        amount: z.string().refine(val => parseFloat(val) > 0, "Amount must be positive")
      }).parse(req.body);

      const convertAmount = parseFloat(amount);
      const conversionFee = 0.0001; // 0.01% fee
      const btcPrice = parseFloat(await storage.getCurrentBtcPrice());

      let result = { 
        convertedAmount: "0", 
        fee: "0", 
        rate: btcPrice.toString() 
      };

      if (fromCurrency === "BTC" && toCurrency === "USDT") {
        // Convert BTC to USDT
        const btcBalance = parseFloat(user.btcBalance || "0");
        if (btcBalance < convertAmount) {
          return res.status(400).json({ message: "Insufficient BTC balance" });
        }

        const usdtValue = convertAmount * btcPrice;
        const fee = usdtValue * conversionFee;
        const finalAmount = usdtValue - fee;

        // Update balances
        const newBtcBalance = (btcBalance - convertAmount).toFixed(8);
        const newUsdtBalance = (parseFloat(user.usdtBalance || "0") + finalAmount).toFixed(2);
        
        await storage.updateUserBtcBalance(user.id, newBtcBalance);
        await storage.updateUser(user.id, { usdtBalance: newUsdtBalance });
        
        // Save conversion history
        await storage.createBtcConversion(
          user.id,
          fromCurrency,
          toCurrency,
          amount,
          finalAmount.toFixed(2),
          fee.toFixed(2),
          btcPrice.toString()
        );

        result = {
          convertedAmount: finalAmount.toFixed(2),
          fee: fee.toFixed(2),
          rate: btcPrice.toString()
        };
      } else if (fromCurrency === "USDT" && toCurrency === "BTC") {
        // Convert USDT to BTC
        const usdtBalance = parseFloat(user.usdtBalance || "0");
        if (usdtBalance < convertAmount) {
          return res.status(400).json({ message: "Insufficient USDT balance" });
        }

        const btcValue = convertAmount / btcPrice;
        const fee = btcValue * conversionFee;
        const finalAmount = btcValue - fee;

        // Update balances
        const newUsdtBalance = (usdtBalance - convertAmount).toFixed(2);
        const newBtcBalance = (parseFloat(user.btcBalance || "0") + finalAmount).toFixed(8);
        
        await storage.updateUser(user.id, { usdtBalance: newUsdtBalance });
        await storage.updateUserBtcBalance(user.id, newBtcBalance);
        
        // Save conversion history
        await storage.createBtcConversion(
          user.id,
          fromCurrency,
          toCurrency,
          amount,
          finalAmount.toFixed(8),
          fee.toFixed(8),
          btcPrice.toString()
        );

        result = {
          convertedAmount: finalAmount.toFixed(8),
          fee: fee.toFixed(8),
          rate: btcPrice.toString()
        };
      } else {
        return res.status(400).json({ message: "Invalid conversion pair. Only BTC/USDT conversions are supported." });
      }

      res.json({
        message: "Conversion successful",
        from: fromCurrency,
        to: toCurrency,
        amount: amount,
        ...result
      });
    } catch (error) {
      next(error);
    }
  });

  // Referral Code Endpoints
  
  // Get user's referral codes
  app.get("/api/referral/codes", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const codes = await storage.getUserReferralCodes(req.user!.id);
      res.json(codes);
    } catch (error) {
      next(error);
    }
  });

  // Get referral slots (referred users and their status)
  app.get("/api/referral/slots", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const slots = await storage.getUserReferralSlots(req.user!.id);
      res.json(slots);
    } catch (error) {
      next(error);
    }
  });

  // Claim referral rewards
  app.post("/api/referral/claim", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const result = await storage.claimReferralRewards(req.user!.id);
      
      if (result.count === 0) {
        return res.status(400).json({ message: "No rewards to claim" });
      }

      res.json({
        message: "Referral rewards claimed successfully",
        usdtClaimed: result.usdtClaimed,
        hashClaimed: result.hashClaimed,
        rewardsClaimed: result.count
      });
    } catch (error) {
      next(error);
    }
  });

  // Get referral statistics
  app.get("/api/referral/stats", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const stats = await storage.getUserReferralStats(req.user!.id);
      res.json(stats);
    } catch (error) {
      next(error);
    }
  });
  
  return server;
}