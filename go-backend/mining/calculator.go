package mining

/**
 * B2B MINING O(1) GLOBAL INDEX SYSTEM
 * ====================================
 * 
 * This implementation uses an O(1) constant-time reward calculation system that:
 * 
 * 1. GLOBAL REWARD INDEX:
 *    - Maintains a cumulative reward index that increases with each block
 *    - Each user has their own last_index marking when they last claimed
 *    - Pending rewards = user_hash_power × (global_index - user_last_index)
 *    - This allows instant calculation without iterating through blocks
 * 
 * 2. FAIRNESS THROUGH PREVIOUS BLOCK MECHANISM:
 *    - Hash rates are locked BEFORE block generation
 *    - Rewards are based on the locked rates from the PREVIOUS hour
 *    - Users can't game the system by joining at the last second
 *    - New users must wait one full block period before earning rewards
 * 
 * 3. 24-BLOCK AUTO-SUSPENSION:
 *    - Tracks unclaimed blocks per user
 *    - When reaching 24 unclaimed blocks, mining suspends automatically
 *    - Suspension index is recorded to cap rewards at that point
 *    - After claiming, the user's index updates and mining resumes
 *    - Prevents excessive accumulation and maintains system balance
 * 
 * 4. EFFICIENCY BENEFITS:
 *    - O(1) reward calculation - instant regardless of block count
 *    - No need to iterate through historical blocks
 *    - Scales perfectly with millions of users and blocks
 *    - Minimal database operations for reward calculations
 */

import (
        "context"
        "database/sql"
        "encoding/json"
        "fmt"
        "log"
        "sync"
        "time"

        "github.com/jackc/pgx/v4/pgxpool"
        "github.com/shopspring/decimal"
)

type MiningCalculator struct {
        db              *pgxpool.Pool
        currentBlock    int64
        blockReward     decimal.Decimal
        halvingInterval int64
        maxSupply       decimal.Decimal
        mu              sync.RWMutex
        stopCh          chan struct{}
        ticker          *time.Ticker
        broadcastFunc   func(*BlockParticipation)
        sendUserUpdateFunc func(string, UserMiningUpdate)
}

type UserMiningUpdate struct {
        UserID               string          `json:"userId"`
        PersonalBlockHeight  int             `json:"personalBlockHeight"`
        UnclaimedRewards     decimal.Decimal `json:"unclaimedRewards"`
        HashPower            decimal.Decimal `json:"hashPower"`
        BlocksParticipated   int             `json:"blocksParticipated"`
        LastReward           decimal.Decimal `json:"lastReward"`
        MiningActive         bool            `json:"miningActive"`
        BlocksUntilSuspension int            `json:"blocksUntilSuspension"`
        UnclaimedBlocksCount int             `json:"unclaimedBlocksCount"`
        MiningSuspended      bool            `json:"miningSuspended"`
}

type BlockParticipation struct {
        BlockHeight int64           `json:"blockHeight"`
        TotalReward decimal.Decimal `json:"totalReward"`
        UserShare   decimal.Decimal `json:"userShare"`
        Timestamp   time.Time       `json:"timestamp"`
        Claimed     bool            `json:"claimed"`
}

type UserReward struct {
        UserID     string          `json:"userId"`
        Username   string          `json:"username"`
        HashPower  decimal.Decimal `json:"hashPower"`
        Reward     decimal.Decimal `json:"reward"`
        Percentage decimal.Decimal `json:"percentage"`
}

func NewMiningCalculator(db *pgxpool.Pool) *MiningCalculator {
        return &MiningCalculator{
                db:              db,
                currentBlock:    0,
                blockReward:     decimal.NewFromFloat(3200), // Starting reward
                halvingInterval: 210000,
                maxSupply:       decimal.NewFromInt(21000000),
                stopCh:          make(chan struct{}),
        }
}

// GlobalMiningState represents the global mining state for O(1) calculations
type GlobalMiningState struct {
        TotalHashPower    decimal.Decimal
        GlobalRewardIndex decimal.Decimal
        CurrentBlock      int64
        LastIndexUpdate   time.Time
}

// GetGlobalMiningState retrieves the current global mining state from the database
func (mc *MiningCalculator) GetGlobalMiningState(ctx context.Context) (*GlobalMiningState, error) {
        var stateJSON sql.NullString
        err := mc.db.QueryRow(ctx, `
                SELECT value FROM system_settings WHERE key = 'global_mining_state'
        `).Scan(&stateJSON)
        
        if err != nil && err != sql.ErrNoRows {
                return nil, fmt.Errorf("failed to get global mining state: %w", err)
        }
        
        // Parse state if exists, otherwise return defaults
        if stateJSON.Valid && stateJSON.String != "" {
                // Parse JSON state
                var state map[string]interface{}
                if err := json.Unmarshal([]byte(stateJSON.String), &state); err == nil {
                        totalHashPower, _ := decimal.NewFromString(fmt.Sprintf("%v", state["totalHashPower"]))
                        globalRewardIndex, _ := decimal.NewFromString(fmt.Sprintf("%v", state["globalRewardIndex"]))
                        currentBlock := int64(0)
                        if cb, ok := state["currentBlock"].(float64); ok {
                                currentBlock = int64(cb)
                        }
                        
                        return &GlobalMiningState{
                                TotalHashPower:    totalHashPower,
                                GlobalRewardIndex: globalRewardIndex,
                                CurrentBlock:      currentBlock,
                                LastIndexUpdate:   time.Now(),
                        }, nil
                }
        }
        
        // Default state - calculate total hash power from active users
        var totalHashStr string
        err = mc.db.QueryRow(ctx, `
                SELECT COALESCE(SUM(locked_hash_power), 0)::text 
                FROM users 
                WHERE mining_active = true AND locked_hash_power > 0
        `).Scan(&totalHashStr)
        
        if err != nil {
                return nil, fmt.Errorf("failed to calculate total hash power: %w", err)
        }
        
        totalHashPower, _ := decimal.NewFromString(totalHashStr)
        
        // Get current block number
        var blockNum sql.NullInt64
        mc.db.QueryRow(ctx, `
                SELECT COALESCE(MAX(block_number), 0) FROM mining_blocks
        `).Scan(&blockNum)
        
        return &GlobalMiningState{
                TotalHashPower:    totalHashPower,
                GlobalRewardIndex: decimal.Zero,
                CurrentBlock:      blockNum.Int64,
                LastIndexUpdate:   time.Now(),
        }, nil
}

// CalculateUserPending calculates pending rewards for a user using the global index
// This is the core O(1) calculation: rewards = hash_power × (current_index - last_claimed_index)
// If user is suspended at 24 blocks, we cap the index at the suspension point
func (mc *MiningCalculator) CalculateUserPending(ctx context.Context, userId string) (decimal.Decimal, error) {
        globalState, err := mc.GetGlobalMiningState(ctx)
        if err != nil {
                return decimal.Zero, err
        }
        
        // Get user data
        var userHashPowerStr, userIndexStr, accruedPendingStr sql.NullString
        var miningSuspended bool
        var suspensionAtBlock sql.NullInt64
        
        err = mc.db.QueryRow(ctx, `
                SELECT locked_hash_power::text, user_index::text, accrued_pending::text,
                       COALESCE(mining_suspended, false), suspension_at_block
                FROM users WHERE id = $1
        `, userId).Scan(&userHashPowerStr, &userIndexStr, &accruedPendingStr, &miningSuspended, &suspensionAtBlock)
        
        if err != nil {
                return decimal.Zero, fmt.Errorf("failed to get user data: %w", err)
        }
        
        userHashPower, _ := decimal.NewFromString(userHashPowerStr.String)
        if userHashPower.IsZero() {
                return decimal.Zero, nil
        }
        
        userIndex := decimal.Zero
        if userIndexStr.Valid {
                userIndex, _ = decimal.NewFromString(userIndexStr.String)
        }
        
        accruedPending := decimal.Zero
        if accruedPendingStr.Valid {
                accruedPending, _ = decimal.NewFromString(accruedPendingStr.String)
        }
        
        // 24-BLOCK SUSPENSION MECHANISM:
        // If user has 24+ unclaimed blocks, cap rewards at the suspension point
        // This ensures they can't accumulate indefinitely - must claim to continue earning
        effectiveIndex := globalState.GlobalRewardIndex
        if miningSuspended && suspensionAtBlock.Valid {
                var suspensionIndexStr sql.NullString
                mc.db.QueryRow(ctx, `
                        SELECT cumulative_index::text FROM mining_blocks 
                        WHERE block_number = $1
                `, suspensionAtBlock.Int64).Scan(&suspensionIndexStr)
                
                if suspensionIndexStr.Valid {
                        suspensionIndex, _ := decimal.NewFromString(suspensionIndexStr.String)
                        if suspensionIndex.LessThan(effectiveIndex) {
                                effectiveIndex = suspensionIndex
                        }
                }
        }
        
        // O(1) REWARD CALCULATION:
        // Rewards = user_hash_power × (effective_index - user_last_index)
        // This gives exact rewards without iterating through any blocks
        indexDiff := effectiveIndex.Sub(userIndex)
        newRewards := userHashPower.Mul(indexDiff)
        totalPending := accruedPending.Add(newRewards)
        
        return totalPending, nil
}

func (mc *MiningCalculator) Initialize(ctx context.Context) error {
        // Get the latest block from database
        var blockNum sql.NullInt64
        var reward sql.NullString
        
        err := mc.db.QueryRow(ctx, `
                SELECT block_number, reward 
                FROM mining_blocks 
                ORDER BY block_number DESC 
                LIMIT 1
        `).Scan(&blockNum, &reward)
        
        if err == nil && blockNum.Valid {
                mc.currentBlock = blockNum.Int64
                if reward.Valid {
                        mc.blockReward, _ = decimal.NewFromString(reward.String)
                }
        } else {
                // Initialize first block
                mc.currentBlock = 1
                mc.blockReward = decimal.NewFromFloat(3200)
        }

        log.Printf("Mining calculator initialized: Block %d, Reward: %s B2B", 
                mc.currentBlock, mc.blockReward.String())
        
        return nil
}

func (mc *MiningCalculator) GetCurrentBlockReward() decimal.Decimal {
        halvings := mc.currentBlock / mc.halvingInterval
        if halvings >= 10 { // Maximum 10 halvings as per Bitcoin model
                return decimal.Zero
        }
        
        divisor := decimal.NewFromInt(1 << halvings) // 2^halvings
        return decimal.NewFromFloat(3200).Div(divisor)
}

func (mc *MiningCalculator) CalculateTotalHashPower(ctx context.Context) (decimal.Decimal, error) {
        var totalStr string
        // Exclude frozen and mining_suspended users from total network hash
        err := mc.db.QueryRow(ctx, `
                SELECT COALESCE(SUM(hash_power), 0)::text 
                FROM users 
                WHERE mining_active = true 
                  AND hash_power > 0
                  AND COALESCE(is_frozen, false) = false
                  AND COALESCE(mining_suspended, false) = false
        `).Scan(&totalStr)
        
        if err != nil {
                return decimal.Zero, err
        }
        
        total, err := decimal.NewFromString(totalStr)
        if err != nil {
                return decimal.Zero, err
        }
        
        return total, nil
}

func (mc *MiningCalculator) GenerateNewBlock(ctx context.Context) (*BlockParticipation, error) {
        mc.mu.Lock()
        defer mc.mu.Unlock()

        // Get current global mining state (O(1) read)
        globalState, err := mc.GetGlobalMiningState(ctx)
        if err != nil {
                return nil, fmt.Errorf("failed to get global mining state: %w", err)
        }

        // If no hash power, no block generation
        if globalState.TotalHashPower.IsZero() {
                log.Println("No active miners, skipping block generation")
                return nil, nil
        }

        // Calculate block reward with halving
        mc.currentBlock = globalState.CurrentBlock + 1
        blockReward := mc.GetCurrentBlockReward()
        
        // Calculate reward per hash for this block
        // THIS PRESERVES: user_reward = (user_hash/global_hash) × block_reward
        rewardPerHash := blockReward.Div(globalState.TotalHashPower)
        
        // Update cumulative index
        newGlobalIndex := globalState.GlobalRewardIndex.Add(rewardPerHash)
        
        // Single database transaction for O(1) operation
        tx, err := mc.db.Begin(ctx)
        if err != nil {
                return nil, fmt.Errorf("failed to begin transaction: %w", err)
        }
        defer tx.Rollback(ctx)
        
        // Create new block with cumulative index
        var blockID string
        err = tx.QueryRow(ctx, `
                INSERT INTO mining_blocks (block_number, reward, total_hash_power, global_hashrate, cumulative_index, block_start_time, timestamp)
                VALUES ($1, $2, $3, $4, $5, $6, NOW())
                RETURNING id
        `, mc.currentBlock, blockReward.String(), globalState.TotalHashPower.String(), 
           globalState.TotalHashPower.String(), newGlobalIndex.String(), time.Now()).Scan(&blockID)
        
        if err != nil {
                return nil, fmt.Errorf("failed to create mining block: %w", err)
        }
        
        // Update global state (ONE write)
        _, err = tx.Exec(ctx, `
                INSERT INTO system_settings (key, value, updated_at) 
                VALUES ('global_mining_state', $1, NOW())
                ON CONFLICT (key) DO UPDATE 
                SET value = $1, updated_at = NOW()
        `, fmt.Sprintf(`{"totalHashPower":"%s","globalRewardIndex":"%s","currentBlock":%d,"lastIndexUpdate":"%s"}`,
                globalState.TotalHashPower.String(), newGlobalIndex.String(), mc.currentBlock, time.Now().Format(time.RFC3339)))
        
        if err != nil {
                return nil, fmt.Errorf("failed to update global state: %w", err)
        }
        
        if err = tx.Commit(ctx); err != nil {
                return nil, fmt.Errorf("failed to commit transaction: %w", err)
        }

        log.Printf("Generated new block #%d with reward %s B2B, Total hashpower: %s GH/s (Index: %s)", 
                mc.currentBlock, blockReward.String(), globalState.TotalHashPower.String(), newGlobalIndex.String())

        // No need for individual reward distribution - it's calculated on-demand!
        // Just broadcast the new block to connected users
        if mc.broadcastFunc != nil {
                mc.broadcastFunc(&BlockParticipation{
                        BlockHeight: mc.currentBlock,
                        TotalReward: blockReward,
                        Timestamp:   time.Now(),
                })
        }

        return &BlockParticipation{
                BlockHeight: mc.currentBlock,
                TotalReward: blockReward,
                Timestamp:   time.Now(),
        }, nil
}

// DistributeRewards is now DEPRECATED - rewards are calculated on-demand using the global index
// This function is kept for backward compatibility but does nothing
func (mc *MiningCalculator) DistributeRewards(ctx context.Context, blockNumber int64, totalReward, totalHashPower decimal.Decimal) error {
        log.Printf("DistributeRewards called but skipped - using global index system for O(1) calculations")
        return nil
}

// Legacy DistributeRewards implementation (kept for reference)
func (mc *MiningCalculator) DistributeRewardsLegacy(ctx context.Context, blockNumber int64, totalReward, totalHashPower decimal.Decimal) error {
        // Get all active miners with hash power (exclude suspended miners)
        rows, err := mc.db.Query(ctx, `
                SELECT id, username, hash_power::text, personal_block_height, 
                       COALESCE(unclaimed_blocks_count, 0) as unclaimed_count,
                       COALESCE(mining_suspended, false) as suspended
                FROM users 
                WHERE mining_active = true AND hash_power > 0 AND COALESCE(mining_suspended, false) = false
        `)
        if err != nil {
                return fmt.Errorf("failed to get active miners: %w", err)
        }
        defer rows.Close()

        var rewards []UserReward
        var wg sync.WaitGroup
        rewardCh := make(chan UserReward, 100)
        errorCh := make(chan error, 100)

        // Process miners concurrently
        for rows.Next() {
                var userID, username, hashPowerStr string
                var personalBlockHeight sql.NullInt64
                var unclaimedCount int
                var suspended bool
                
                if err := rows.Scan(&userID, &username, &hashPowerStr, &personalBlockHeight, &unclaimedCount, &suspended); err != nil {
                        log.Printf("Error scanning user: %v", err)
                        continue
                }

                wg.Add(1)
                go func(uid, uname, hpStr string, pbh sql.NullInt64, ucCount int) {
                        defer wg.Done()
                        
                        hashPower, err := decimal.NewFromString(hpStr)
                        if err != nil {
                                errorCh <- fmt.Errorf("invalid hash power for user %s: %w", uid, err)
                                return
                        }

                        // Calculate user's share
                        sharePercent := hashPower.Div(totalHashPower).Mul(decimal.NewFromInt(100))
                        userReward := totalReward.Mul(hashPower).Div(totalHashPower)

                        // Update user's personal block height
                        newPersonalHeight := int64(1)
                        if pbh.Valid {
                                newPersonalHeight = pbh.Int64 + 1
                        }

                        // Lock user's hashrate for this block
                        _, err = mc.db.Exec(ctx, `
                                UPDATE users 
                                SET personal_block_height = $1,
                                    locked_hash_power = $2,
                                    last_active_block = $3
                                WHERE id = $4
                        `, newPersonalHeight, hashPowerStr, blockNumber, uid)
                        
                        if err != nil {
                                errorCh <- fmt.Errorf("failed to update user %s: %w", uid, err)
                                return
                        }

                        // Create unclaimed block entry (no expiry)
                        _, err = mc.db.Exec(ctx, `
                                INSERT INTO unclaimed_blocks (user_id, block_number, tx_hash, reward, expires_at, claimed)
                                VALUES ($1, $2, $3, $4, NULL, false)
                        `, uid, blockNumber, fmt.Sprintf("BLOCK-%d-%s", blockNumber, uid), userReward.String())
                        
                        if err != nil {
                                errorCh <- fmt.Errorf("failed to create unclaimed block for user %s: %w", uid, err)
                                return
                        }

                        // Update unclaimed blocks count and check for suspension
                        newUnclaimedCount := ucCount + 1
                        shouldSuspend := newUnclaimedCount >= 24
                        
                        _, err = mc.db.Exec(ctx, `
                                UPDATE users 
                                SET unclaimed_blocks_count = $1,
                                    mining_suspended = $2
                                WHERE id = $3
                        `, newUnclaimedCount, shouldSuspend, uid)
                        
                        if err != nil {
                                log.Printf("Failed to update unclaimed count for user %s: %v", uid, err)
                        }
                        
                        if shouldSuspend {
                                log.Printf("User %s suspended after %d unclaimed blocks", uname, newUnclaimedCount)
                        }

                        // Create mining history entry
                        _, err = mc.db.Exec(ctx, `
                                INSERT INTO mining_history (user_id, block_number, locked_hashrate, reward)
                                VALUES ($1, $2, $3, $4)
                        `, uid, blockNumber, hashPowerStr, userReward.String())
                        
                        if err != nil {
                                log.Printf("Failed to create mining history for user %s: %v", uid, err)
                        }

                        rewardCh <- UserReward{
                                UserID:     uid,
                                Username:   uname,
                                HashPower:  hashPower,
                                Reward:     userReward,
                                Percentage: sharePercent,
                        }

                        log.Printf("User %s earned %s B2B (%.2f%% share) from block %d", 
                                uname, userReward.String(), sharePercent.InexactFloat64(), blockNumber)
                        
                        // Send WebSocket update to the user
                        if mc.sendUserUpdateFunc != nil {
                                blocksUntilSuspension := 24 - newUnclaimedCount
                                if blocksUntilSuspension < 0 {
                                        blocksUntilSuspension = 0
                                }
                                
                                userUpdate := UserMiningUpdate{
                                        UserID:               uid,
                                        PersonalBlockHeight:  int(newPersonalHeight),
                                        UnclaimedRewards:     userReward,
                                        HashPower:            hashPower,
                                        BlocksParticipated:   int(newPersonalHeight),
                                        LastReward:           userReward,
                                        MiningActive:         !shouldSuspend,
                                        BlocksUntilSuspension: blocksUntilSuspension,
                                        UnclaimedBlocksCount: newUnclaimedCount,
                                        MiningSuspended:      shouldSuspend,
                                }
                                mc.sendUserUpdateFunc(uid, userUpdate)
                        }
                }(userID, username, hashPowerStr, personalBlockHeight, unclaimedCount)
        }

        // Wait for all goroutines and collect results
        go func() {
                wg.Wait()
                close(rewardCh)
                close(errorCh)
        }()

        // Collect rewards
        for reward := range rewardCh {
                rewards = append(rewards, reward)
        }

        // Check for errors
        for err := range errorCh {
                log.Printf("Error distributing rewards: %v", err)
        }

        log.Printf("Distributed rewards to %d miners for block %d", len(rewards), blockNumber)
        
        // Check and suspend inactive miners
        go mc.CheckAndSuspendInactiveMiners(context.Background())

        return nil
}

func (mc *MiningCalculator) CheckAndSuspendInactiveMiners(ctx context.Context) error {
        // Check users with unclaimed_blocks_count >= 24
        rows, err := mc.db.Query(ctx, `
                SELECT id, username, unclaimed_blocks_count
                FROM users
                WHERE unclaimed_blocks_count >= 24
                  AND COALESCE(mining_suspended, false) = false
        `)
        
        if err != nil {
                return fmt.Errorf("failed to find inactive miners: %w", err)
        }
        defer rows.Close()

        suspendedCount := 0
        for rows.Next() {
                var userID, username string
                var unclaimedCount int
                
                if err := rows.Scan(&userID, &username, &unclaimedCount); err != nil {
                        continue
                }

                // Suspend mining for this user
                _, err = mc.db.Exec(ctx, `
                        UPDATE users 
                        SET mining_suspended = true,
                            last_activity_time = NOW()
                        WHERE id = $1
                `, userID)
                
                if err != nil {
                        log.Printf("Failed to suspend user %s: %v", username, err)
                        continue
                }

                suspendedCount++
                log.Printf("Suspended mining for user %s due to %d unclaimed blocks", username, unclaimedCount)
        }

        if suspendedCount > 0 {
                log.Printf("Suspended mining for %d inactive users", suspendedCount)
        }

        return nil
}

func (mc *MiningCalculator) GetUserMiningStatus(ctx context.Context, userID string) (map[string]interface{}, error) {
        // Get user's current status
        var personalBlockHeight, lastClaimedBlock sql.NullInt64
        var miningActive bool
        var hashPowerStr, unclaimedStr string
        
        err := mc.db.QueryRow(ctx, `
                SELECT personal_block_height, last_claimed_block, mining_active, 
                       hash_power::text, unclaimed_balance::text
                FROM users
                WHERE id = $1
        `, userID).Scan(&personalBlockHeight, &lastClaimedBlock, &miningActive, &hashPowerStr, &unclaimedStr)
        
        if err != nil {
                return nil, err
        }

        // Count unclaimed blocks (no expiry check)
        var unclaimedCount int
        err = mc.db.QueryRow(ctx, `
                SELECT COALESCE(unclaimed_blocks_count, 0)
                FROM users
                WHERE id = $1
        `, userID).Scan(&unclaimedCount)
        
        if err != nil {
                unclaimedCount = 0
        }

        blocksUntilSuspension := 24 - unclaimedCount
        if blocksUntilSuspension < 0 {
                blocksUntilSuspension = 0
        }

        hashPower, _ := decimal.NewFromString(hashPowerStr)
        unclaimedBalance, _ := decimal.NewFromString(unclaimedStr)

        return map[string]interface{}{
                "personalBlockHeight":   personalBlockHeight.Int64,
                "lastClaimedBlock":      lastClaimedBlock.Int64,
                "miningActive":          miningActive,
                "hashPower":             hashPower.String(),
                "unclaimedBalance":      unclaimedBalance.String(),
                "unclaimedBlocks":       unclaimedCount,
                "blocksUntilSuspension": blocksUntilSuspension,
        }, nil
}

func (mc *MiningCalculator) StartHourlyBlockGeneration() {
        // Calculate time until next hour
        now := time.Now()
        nextHour := now.Truncate(time.Hour).Add(time.Hour)
        waitTime := nextHour.Sub(now)

        log.Printf("Mining system initialized - blocks generate every hour on the hour (UTC)")
        log.Printf("Next block generation in %v at %s", waitTime, nextHour.Format("15:04:05"))

        // Start a goroutine to handle block generation
        go func() {
                // Wait for the first block at the next hour
                time.Sleep(waitTime)
                
                // Generate first block
                ctx := context.Background()
                block, err := mc.GenerateNewBlock(ctx)
                if err != nil {
                        log.Printf("Error generating block: %v", err)
                } else if block != nil {
                        mc.BroadcastBlockUpdate(block)
                }

                // Start hourly ticker
                mc.ticker = time.NewTicker(time.Hour)
                
                for {
                        select {
                        case <-mc.ticker.C:
                                ctx := context.Background()
                                block, err := mc.GenerateNewBlock(ctx)
                                if err != nil {
                                        log.Printf("Error generating block: %v", err)
                                } else if block != nil {
                                        mc.BroadcastBlockUpdate(block)
                                }
                        case <-mc.stopCh:
                                mc.ticker.Stop()
                                return
                        }
                }
        }()
}

func (mc *MiningCalculator) Stop() {
        close(mc.stopCh)
        if mc.ticker != nil {
                mc.ticker.Stop()
        }
        log.Println("Mining calculator stopped")
}

// GetActiveMiners returns all active miners who are not suspended
func (mc *MiningCalculator) GetActiveMiners(ctx context.Context) ([]map[string]interface{}, error) {
        rows, err := mc.db.Query(ctx, `
                SELECT id, username, hash_power::text, personal_block_height, 
                       unclaimed_blocks_count, mining_suspended
                FROM users
                WHERE mining_active = true 
                  AND hash_power > 0 
                  AND COALESCE(mining_suspended, false) = false
                ORDER BY hash_power DESC
        `)
        if err != nil {
                return nil, err
        }
        defer rows.Close()

        var miners []map[string]interface{}
        for rows.Next() {
                var userID, username, hashPowerStr string
                var personalBlockHeight sql.NullInt64
                var unclaimedCount int
                var suspended bool

                if err := rows.Scan(&userID, &username, &hashPowerStr, &personalBlockHeight, &unclaimedCount, &suspended); err != nil {
                        continue
                }

                miners = append(miners, map[string]interface{}{
                        "userID":              userID,
                        "username":            username,
                        "hashPower":           hashPowerStr,
                        "personalBlockHeight": personalBlockHeight.Int64,
                        "unclaimedBlocks":     unclaimedCount,
                        "suspended":           suspended,
                })
        }

        return miners, nil
}

// GetUnclaimedBlocks returns all unclaimed blocks for a user
func (mc *MiningCalculator) GetUnclaimedBlocks(ctx context.Context, userID string) ([]map[string]interface{}, error) {
        rows, err := mc.db.Query(ctx, `
                SELECT ub.id, ub.block_number, ub.reward::text, ub.created_at, 
                       mb.reward::text as total_block_reward, mb.timestamp as block_time
                FROM unclaimed_blocks ub
                JOIN mining_blocks mb ON mb.block_number = ub.block_number
                WHERE ub.user_id = $1 AND ub.claimed = false
                ORDER BY ub.block_number DESC
        `, userID)
        if err != nil {
                return nil, err
        }
        defer rows.Close()

        var blocks []map[string]interface{}
        for rows.Next() {
                var id string
                var blockNumber int64
                var userReward, totalReward string
                var createdAt, blockTime time.Time

                if err := rows.Scan(&id, &blockNumber, &userReward, &createdAt, &totalReward, &blockTime); err != nil {
                        continue
                }

                blocks = append(blocks, map[string]interface{}{
                        "id":               id,
                        "blockNumber":      blockNumber,
                        "userReward":       userReward,
                        "totalBlockReward": totalReward,
                        "createdAt":        createdAt,
                        "blockTime":        blockTime,
                        "permanent":        true, // Rewards never expire
                })
        }

        return blocks, nil
}

func (mc *MiningCalculator) BroadcastBlockUpdate(block *BlockParticipation) {
        // This will be connected to the WebSocket hub in main.go
        // The actual implementation is handled by passing a callback function
        if mc.broadcastFunc != nil {
                mc.broadcastFunc(block)
        }
}

// SetBroadcastFunction sets the callback for broadcasting updates
func (mc *MiningCalculator) SetBroadcastFunction(fn func(*BlockParticipation)) {
        mc.broadcastFunc = fn
}

// SetUserUpdateFunction sets the callback for sending user-specific updates
func (mc *MiningCalculator) SetUserUpdateFunction(fn func(string, UserMiningUpdate)) {
        mc.sendUserUpdateFunc = fn
}