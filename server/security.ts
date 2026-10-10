import { randomBytes, createHmac } from "crypto";

// ==========================================
// 1. RFC 6238 TOTP (Google Authenticator)
// ==========================================

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateBase32Secret(length = 20): string {
  const bytes = randomBytes(length);
  let result = "";
  for (let i = 0; i < bytes.length; i++) {
    result += BASE32_ALPHABET[bytes[i] % 32];
  }
  return result;
}

export function base32ToBuffer(base32Str: string): Buffer {
  const clean = base32Str.toUpperCase().replace(/=+$/, "");
  let bits = "";
  for (let i = 0; i < clean.length; i++) {
    const val = BASE32_ALPHABET.indexOf(clean[i]);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

export function generateTotpToken(secret: string, timeStep = 30, windowOffset = 0): string {
  try {
    const counter = Math.floor(Date.now() / 1000 / timeStep) + windowOffset;
    const buffer = Buffer.alloc(8);
    buffer.writeBigInt64BE(BigInt(counter));
    const key = base32ToBuffer(secret);
    const hmac = createHmac("sha1", key).update(buffer).digest();
    const offset = hmac[hmac.length - 1] & 0xf;
    const code = (
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff)
    ) % 1000000;
    return code.toString().padStart(6, "0");
  } catch (err) {
    return "";
  }
}

export function verifyTotpToken(token: string, secret: string): boolean {
  if (!token || !secret) return false;
  const cleanToken = token.trim();
  if (cleanToken.length !== 6 || !/^\d{6}$/.test(cleanToken)) return false;
  
  // Accept current window and +/- 1 window (up to 90s tolerance for clock drift)
  for (const offset of [0, -1, 1]) {
    if (generateTotpToken(secret, 30, offset) === cleanToken) {
      return true;
    }
  }
  return false;
}

export function getTotpUri(username: string, secret: string, issuer = "B2B Mining"): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(username)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

// ==========================================
// 2. Rate Limiting & Auto-Ban Protections
// ==========================================

interface LoginAttempt {
  count: number;
  firstAttempt: number;
  lockedUntil?: number;
}

const loginAttemptsMap = new Map<string, LoginAttempt>();
const registrationAttemptsMap = new Map<string, { count: number; windowStart: number }>();

export function checkLoginRateLimit(key: string): { allowed: boolean; remainingAttempts: number; waitMinutes?: number } {
  const now = Date.now();
  const attempt = loginAttemptsMap.get(key);

  if (!attempt) {
    return { allowed: true, remainingAttempts: 5 };
  }

  // Check if temporarily locked
  if (attempt.lockedUntil && now < attempt.lockedUntil) {
    const waitMinutes = Math.ceil((attempt.lockedUntil - now) / 60000);
    return { allowed: false, remainingAttempts: 0, waitMinutes };
  }

  // Reset window if 15 minutes elapsed since first attempt
  if (now - attempt.firstAttempt > 15 * 60 * 1000) {
    loginAttemptsMap.delete(key);
    return { allowed: true, remainingAttempts: 5 };
  }

  const remaining = Math.max(0, 5 - attempt.count);
  return { allowed: remaining > 0, remainingAttempts: remaining };
}

export function recordFailedLogin(key: string): { locked: boolean; waitMinutes?: number } {
  const now = Date.now();
  const attempt = loginAttemptsMap.get(key) || { count: 0, firstAttempt: now };

  attempt.count += 1;
  if (attempt.count >= 5) {
    // Lock for 15 minutes
    attempt.lockedUntil = now + 15 * 60 * 1000;
    loginAttemptsMap.set(key, attempt);
    return { locked: true, waitMinutes: 15 };
  }

  loginAttemptsMap.set(key, attempt);
  return { locked: false };
}

export function resetLoginAttempts(key: string): void {
  loginAttemptsMap.delete(key);
}

export function checkRegistrationRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour window
  const record = registrationAttemptsMap.get(ip);

  if (!record || (now - record.windowStart > windowMs)) {
    registrationAttemptsMap.set(ip, { count: 1, windowStart: now });
    return true;
  }

  if (record.count >= 5) {
    return false; // Max 5 registrations per hour per IP
  }

  record.count += 1;
  return true;
}

// ==========================================
// 3. Strict Tx Hash Validation & Protection
// ==========================================

export function isValidTxHash(txHash: string, network = "TRC20"): boolean {
  if (!txHash) return false;
  const clean = txHash.trim();

  // TRON / TRC20: typically 64 hex characters (without 0x or with 0x)
  if (network.toUpperCase() === "TRC20" || network.toUpperCase() === "TRON") {
    return /^(0x)?[a-fA-F0-9]{64}$/.test(clean);
  }

  // Ethereum / BSC / Polygon: 0x followed by 64 hex characters
  return /^0x[a-fA-F0-9]{64}$/.test(clean);
}

export function normalizeTxHash(txHash: string): string {
  const clean = txHash.trim().toLowerCase();
  return clean.startsWith("0x") ? clean : `0x${clean}`;
}
