import cron from "node-cron";
import fs from "fs";
import path from "path";
import { storage } from "./storage";

const BACKUP_DIR = path.resolve(process.cwd(), "backups");

export interface BackupMetadata {
  filename: string;
  size: number;
  createdAt: string;
  userCount: number;
  blockHeight?: number;
}

/**
 * Ensures the backups directory exists
 */
function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

/**
 * Generates an automated or manual backup of database state
 */
export async function generateSystemBackup(reason = "automated"): Promise<BackupMetadata> {
  ensureBackupDir();

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `b2b-backup-${timestamp}.json`;
  const filePath = path.join(BACKUP_DIR, filename);

  try {
    const [
      users,
      deposits,
      withdrawals,
      auditLogs,
      globalSetting
    ] = await Promise.all([
      storage.getAllUsers().catch(() => []),
      storage.getAllDeposits().catch(() => []),
      storage.getAllWithdrawals().catch(() => []),
      storage.getAuditLogs(500).catch(() => []),
      storage.getSystemSetting("totalBlockHeight").catch(() => null)
    ]);

    const backupPayload = {
      version: "1.0",
      reason,
      createdAt: new Date().toISOString(),
      blockHeight: globalSetting?.value ? parseInt(globalSetting.value) : 0,
      summary: {
        totalUsers: users.length,
        totalDeposits: deposits.length,
        totalWithdrawals: withdrawals.length,
        totalAuditLogs: auditLogs.length,
      },
      data: {
        users: users.map(u => ({
          id: u.id,
          username: u.username,
          usdtBalance: u.usdtBalance,
          b2bBalance: u.b2bBalance,
          hashPower: u.hashPower,
          isFrozen: u.isFrozen,
          isBanned: u.isBanned,
          twoFactorEnabled: u.twoFactorEnabled,
          createdAt: u.createdAt,
        })),
        deposits,
        withdrawals,
        auditLogs
      }
    };

    fs.writeFileSync(filePath, JSON.stringify(backupPayload, null, 2), "utf-8");
    const stats = fs.statSync(filePath);

    // Prune old backups, keep last 14
    pruneOldBackups(14);

    console.log(`[Backup] Created ${filename} (${(stats.size / 1024).toFixed(1)} KB) - ${reason}`);

    return {
      filename,
      size: stats.size,
      createdAt: new Date().toISOString(),
      userCount: users.length,
      blockHeight: globalSetting?.value ? parseInt(globalSetting.value) : 0
    };
  } catch (error) {
    console.error("[Backup] Failed to generate backup:", error);
    throw error;
  }
}

/**
 * Prunes old backup files to conserve disk space
 */
function pruneOldBackups(maxKeep = 14) {
  try {
    ensureBackupDir();
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith("b2b-backup-") && f.endsWith(".json"))
      .map(f => {
        const fullPath = path.join(BACKUP_DIR, f);
        return {
          name: f,
          time: fs.statSync(fullPath).mtimeMs
        };
      })
      .sort((a, b) => b.time - a.time);

    if (files.length > maxKeep) {
      const toDelete = files.slice(maxKeep);
      for (const item of toDelete) {
        fs.unlinkSync(path.join(BACKUP_DIR, item.name));
        console.log(`[Backup] Pruned old backup: ${item.name}`);
      }
    }
  } catch (err) {
    console.warn("[Backup] Prune error:", err);
  }
}

/**
 * Returns list of existing backup files
 */
export function listBackups(): BackupMetadata[] {
  ensureBackupDir();
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith("b2b-backup-") && f.endsWith(".json"))
      .map(filename => {
        const fullPath = path.join(BACKUP_DIR, filename);
        const stat = fs.statSync(fullPath);
        return {
          filename,
          size: stat.size,
          createdAt: stat.birthtime.toISOString(),
          userCount: 0
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return files;
  } catch (error) {
    console.error("[Backup] Error listing backups:", error);
    return [];
  }
}

/**
 * Retrieves raw content of a specific backup file
 */
export function getBackupContent(filename: string): any {
  ensureBackupDir();
  const safeFilename = path.basename(filename);
  const filePath = path.join(BACKUP_DIR, safeFilename);

  if (!fs.existsSync(filePath)) {
    throw new Error("Backup file not found");
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

/**
 * Initializes the automated daily backup cron schedule (03:00 UTC daily)
 */
export function setupAutomatedBackups() {
  console.log("[Backup] Scheduling automated daily backups at 03:00 UTC");
  
  // Schedule at 03:00 UTC every day
  cron.schedule("0 3 * * *", async () => {
    try {
      console.log("[Backup] Starting scheduled daily backup...");
      await generateSystemBackup("scheduled-daily");
    } catch (err) {
      console.error("[Backup] Scheduled backup encountered an error:", err);
    }
  }, {
    timezone: "UTC"
  });

  // Also take an initial lightweight snapshot if no backups exist yet
  try {
    ensureBackupDir();
    const existing = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith(".json"));
    if (existing.length === 0) {
      setTimeout(() => {
        generateSystemBackup("initial-startup").catch(err => {
          console.warn("[Backup] Initial snapshot warning:", err);
        });
      }, 5000);
    }
  } catch (e) {
    // Ignore error
  }
}
