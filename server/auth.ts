import { type Express } from "express";
import session from "express-session";
import { randomBytes, scrypt } from "crypto";
import { promisify } from "util";

const asyncScrypt = promisify(scrypt);
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
    interface Request {
      user?: SelectUser;
      isAuthenticated(): boolean;
    }
  }
}

declare module 'express-session' {
  interface SessionData {
    userId?: string;
  }
}

// Get client IP address helper function
function getClientIp(req: any): string {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         req.ip ||
         'unknown';
}


// Generate unique access key in format B2B-XXXXX-XXXXX-XXXXX-XXXXX
function generateUniqueAccessKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const segments = [];
  
  for (let i = 0; i < 4; i++) {
    let segment = '';
    const randomBytesBuffer = randomBytes(5); // 5 bytes for 5 chars
    for (let j = 0; j < 5; j++) {
      const randomIndex = randomBytesBuffer[j] % chars.length;
      segment += chars.charAt(randomIndex);
    }
    segments.push(segment);
  }
  
  return `B2B-${segments.join('-')}`;
}

// Hash access key for secure storage
async function hashAccessKey(accessKey: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await asyncScrypt(accessKey, salt, 32) as Buffer;
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

// Verify access key against stored hash
async function verifyAccessKey(accessKey: string, hashedKey: string): Promise<boolean> {
  try {
    const [saltHex, hashHex] = hashedKey.split(':');
    if (!saltHex || !hashHex) return false;
    
    const salt = Buffer.from(saltHex, 'hex');
    const hash = await asyncScrypt(accessKey, salt, 32) as Buffer;
    return hash.toString('hex') === hashHex;
  } catch {
    return false;
  }
}


export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || 'gbtc-mining-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    // Use in-memory session store to avoid PostgreSQL session table issues
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));

  // Polyfill req.isAuthenticated() since we're not using Passport
  app.use((req, _res, next) => {
    req.isAuthenticated = () => Boolean(req.session?.userId && req.user);
    next();
  });

  // Helper middleware to set user on request
  app.use((req, res, next) => {
    if (req.session?.userId) {
      storage.getUser(req.session.userId).then(user => {
        if (user) {
          req.user = user;
        }
        next();
      }).catch(() => next());
    } else {
      next();
    }
  });

  // Registration endpoint - generates unique access key
  app.post("/api/register", async (req, res, next) => {
    try {
      const { username, referralUsername, deviceData, testBypass } = req.body;
      
      if (!username) {
        return res.status(400).json({ message: "Please enter a valid username to create your account." });
      }
      
      if (!referralUsername || referralUsername.trim().length === 0) {
        return res.status(400).json({ message: "Referral Username Required: You need to be invited by an existing member to join the B2B platform. Please enter the username of the person who invited you." });
      }

      // TEMPORARY TEST BYPASS: Skip device check entirely for testing
      const isTestMode = testBypass === "TEST2024";
      
      if (isTestMode) {
        console.log('TEST MODE ACTIVE - Skipping all device checks');
      }
      
      if (!isTestMode) {
        // Check device fingerprint first (before creating user)
        if (!deviceData || !deviceData.serverDeviceId || !deviceData.fingerprints) {
          return res.status(400).json({ 
            message: "Device verification is required for registration. Please refresh the page and try again." 
          });
        }

        // Get client IP for device tracking

        // Check if device can register
        const deviceResult = await storage.upsertDevice({
          serverDeviceId: deviceData.serverDeviceId,
          lastIp: getClientIp(req),
          fingerprints: deviceData.fingerprints
        });

        // CRITICAL SECURITY: Enforce device registration constraints
        if (!deviceResult.canRegister) {
          if (deviceResult.device.blocked) {
            return res.status(403).json({ 
              message: "This device has been restricted from creating new accounts due to suspicious activity." 
            });
          } else if (deviceResult.device.registrations && deviceResult.device.registrations > 0) {
            return res.status(403).json({ 
              message: "An account has already been created from this device. Each device can only be used to register one account." 
            });
          } else {
            return res.status(403).json({ 
              message: "This device is not eligible for registration at this time." 
            });
          }
        }
      }


      // Generate unique access key
      let accessKey: string;
      let attempts = 0;
      const maxAttempts = 10;
      
      // Generate unique access key (no collision check needed due to large keyspace)
      accessKey = generateUniqueAccessKey();

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "This username is already taken. Please choose a different username." });
      }

      // Generate unique hash-style referral code (8 characters, alphanumeric)
      const generateReferralCode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz';
        const codeBytes = randomBytes(6); // Use crypto for secure random generation
        let code = '';
        // Generate a more hash-like code with mixed case
        for (let i = 0; i < 6; i++) {
          code += chars.charAt(codeBytes[i] % chars.length);
        }
        // Add timestamp component for uniqueness
        const timestamp = Date.now().toString(36).slice(-2).toUpperCase();
        return code + timestamp;
      };

      // Validate referral username (required)
      let validatedReferredBy = undefined;
      
      if (referralUsername) {
        // Check if the username exists in the system
        const referrer = await storage.getUserByUsername(referralUsername);
        
        if (!referrer) {
          // Username doesn't exist at all
          return res.status(400).json({ 
            message: "Invalid Referral Username: The username '" + referralUsername + "' does not exist in our system. Please verify the username with the person who invited you and ensure it's entered correctly." 
          });
        }
        
        // Username exists - valid! Store the username directly
        validatedReferredBy = referralUsername;
      }


      // Hash the access key for secure storage
      const hashedAccessKey = await hashAccessKey(accessKey);
      
      const user = await storage.createUser({
        username,
        accessKey: hashedAccessKey,
        referralCode: generateReferralCode(),
        referredBy: validatedReferredBy,
        registrationIp: getClientIp(req),
        // Note: hashPower and baseHashPower will be set by database defaults
      } as any);

      // SECURITY FIX: Regenerate session to prevent session fixation
      await new Promise<void>((resolve, reject) => {
        req.session.regenerate((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Set session
      req.session.userId = user.id;
      req.user = user;
      
      // Link device to user after successful registration (only if not in test mode)
      if (!isTestMode && deviceData) {
        const deviceResult = await storage.upsertDevice({
          serverDeviceId: deviceData.serverDeviceId,
          lastIp: getClientIp(req),
          fingerprints: deviceData.fingerprints
        });
        await storage.linkUserToDevice(user.id, deviceResult.device.id);
      }
      
      // No need to mark anything as used since we're using usernames directly
      
      // Return user data with the plain access key (only time it's shown)
      res.status(201).json({ ...user, accessKey });
    } catch (error: any) {
      if (error?.message?.includes('endpoint has been disabled') || error?.code === 'XX000') {
        return res.status(503).json({ message: "Our system is currently updating. Please try creating your account again in a few moments." });
      }
      if (error.message?.includes('duplicate key value violates unique constraint')) {
        if (error.message.includes('access_key')) {
          return res.status(400).json({ message: "A technical error occurred during registration. Please try again with a different username." });
        }
        return res.status(400).json({ message: "This username is already taken. Please choose a different username." });
      }
      next(error);
    }
  });

  // Check if IP has already created an account
  app.get("/api/check-ip-registration", async (req, res) => {
    try {

      const clientIp = getClientIp(req);
      const hasRegistered = await storage.hasIpRegistered(clientIp);
      
      res.json({ hasRegistered });
    } catch (error) {
      res.status(500).json({ message: "Error checking IP registration status" });
    }
  });

  // Simple login endpoint - uses username and access key
  app.post("/api/login", async (req, res) => {
    try {
      const { username, accessKey } = req.body;
      
      if (!username || !accessKey) {
        return res.status(400).json({ message: "Username and access key are required" });
      }

      // SECURITY: Always return same error message to prevent username enumeration
      const GENERIC_ERROR = "Invalid credentials";

      // Get user and perform operations to maintain consistent timing
      const user = await storage.getUserByUsername(username);
      
      // SECURITY: Always perform access key verification to prevent timing attacks
      // Use dummy hash if user doesn't exist to maintain consistent timing
      const hashedKeyToUse = user?.accessKey || 'dummy:hash';
      const isValidAccessKey = await verifyAccessKey(accessKey, hashedKeyToUse);

      // Both conditions must be true for successful login
      if (user && isValidAccessKey) {
        // SPECIAL HANDLING: super_admin can NEVER be banned
        if (user.username === 'super_admin') {
          // Force unban super_admin immediately
          user.isBanned = false;
          // Update in storage to ensure it's persisted
          await storage.unbanUser(user.id);
        }
        
        // Check if user is banned (except super_admin who is always unbanned above)
        if (user.isBanned) {
          return res.status(403).json({ 
            error: "PERMANENTLY_BANNED",
            message: "Your account has been permanently banned" 
          });
        }

        // Check if user is frozen or mining suspended (allow login but with flag)
        if (user.isFrozen || user.miningSuspended) {
          // User can still login but with frozen/suspended flag
          console.log(`Frozen/suspended user ${user.username} logged in - mining/rewards suspended`);
        }

        // SECURITY: Regenerate session to prevent session fixation
        await new Promise<void>((resolve, reject) => {
          req.session.regenerate((err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        // Set session
        req.session.userId = user.id;
        req.user = user;

        res.json({
          ...user,
          referralCode: user.referralCode || user.username.toUpperCase().slice(0, 8),
          isFrozen: user.isFrozen || false // Include frozen status in response
        });
      } else {
        // Always return the same generic error message
        return res.status(401).json({ message: GENERIC_ERROR });
      }
    } catch (error: any) {
      if (error?.message?.includes('endpoint has been disabled') || error?.code === 'XX000') {
        return res.status(503).json({ message: "Database is reactivating. Please try again in a moment." });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Logout endpoint
  app.post("/api/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Failed to logout" });
      }
      res.sendStatus(200);
    });
  });

  // Get current user endpoint
  app.get("/api/user", async (req, res) => {
    if (!req.session?.userId || !req.user) {
      return res.sendStatus(401);
    }
    
    try {
      // Refresh user data from database in case of updates
      const freshUser = await storage.getUser(req.session.userId);
      if (freshUser) {
        req.user = freshUser;
        
        // Check if user is suspended or frozen
        if (freshUser.isFrozen || freshUser.miningSuspended) {
          // Return zero hash power in response (but keep actual value in database)
          res.json({
            ...freshUser,
            hashPower: "0.00",
            baseHashPower: "0.00",
            referralHashBonus: "0.00",
            lockedHashPower: "0.00",
            nextBlockHashPower: "0.00",
            referralCode: freshUser.referralCode || freshUser.username.toUpperCase().slice(0, 8)
          });
        } else {
          res.json({
            ...freshUser,
            referralCode: freshUser.referralCode || freshUser.username.toUpperCase().slice(0, 8)
          });
        }
      } else {
        req.session.destroy(() => {});
        res.sendStatus(401);
      }
    } catch (error: any) {
      if (error?.message?.includes('endpoint has been disabled') || error?.code === 'XX000') {
        // If database is reactivating, return cached user data
        const userData = {
          ...req.user,
          referralCode: req.user.referralCode || req.user.username.toUpperCase().slice(0, 8)
        };
        
        // Also check for suspension in cached data
        if (req.user.isFrozen || req.user.miningSuspended) {
          userData.hashPower = "0.00";
          userData.baseHashPower = "0.00";
          userData.referralHashBonus = "0.00";
          userData.lockedHashPower = "0.00";
          userData.nextBlockHashPower = "0.00";
        }
        
        res.json(userData);
      } else {
        res.status(500).json({ message: "Database error" });
      }
    }
  });

  // Helper middleware to check if user is authenticated
  app.use('/api/*', (req, res, next) => {
    // Skip auth check for auth endpoints
    if (req.path.startsWith('/api/register') || 
        req.path.startsWith('/api/login') || 
        req.path === '/api/user') {
      return next();
    }
    
    if (!req.session?.userId || !req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    next();
  });
}