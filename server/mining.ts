import { storage } from "./storage";
import cron from "node-cron";

/**
 * B2B MINING FAIRNESS MECHANISM
 * =============================
 * 
 * Our mining system ensures perfect fairness for all participants by:
 * 
 * 1. PREVIOUS BLOCK LOCKED HASH RATES:
 *    - Rewards are ALWAYS calculated based on the PREVIOUS block's locked hash rates
 *    - When a new block generates (every hour), users receive rewards based on 
 *      their hash power that was locked during the PREVIOUS hour
 *    - This prevents any gaming of the system - you can't join at the last second
 *      to claim rewards; you must participate for a full hour first
 *    - Users can join/leave anytime but only earn for completed periods they participated in
 * 
 * 2. O(1) GLOBAL INDEX SYSTEM (Go Backend):
 *    - Efficient reward calculation: user_reward = user_hash × (current_index - user_last_index)
 *    - No need to iterate through all blocks - instant calculation
 *    - Scales perfectly regardless of number of blocks or users
 * 
 * 3. 24-BLOCK SUSPENSION RULE:
 *    - Mining automatically suspends when a user accumulates 24 unclaimed blocks
 *    - This ensures users claim regularly and prevents excessive accumulation
 *    - Suspension index is recorded to cap rewards at that suspension point
 *    - After claiming, mining resumes from the new index point
 *    - This maintains system balance and encourages active participation
 * 
 * 4. HASH RATE LOCKING:
 *    - Before each block generation, all active miners' hash rates are locked
 *    - These locked rates are used for reward distribution
 *    - Any changes to hash power only affect the NEXT block, not the current one
 */

let totalBlockHeight = 0; // Total blocks mined (never resets, continuous)
let currentBlockReward = 3200;
let isProcessingBlock = false;

export function setupMining() {
  // Initialize block reward and height from database (non-blocking)
  initializeSettings().catch(err => {
    console.error("Error initializing mining settings:", err);
  });
  
  // Generate block every hour on the hour (UTC time)
  // '0 * * * *' means at minute 0 of every hour
  cron.schedule("0 * * * *", async () => {
    if (!isProcessingBlock) {
      isProcessingBlock = true;
      try {
        await generateAndDistributeBlock();
      } catch (error) {
        console.error("Error in block generation:", error);
      } finally {
        isProcessingBlock = false;
      }
    }
  }, {
    timezone: "UTC"
  });
  
  // Daily BTC staking rewards distribution at 00:00 UTC
  cron.schedule("0 0 * * *", async () => {
    try {
      await distributeBtcStakingRewards();
    } catch (error) {
      console.error("Error distributing BTC staking rewards:", error);
    }
  }, {
    timezone: "UTC"
  });
  
  // Check for inactive miners every 30 minutes
  cron.schedule("*/30 * * * *", async () => {
    try {
      await storage.checkAndSuspendInactiveMiners();
    } catch (error) {
      console.error("Error checking inactive miners:", error);
    }
  }, {
    timezone: "UTC"
  });
  
  console.log("Mining system initialized - blocks generate every hour on the hour (UTC)");
}

async function initializeSettings() {
  let retries = 3;
  
  while (retries > 0) {
    try {
      // Load block reward
      const blockRewardSetting = await storage.getSystemSetting("blockReward");
      if (blockRewardSetting) {
        currentBlockReward = parseFloat(blockRewardSetting.value);
      } else {
        await storage.setSystemSetting("blockReward", currentBlockReward.toString());
      }
      
      // Load total block height
      const totalBlockHeightSetting = await storage.getSystemSetting("totalBlockHeight");
      if (totalBlockHeightSetting) {
        totalBlockHeight = parseInt(totalBlockHeightSetting.value);
      } else {
        await storage.setSystemSetting("totalBlockHeight", totalBlockHeight.toString());
      }
      
      console.log(`Mining initialized: Block height ${totalBlockHeight}, Reward ${currentBlockReward} B2B`);
      return; // Success, exit retry loop
      
    } catch (error: any) {
      retries--;
      if (error?.message?.includes('endpoint has been disabled') || error?.code === 'XX000') {
        // Database reactivating, retry silently
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }
      }
      
      console.error("Error initializing mining settings:", error);
      // Use defaults if initialization fails
    }
  }
}

async function generateAndDistributeBlock() {
  try {
    const MAX_SUPPLY = 21000000; // 21M B2B max supply
    const HALVING_INTERVAL = 2160; // Blocks between halvings (3 months: 24 blocks/day × 90 days)
    
    // Check if max supply has been reached
    const totalMined = await storage.getTotalMinedSupply();
    const totalMinedNum = parseFloat(totalMined);
    
    if (totalMinedNum >= MAX_SUPPLY) {
      console.log("Max supply of 21M B2B reached. No more blocks will be generated.");
      return;
    }
    
    // Increment total block height (continuous, never resets)
    totalBlockHeight++;
    await storage.setSystemSetting("totalBlockHeight", totalBlockHeight.toString());
    
    // Calculate block reward with halving
    const halvingPeriod = Math.floor(totalBlockHeight / HALVING_INTERVAL);
    currentBlockReward = 3200 / Math.pow(2, halvingPeriod);
    
    // Check if adding current block reward would exceed max supply
    if (totalMinedNum + currentBlockReward > MAX_SUPPLY) {
      // Adjust the final block reward to exactly reach max supply
      currentBlockReward = MAX_SUPPLY - totalMinedNum;
      await storage.setSystemSetting("blockReward", currentBlockReward.toString());
      console.log(`Final block adjustment: ${currentBlockReward} B2B`);
    }
    
    // FAIRNESS MECHANISM: Lock hashrates for all active users before generating the block
    // This ensures rewards are based on PREVIOUS participation, not last-second changes
    console.log(`Locking hashrates for block ${totalBlockHeight}...`);
    await storage.lockHashratesForBlock(totalBlockHeight);
    
    // Calculate global hashrate (sum of all locked hashrates)
    const users = await storage.getAllUsers();
    let globalHashrate = 0;
    let activeMinersCount = 0;
    
    for (const user of users) {
      if (user.miningActive && parseFloat(user.lockedHashPower || '0') > 0) {
        globalHashrate += parseFloat(user.lockedHashPower || '0');
        activeMinersCount++;
      }
    }
    
    const globalHashrateStr = globalHashrate.toFixed(2);
    const totalHashPower = await storage.getTotalHashPower(); // Total potential hashpower
    
    console.log(`Block ${totalBlockHeight}: ${activeMinersCount} active miners, ${globalHashrateStr} TH/s locked hashrate`);
    
    // Create the mining block
    const block = await storage.createMiningBlock(
      totalBlockHeight,
      currentBlockReward.toFixed(8),
      totalHashPower,
      globalHashrateStr
    );
    
    // Update block reward setting
    await storage.setSystemSetting("blockReward", currentBlockReward.toString());
    
    // FAIRNESS MECHANISM: Distribute rewards proportionally based on LOCKED hash rates
    // Users receive rewards based on their contribution during the PREVIOUS hour
    if (globalHashrate > 0) {
      for (const user of users) {
        if (user.miningActive && parseFloat(user.lockedHashPower || '0') > 0) {
          const userReward = await storage.calculateUserReward(user.id, currentBlockReward.toString());
          
          if (parseFloat(userReward) > 0) {
            // Create unclaimed block for user
            const txHash = generateTxHash();
            await storage.createUnclaimedBlock(
              user.id,
              totalBlockHeight,
              txHash,
              userReward
            );
            
            // Create mining history entry
            await storage.createMiningHistory(
              user.id,
              totalBlockHeight,
              user.lockedHashPower || '0.00',
              userReward
            );
            
            // Increment user's personal block height
            await storage.updateUser(user.id, {
              personalBlockHeight: (user.personalBlockHeight || 0) + 1
            });
          }
        }
      }
    }
    
    console.log(`Block ${totalBlockHeight} generated successfully. Reward: ${currentBlockReward} B2B, Next block in 1 hour.`);
    
  } catch (error) {
    console.error("Error generating block:", error);
    // Don't throw - allow the system to continue and retry next hour
  }
}

async function distributeBtcStakingRewards() {
  try {
    // Process daily BTC staking rewards
    await storage.processDailyBtcRewards();
    console.log("Daily BTC staking rewards distributed successfully");
  } catch (error) {
    console.error("Error distributing BTC staking rewards:", error);
  }
}

function generateTxHash(): string {
  const chars = '0123456789abcdef';
  let hash = '0x';
  for (let i = 0; i < 64; i++) {
    hash += chars[Math.floor(Math.random() * 16)];
  }
  return hash;
}

// Export for testing purposes
export async function forceGenerateBlock() {
  if (!isProcessingBlock) {
    isProcessingBlock = true;
    try {
      await generateAndDistributeBlock();
    } catch (error) {
      console.error("Error in forced block generation:", error);
    } finally {
      isProcessingBlock = false;
    }
  }
}