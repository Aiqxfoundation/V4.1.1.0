package main

import (
        "bit2block-mining/database"
        "bit2block-mining/mining"
        "bit2block-mining/websocket"
        "context"
        "crypto/rand"
        "crypto/sha256"
        "database/sql"
        "encoding/base64"
        "encoding/json"
        "fmt"
        "log"
        "net/http"
        "os"
        "os/signal"
        "strings"
        "sync"
        "syscall"
        "time"

        "github.com/go-chi/chi/v5"
        "github.com/go-chi/chi/v5/middleware"
        "github.com/go-chi/cors"
        "github.com/gorilla/sessions"
        "github.com/jackc/pgx/v4"
        "github.com/shopspring/decimal"
        "golang.org/x/crypto/scrypt"
)

var (
        store            *sessions.CookieStore
        miningCalculator *mining.MiningCalculator
        wsHub            *websocket.Hub
        mu               sync.RWMutex
)

// User represents the users table
type User struct {
        ID                    string          `json:"id" db:"id"`
        Username              string          `json:"username" db:"username"`
        AccessKey             string          `json:"accessKey" db:"access_key"`
        ReferralCode          *string         `json:"referralCode" db:"referral_code"`
        ReferredBy            *string         `json:"referredBy" db:"referred_by"`
        RegistrationIP        *string         `json:"registrationIp" db:"registration_ip"`
        USDTBalance           decimal.Decimal `json:"usdtBalance" db:"usdt_balance"`
        BTCBalance            decimal.Decimal `json:"btcBalance" db:"btc_balance"`
        HashPower             decimal.Decimal `json:"hashPower" db:"hash_power"`
        BaseHashPower         decimal.Decimal `json:"baseHashPower" db:"base_hash_power"`
        ReferralHashBonus     decimal.Decimal `json:"referralHashBonus" db:"referral_hash_bonus"`
        B2BBalance            decimal.Decimal `json:"b2bBalance" db:"b2b_balance"`
        UnclaimedBalance      decimal.Decimal `json:"unclaimedBalance" db:"unclaimed_balance"`
        TotalReferralEarnings decimal.Decimal `json:"totalReferralEarnings" db:"total_referral_earnings"`
        LastActiveBlock       *int            `json:"lastActiveBlock" db:"last_active_block"`
        PersonalBlockHeight   int             `json:"personalBlockHeight" db:"personal_block_height"`
        LastClaimedBlock      *int            `json:"lastClaimedBlock" db:"last_claimed_block"`
        MiningActive          bool            `json:"miningActive" db:"mining_active"`
        IsAdmin               bool            `json:"isAdmin" db:"is_admin"`
        IsFrozen              bool            `json:"isFrozen" db:"is_frozen"`
        IsBanned              bool            `json:"isBanned" db:"is_banned"`
        HasStartedMining      bool            `json:"hasStartedMining" db:"has_started_mining"`
        CreatedAt             time.Time       `json:"createdAt" db:"created_at"`
}

func main() {
        // Initialize logging
        log.SetFlags(log.LstdFlags | log.Lshortfile)

        // Initialize database
        if err := database.InitDatabase(); err != nil {
                log.Fatalf("Failed to initialize database: %v", err)
        }
        defer database.CloseDatabase()

        // Check if required tables exist
        ctx := context.Background()
        if err := database.CheckTablesExist(ctx); err != nil {
                log.Printf("Warning: %v", err)
                log.Println("Continuing with available tables...")
        }

        // Initialize session store
        sessionKey := os.Getenv("SESSION_KEY")
        if sessionKey == "" {
                sessionKey = "bit2block-secret-key-change-in-production"
        }
        store = sessions.NewCookieStore([]byte(sessionKey))
        store.Options.HttpOnly = true
        // Use secure cookies when running on Replit (HTTPS) or in production
        isProduction := os.Getenv("NODE_ENV") == "production" || os.Getenv("REPLIT_DEV_DOMAIN") != ""
        store.Options.Secure = isProduction
        store.Options.SameSite = http.SameSiteLaxMode

        // Initialize WebSocket hub
        websocket.InitWebSocket()
        wsHub = websocket.GlobalHub

        // Initialize mining calculator
        miningCalculator = mining.NewMiningCalculator(database.GetDB())
        if err := miningCalculator.Initialize(ctx); err != nil {
                log.Printf("Failed to initialize mining calculator: %v", err)
        }

        // Set up the user update function for sending updates via WebSocket
        miningCalculator.SetUserUpdateFunction(func(userID string, update mining.UserMiningUpdate) {
                wsHub.SendUserUpdate(userID, websocket.UserMiningUpdate{
                        UserID:               update.UserID,
                        PersonalBlockHeight:  update.PersonalBlockHeight,
                        UnclaimedRewards:     update.UnclaimedRewards,
                        HashPower:            update.HashPower,
                        BlocksParticipated:   update.BlocksParticipated,
                        LastReward:           update.LastReward,
                        MiningActive:         update.MiningActive,
                        BlocksUntilSuspension: update.BlocksUntilSuspension,
                        UnclaimedBlocksCount: update.UnclaimedBlocksCount,
                        MiningSuspended:      update.MiningSuspended,
                })
        })

        // Set up the broadcast function for block updates
        miningCalculator.SetBroadcastFunction(func(block *mining.BlockParticipation) {
                ctx := context.Background()
                totalHashPower, _ := miningCalculator.CalculateTotalHashPower(ctx)
                
                // Get active miners count
                activeMiners, _ := miningCalculator.GetActiveMiners(ctx)
                
                // Calculate next block time
                nextBlockTime := time.Now().Truncate(time.Hour).Add(time.Hour)
                
                // Broadcast to all connected clients
                wsHub.BroadcastBlockUpdate(websocket.BlockUpdate{
                        BlockHeight:    block.BlockHeight,
                        TotalReward:    block.TotalReward,
                        TotalHashPower: totalHashPower,
                        ActiveMiners:   len(activeMiners),
                        NextBlockTime:  nextBlockTime,
                        GlobalHashrate: totalHashPower,
                })
                
                // Send user-specific updates
                for _, miner := range activeMiners {
                        userID := miner["userID"].(string)
                        
                        // Check if user is frozen (cast interface{} to bool if present)
                        isFrozen := false
                        if frozen, ok := miner["isFrozen"].(bool); ok {
                                isFrozen = frozen
                        }
                        
                        // Get unclaimed blocks for this user
                        unclaimedBlocks, _ := miningCalculator.GetUnclaimedBlocks(ctx, userID)
                        var totalUnclaimed decimal.Decimal
                        var lastReward decimal.Decimal
                        
                        // If user is frozen or suspended, they get zero rewards
                        suspended := miner["suspended"].(bool)
                        if !isFrozen && !suspended {
                                for _, block := range unclaimedBlocks {
                                        reward, _ := decimal.NewFromString(block["userReward"].(string))
                                        totalUnclaimed = totalUnclaimed.Add(reward)
                                        if lastReward.IsZero() {
                                                lastReward = reward
                                        }
                                }
                        }
                        
                        hashPower, _ := decimal.NewFromString(miner["hashPower"].(string))
                        personalHeight := miner["personalBlockHeight"].(int64)
                        unclaimedCount := miner["unclaimedBlocks"].(int)
                        
                        // Zero out hash power for frozen/suspended users in WebSocket updates
                        if isFrozen || suspended {
                                hashPower = decimal.Zero
                        }
                        
                        wsHub.SendUserUpdate(userID, websocket.UserMiningUpdate{
                                UserID:               userID,
                                PersonalBlockHeight:  int(personalHeight),
                                UnclaimedRewards:     totalUnclaimed,
                                HashPower:            hashPower,
                                BlocksParticipated:   int(personalHeight),
                                LastReward:           lastReward,
                                MiningActive:         !suspended && !isFrozen,
                                BlocksUntilSuspension: 24 - unclaimedCount,
                                UnclaimedBlocksCount: unclaimedCount,
                                MiningSuspended:      suspended || isFrozen,
                        })
                }
        })

        // Start hourly block generation
        miningCalculator.StartHourlyBlockGeneration()

        // Create router
        r := chi.NewRouter()

        // Middleware
        r.Use(middleware.Logger)
        r.Use(middleware.Recoverer)
        r.Use(middleware.RequestID)
        r.Use(middleware.RealIP)
        r.Use(middleware.Timeout(60 * time.Second))

        // CORS configuration - build allowed origins dynamically
        allowedOrigins := []string{"http://localhost:5000", "http://localhost:5173", "http://localhost:8080"}
        if replitDomain := os.Getenv("REPLIT_DEV_DOMAIN"); replitDomain != "" {
                allowedOrigins = append(allowedOrigins, "https://"+replitDomain)
        }
        r.Use(cors.Handler(cors.Options{
                AllowedOrigins:   allowedOrigins,
                AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
                AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
                ExposedHeaders:   []string{"Link"},
                AllowCredentials: true,
                MaxAge:           300,
        }))

        // Routes
        r.Route("/api", func(r chi.Router) {
                // Public routes
                r.Post("/register", handleRegister)
                r.Post("/login", handleLogin)
                r.Post("/logout", handleLogout)
                r.Get("/global-stats", handleGlobalStats)

                // WebSocket endpoint
                r.Get("/ws", handleWebSocket)

                // Protected routes
                r.Group(func(r chi.Router) {
                        r.Use(authMiddleware)
                        
                        r.Get("/user", handleGetUser)
                        r.Get("/mining/status", handleMiningStatus)
                        r.Post("/mining/claim", handleClaimRewards)
                        r.Post("/mining/claim-all", handleClaimAllRewards)
                        r.Get("/mining/history", handleMiningHistory)
                        r.Get("/mining/unclaimed-blocks", handleUnclaimedBlocks)
                })

                // Admin routes
                r.Group(func(r chi.Router) {
                        r.Use(authMiddleware)
                        r.Use(adminMiddleware)
                        
                        r.Post("/mining/generate-block", handleManualBlockGeneration)
                        r.Get("/mining/active-miners", handleActiveMiners)
                })
        })

        // Start server
        port := os.Getenv("GO_PORT")
        if port == "" {
                port = "8080"
        }

        log.Printf("Go backend starting on port %s", port)
        log.Printf("WebSocket endpoint: ws://localhost:%s/api/ws", port)

        // Create server
        srv := &http.Server{
                Addr:    ":" + port,
                Handler: r,
        }

        // Graceful shutdown
        go func() {
                sigCh := make(chan os.Signal, 1)
                signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)
                <-sigCh

                log.Println("Shutting down server...")
                ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
                defer cancel()

                miningCalculator.Stop()
                srv.Shutdown(ctx)
        }()

        // Start the server
        log.Printf("Server listening on %s", srv.Addr)
        if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
                log.Fatalf("Server failed to start: %v", err)
        }
}

// WebSocket handler
func handleWebSocket(w http.ResponseWriter, r *http.Request) {
        // Get user from session or allow anonymous connections
        session, _ := store.Get(r, "session")
        userID, _ := session.Values["user_id"].(string)
        username := "anonymous"

        if userID != "" {
                user, err := getUserByID(r.Context(), userID)
                if err == nil && user != nil {
                        username = user.Username
                }
        }

        websocket.ServeWS(wsHub, w, r, userID, username)
}

// Mining status handler
func handleMiningStatus(w http.ResponseWriter, r *http.Request) {
        user := getUserFromContext(r.Context())
        if user == nil {
                writeErrorResponse(w, http.StatusUnauthorized, "Authentication required")
                return
        }

        status, err := miningCalculator.GetUserMiningStatus(r.Context(), user.ID)
        if err != nil {
                writeErrorResponse(w, http.StatusInternalServerError, "Failed to get mining status")
                return
        }

        // Add current block info
        var currentBlock int64
        var blockReward string
        err = database.GetDB().QueryRow(r.Context(), `
                SELECT block_number, reward 
                FROM mining_blocks 
                ORDER BY block_number DESC 
                LIMIT 1
        `).Scan(&currentBlock, &blockReward)

        if err == nil {
                status["currentBlock"] = currentBlock
                status["currentBlockReward"] = blockReward
        }

        // Calculate next block time
        now := time.Now()
        nextHour := now.Truncate(time.Hour).Add(time.Hour)
        status["nextBlockTime"] = nextHour.Unix()
        status["secondsUntilNextBlock"] = int(nextHour.Sub(now).Seconds())

        writeJSONResponse(w, http.StatusOK, status)
}

// Claim rewards handler
func handleClaimRewards(w http.ResponseWriter, r *http.Request) {
        user := getUserFromContext(r.Context())
        if user == nil {
                writeErrorResponse(w, http.StatusUnauthorized, "Authentication required")
                return
        }

        var req struct {
                BlockID string `json:"blockId"`
        }

        if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
                writeErrorResponse(w, http.StatusBadRequest, "Invalid request format")
                return
        }

        // Start transaction to atomically claim block and credit user
        tx, err := database.GetDB().Begin(r.Context())
        if err != nil {
                writeErrorResponse(w, http.StatusInternalServerError, "Failed to start transaction")
                return
        }
        defer tx.Rollback(r.Context())

        // Claim the specific block within the transaction
        var reward string
        var blockNumber int64
        err = tx.QueryRow(r.Context(), `
                UPDATE unclaimed_blocks 
                SET claimed = true, claimed_at = NOW()
                WHERE id = $1 AND user_id = $2 AND claimed = false
                RETURNING reward, block_number
        `, req.BlockID, user.ID).Scan(&reward, &blockNumber)

        if err != nil {
                if err == pgx.ErrNoRows {
                        writeErrorResponse(w, http.StatusNotFound, "Block not found or already claimed")
                } else {
                        writeErrorResponse(w, http.StatusInternalServerError, "Failed to claim block")
                }
                return
        }

        // Update user's balances and decrement unclaimed blocks count
        rewardDec, _ := decimal.NewFromString(reward)
        newUnclaimedBalance := user.UnclaimedBalance.Sub(rewardDec)
        newB2BBalance := user.B2BBalance.Add(rewardDec)

        // Decrement unclaimed blocks count and reset suspension if below 24
        _, err = tx.Exec(r.Context(), `
                UPDATE users 
                SET unclaimed_balance = $1, 
                    b2b_balance = $2,
                    last_claimed_block = $3,
                    last_activity_time = NOW(),
                    mining_active = true,
                    unclaimed_blocks_count = GREATEST(0, unclaimed_blocks_count - 1),
                    mining_suspended = CASE 
                        WHEN unclaimed_blocks_count - 1 < 24 THEN false
                        ELSE mining_suspended
                    END
                WHERE id = $4
        `, newUnclaimedBalance.String(), newB2BBalance.String(), blockNumber, user.ID)

        if err != nil {
                writeErrorResponse(w, http.StatusInternalServerError, "Failed to update balances")
                return
        }

        if err = tx.Commit(r.Context()); err != nil {
                writeErrorResponse(w, http.StatusInternalServerError, "Failed to commit transaction")
                return
        }

        // Broadcast update to user
        wsHub.SendUserUpdate(user.ID, websocket.UserMiningUpdate{
                UserID:              user.ID,
                PersonalBlockHeight: user.PersonalBlockHeight,
                UnclaimedRewards:    newUnclaimedBalance,
                HashPower:          user.HashPower,
                BlocksParticipated: user.PersonalBlockHeight,
                LastReward:         rewardDec,
                MiningActive:       true,
        })

        writeJSONResponse(w, http.StatusOK, map[string]interface{}{
                "success":          true,
                "reward":          reward,
                "newB2BBalance":   newB2BBalance.String(),
                "unclaimedBalance": newUnclaimedBalance.String(),
                "blockNumber":     blockNumber,
        })
}

// Claim all rewards handler
func handleClaimAllRewards(w http.ResponseWriter, r *http.Request) {
        user := getUserFromContext(r.Context())
        if user == nil {
                writeErrorResponse(w, http.StatusUnauthorized, "Authentication required")
                return
        }

        // Start transaction
        tx, err := database.GetDB().Begin(r.Context())
        if err != nil {
                writeErrorResponse(w, http.StatusInternalServerError, "Failed to start transaction")
                return
        }
        defer tx.Rollback(r.Context())

        // Get all unclaimed blocks (no expiry check - rewards are permanent)
        rows, err := tx.Query(r.Context(), `
                SELECT id, reward, block_number 
                FROM unclaimed_blocks 
                WHERE user_id = $1 AND claimed = false
                FOR UPDATE
        `, user.ID)
        
        if err != nil {
                writeErrorResponse(w, http.StatusInternalServerError, "Failed to get unclaimed blocks")
                return
        }
        defer rows.Close()

        var totalReward decimal.Decimal
        var blockCount int
        var maxBlockNumber int64
        var blockIDs []string

        for rows.Next() {
                var id, rewardStr string
                var blockNum int64
                if err := rows.Scan(&id, &rewardStr, &blockNum); err != nil {
                        continue
                }

                reward, _ := decimal.NewFromString(rewardStr)
                totalReward = totalReward.Add(reward)
                blockCount++
                blockIDs = append(blockIDs, id)
                if blockNum > maxBlockNumber {
                        maxBlockNumber = blockNum
                }
        }

        if blockCount == 0 {
                writeErrorResponse(w, http.StatusNotFound, "No unclaimed blocks found")
                return
        }

        // Mark all blocks as claimed
        for _, blockID := range blockIDs {
                _, err = tx.Exec(r.Context(), `
                        UPDATE unclaimed_blocks 
                        SET claimed = true, claimed_at = NOW()
                        WHERE id = $1
                `, blockID)
                if err != nil {
                        writeErrorResponse(w, http.StatusInternalServerError, "Failed to claim blocks")
                        return
                }
        }

        // Update user balances and reset suspension
        newB2BBalance := user.B2BBalance.Add(totalReward)
        newUnclaimedBalance := decimal.Zero

        _, err = tx.Exec(r.Context(), `
                UPDATE users 
                SET b2b_balance = $1, 
                    unclaimed_balance = $2,
                    last_claimed_block = $3,
                    last_activity_time = NOW(),
                    mining_active = true,
                    unclaimed_blocks_count = 0,
                    mining_suspended = false
                WHERE id = $4
        `, newB2BBalance.String(), newUnclaimedBalance.String(), maxBlockNumber, user.ID)

        if err != nil {
                writeErrorResponse(w, http.StatusInternalServerError, "Failed to update balances")
                return
        }

        // Commit transaction
        if err = tx.Commit(r.Context()); err != nil {
                writeErrorResponse(w, http.StatusInternalServerError, "Failed to commit transaction")
                return
        }

        // Broadcast update
        wsHub.SendUserUpdate(user.ID, websocket.UserMiningUpdate{
                UserID:              user.ID,
                PersonalBlockHeight: user.PersonalBlockHeight,
                UnclaimedRewards:    newUnclaimedBalance,
                HashPower:          user.HashPower,
                BlocksParticipated: user.PersonalBlockHeight,
                LastReward:         totalReward,
                MiningActive:       true,
        })

        writeJSONResponse(w, http.StatusOK, map[string]interface{}{
                "success":          true,
                "blocksClmed":    blockCount,
                "totalReward":     totalReward.String(),
                "newB2BBalance":   newB2BBalance.String(),
                "unclaimedBalance": "0",
        })
}

// Get mining history
func handleMiningHistory(w http.ResponseWriter, r *http.Request) {
        user := getUserFromContext(r.Context())
        if user == nil {
                writeErrorResponse(w, http.StatusUnauthorized, "Authentication required")
                return
        }

        rows, err := database.GetDB().Query(r.Context(), `
                SELECT block_number, locked_hashrate, reward, claimed_at
                FROM mining_history
                WHERE user_id = $1
                ORDER BY block_number DESC
                LIMIT 50
        `, user.ID)

        if err != nil {
                writeErrorResponse(w, http.StatusInternalServerError, "Failed to get mining history")
                return
        }
        defer rows.Close()

        var history []map[string]interface{}
        for rows.Next() {
                var blockNumber int64
                var hashrate, reward string
                var claimedAt time.Time

                if err := rows.Scan(&blockNumber, &hashrate, &reward, &claimedAt); err != nil {
                        continue
                }

                history = append(history, map[string]interface{}{
                        "blockNumber": blockNumber,
                        "hashrate":    hashrate,
                        "reward":      reward,
                        "claimedAt":   claimedAt,
                })
        }

        writeJSONResponse(w, http.StatusOK, history)
}

// Get unclaimed blocks
func handleUnclaimedBlocks(w http.ResponseWriter, r *http.Request) {
        user := getUserFromContext(r.Context())
        if user == nil {
                writeErrorResponse(w, http.StatusUnauthorized, "Authentication required")
                return
        }

        rows, err := database.GetDB().Query(r.Context(), `
                SELECT ub.id, ub.block_number, ub.reward, ub.created_at,
                       mb.timestamp as block_time
                FROM unclaimed_blocks ub
                JOIN mining_blocks mb ON mb.block_number = ub.block_number
                WHERE ub.user_id = $1 AND ub.claimed = false
                ORDER BY ub.block_number DESC
        `, user.ID)

        if err != nil {
                writeErrorResponse(w, http.StatusInternalServerError, "Failed to get unclaimed blocks")
                return
        }
        defer rows.Close()

        var blocks []map[string]interface{}
        for rows.Next() {
                var id string
                var blockNumber int64
                var reward string
                var createdAt, blockTime time.Time

                if err := rows.Scan(&id, &blockNumber, &reward, &createdAt, &blockTime); err != nil {
                        continue
                }

                // Generate a consistent hash-like string for the block
                // Using block number to create a deterministic hash appearance
                hashStr := fmt.Sprintf("%x", sha256.Sum256([]byte(fmt.Sprintf("block-%d", blockNumber))))
                // Format as 5chars...5chars
                blockHash := hashStr[:5] + "..." + hashStr[len(hashStr)-5:]

                blocks = append(blocks, map[string]interface{}{
                        "id":          id,
                        "blockNumber": blockNumber,
                        "blockHash":   blockHash,
                        "reward":      reward,
                        "createdAt":   createdAt,
                        "blockTime":   blockTime,
                        "permanent":   true, // Rewards never expire
                })
        }

        writeJSONResponse(w, http.StatusOK, blocks)
}

// Manual block generation (admin only)
func handleManualBlockGeneration(w http.ResponseWriter, r *http.Request) {
        block, err := miningCalculator.GenerateNewBlock(r.Context())
        if err != nil {
                writeErrorResponse(w, http.StatusInternalServerError, fmt.Sprintf("Failed to generate block: %v", err))
                return
        }

        if block == nil {
                writeErrorResponse(w, http.StatusBadRequest, "No active miners to generate block")
                return
        }

        // Broadcast block update - use DB count for accurate active miner count
        totalHashPower, _ := miningCalculator.CalculateTotalHashPower(r.Context())
        var activeMiners int
        database.GetDB().QueryRow(r.Context(), `
                SELECT COUNT(*) FROM users WHERE mining_active = true AND hash_power > 0
        `).Scan(&activeMiners)

        wsHub.BroadcastBlockUpdate(websocket.BlockUpdate{
                BlockHeight:    block.BlockHeight,
                TotalReward:    block.TotalReward,
                TotalHashPower: totalHashPower,
                ActiveMiners:   activeMiners,
                NextBlockTime:  time.Now().Add(time.Hour),
                GlobalHashrate: totalHashPower,
        })

        writeJSONResponse(w, http.StatusOK, map[string]interface{}{
                "success":        true,
                "blockHeight":    block.BlockHeight,
                "reward":         block.TotalReward.String(),
                "totalHashPower": totalHashPower.String(),
                "activeMiners":   activeMiners,
        })
}

// Get active miners (admin only)
func handleActiveMiners(w http.ResponseWriter, r *http.Request) {
        rows, err := database.GetDB().Query(r.Context(), `
                SELECT username, hash_power, personal_block_height, unclaimed_balance
                FROM users
                WHERE mining_active = true AND hash_power > 0
                ORDER BY hash_power DESC
                LIMIT 100
        `)

        if err != nil {
                writeErrorResponse(w, http.StatusInternalServerError, "Failed to get active miners")
                return
        }
        defer rows.Close()

        var miners []map[string]interface{}
        for rows.Next() {
                var username, hashPower, unclaimedBalance string
                var personalBlockHeight sql.NullInt64

                if err := rows.Scan(&username, &hashPower, &personalBlockHeight, &unclaimedBalance); err != nil {
                        continue
                }

                miners = append(miners, map[string]interface{}{
                        "username":            username,
                        "hashPower":           hashPower,
                        "personalBlockHeight": personalBlockHeight.Int64,
                        "unclaimedBalance":    unclaimedBalance,
                })
        }

        writeJSONResponse(w, http.StatusOK, map[string]interface{}{
                "totalMiners": len(miners),
                "miners":      miners,
        })
}

// Global stats endpoint
func handleGlobalStats(w http.ResponseWriter, r *http.Request) {
        var totalHashrate, totalCirculation string
        var blockHeight, activeMiners int64

        // Get total hashrate
        database.GetDB().QueryRow(r.Context(),
                "SELECT COALESCE(SUM(hash_power), 0)::text FROM users WHERE mining_active = true").Scan(&totalHashrate)

        // Get current block height
        database.GetDB().QueryRow(r.Context(),
                "SELECT COALESCE(MAX(block_number), 0) FROM mining_blocks").Scan(&blockHeight)

        // Get active miners count
        database.GetDB().QueryRow(r.Context(),
                "SELECT COUNT(*) FROM users WHERE mining_active = true AND hash_power > 0").Scan(&activeMiners)

        // Get total circulation (sum of all mined rewards)
        database.GetDB().QueryRow(r.Context(),
                "SELECT COALESCE(SUM(reward), 0)::text FROM mining_blocks").Scan(&totalCirculation)

        // Calculate current block reward
        halvings := blockHeight / 210000
        divisor := int64(1 << halvings)
        currentReward := decimal.NewFromFloat(3200).Div(decimal.NewFromInt(divisor))

        stats := map[string]interface{}{
                "totalHashrate":       totalHashrate,
                "blockHeight":         blockHeight,
                "activeMiners":        activeMiners,
                "blockReward":         currentReward.String(),
                "totalCirculation":    totalCirculation,
                "maxSupply":           21000000,
                "nextHalving":         ((blockHeight/210000)+1)*210000,
                "blocksUntilHalving":  ((blockHeight/210000)+1)*210000 - blockHeight,
        }

        writeJSONResponse(w, http.StatusOK, stats)
}

// Helper functions

func getUserByID(ctx context.Context, userID string) (*User, error) {
        query := `
                SELECT id, username, access_key, referral_code, referred_by, registration_ip,
                       usdt_balance, btc_balance, hash_power, base_hash_power, referral_hash_bonus,
                       b2b_balance, unclaimed_balance, total_referral_earnings, last_active_block,
                       personal_block_height, last_claimed_block, mining_active,
                       is_admin, is_frozen, is_banned, has_started_mining, created_at
                FROM users WHERE id = $1
        `

        var user User
        var usdtStr, btcStr, hashStr, baseHashStr, refHashStr, b2bStr, unclaimedStr, refEarningsStr string

        err := database.GetDB().QueryRow(ctx, query, userID).Scan(
                &user.ID, &user.Username, &user.AccessKey, &user.ReferralCode, &user.ReferredBy,
                &user.RegistrationIP, &usdtStr, &btcStr, &hashStr,
                &baseHashStr, &refHashStr, &b2bStr, &unclaimedStr,
                &refEarningsStr, &user.LastActiveBlock, &user.PersonalBlockHeight,
                &user.LastClaimedBlock, &user.MiningActive,
                &user.IsAdmin, &user.IsFrozen, &user.IsBanned, &user.HasStartedMining, &user.CreatedAt,
        )

        if err == nil {
                user.USDTBalance, _ = decimal.NewFromString(usdtStr)
                user.BTCBalance, _ = decimal.NewFromString(btcStr)
                user.HashPower, _ = decimal.NewFromString(hashStr)
                user.BaseHashPower, _ = decimal.NewFromString(baseHashStr)
                user.ReferralHashBonus, _ = decimal.NewFromString(refHashStr)
                user.B2BBalance, _ = decimal.NewFromString(b2bStr)
                user.UnclaimedBalance, _ = decimal.NewFromString(unclaimedStr)
                user.TotalReferralEarnings, _ = decimal.NewFromString(refEarningsStr)
        }

        if err != nil {
                if err == pgx.ErrNoRows {
                        return nil, nil
                }
                return nil, fmt.Errorf("failed to get user by ID: %w", err)
        }

        return &user, nil
}

func getUserByUsername(ctx context.Context, username string) (*User, error) {
        query := `
                SELECT id, username, access_key, referral_code, referred_by, registration_ip,
                       usdt_balance, btc_balance, hash_power, base_hash_power, referral_hash_bonus,
                       b2b_balance, unclaimed_balance, total_referral_earnings, last_active_block,
                       personal_block_height, last_claimed_block, mining_active,
                       is_admin, is_frozen, is_banned, has_started_mining, created_at
                FROM users WHERE username = $1
        `

        var user User
        var usdtStr, btcStr, hashStr, baseHashStr, refHashStr, b2bStr, unclaimedStr, refEarningsStr string

        err := database.GetDB().QueryRow(ctx, query, username).Scan(
                &user.ID, &user.Username, &user.AccessKey, &user.ReferralCode, &user.ReferredBy,
                &user.RegistrationIP, &usdtStr, &btcStr, &hashStr,
                &baseHashStr, &refHashStr, &b2bStr, &unclaimedStr,
                &refEarningsStr, &user.LastActiveBlock, &user.PersonalBlockHeight,
                &user.LastClaimedBlock, &user.MiningActive,
                &user.IsAdmin, &user.IsFrozen, &user.IsBanned, &user.HasStartedMining, &user.CreatedAt,
        )

        if err == nil {
                user.USDTBalance, _ = decimal.NewFromString(usdtStr)
                user.BTCBalance, _ = decimal.NewFromString(btcStr)
                user.HashPower, _ = decimal.NewFromString(hashStr)
                user.BaseHashPower, _ = decimal.NewFromString(baseHashStr)
                user.ReferralHashBonus, _ = decimal.NewFromString(refHashStr)
                user.B2BBalance, _ = decimal.NewFromString(b2bStr)
                user.UnclaimedBalance, _ = decimal.NewFromString(unclaimedStr)
                user.TotalReferralEarnings, _ = decimal.NewFromString(refEarningsStr)
        }

        if err != nil {
                if err == pgx.ErrNoRows {
                        return nil, nil
                }
                return nil, fmt.Errorf("failed to get user: %w", err)
        }

        return &user, nil
}

func authMiddleware(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
                session, _ := store.Get(r, "session")

                userID, ok := session.Values["user_id"].(string)
                if !ok || userID == "" {
                        writeErrorResponse(w, http.StatusUnauthorized, "Authentication required")
                        return
                }

                user, err := getUserByID(r.Context(), userID)
                if err != nil || user == nil {
                        writeErrorResponse(w, http.StatusUnauthorized, "Invalid session")
                        return
                }

                if user.IsBanned {
                        writeErrorResponse(w, http.StatusForbidden, "Account is banned")
                        return
                }

                if user.IsFrozen {
                        writeErrorResponse(w, http.StatusForbidden, "Account is frozen")
                        return
                }

                ctx := context.WithValue(r.Context(), "user", user)
                next.ServeHTTP(w, r.WithContext(ctx))
        })
}

func adminMiddleware(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
                user := getUserFromContext(r.Context())
                if user == nil || !user.IsAdmin {
                        writeErrorResponse(w, http.StatusForbidden, "Admin access required")
                        return
                }

                next.ServeHTTP(w, r)
        })
}

func handleRegister(w http.ResponseWriter, r *http.Request) {
        // Implementation from original main.go
        writeErrorResponse(w, http.StatusNotImplemented, "Registration handled by Node.js backend")
}

func handleLogin(w http.ResponseWriter, r *http.Request) {
        // Implementation from original main.go
        writeErrorResponse(w, http.StatusNotImplemented, "Login handled by Node.js backend")
}

func handleLogout(w http.ResponseWriter, r *http.Request) {
        session, _ := store.Get(r, "session")
        session.Values["user_id"] = nil
        session.Options.MaxAge = -1
        session.Save(r, w)

        writeJSONResponse(w, http.StatusOK, map[string]string{"message": "Logged out successfully"})
}

func handleGetUser(w http.ResponseWriter, r *http.Request) {
        user := getUserFromContext(r.Context())
        if user == nil {
                writeErrorResponse(w, http.StatusUnauthorized, "Authentication required")
                return
        }

        // Check if user is frozen - if so, zero out hash power in response only
        // This preserves the original values for when the user is unfrozen
        if user.IsFrozen {
                log.Printf("Frozen user %s accessed - returning zeroed hash power", user.Username)
                userResponse := map[string]interface{}{
                        "id":                    user.ID,
                        "username":              user.Username,
                        "referralCode":          user.ReferralCode,
                        "usdtBalance":           user.USDTBalance.String(),
                        "btcBalance":            user.BTCBalance.String(),
                        "hashPower":             "0.00",
                        "baseHashPower":         "0.00",
                        "referralHashBonus":     "0.00",
                        "lockedHashPower":       "0.00",
                        "nextBlockHashPower":    "0.00",
                        "b2bBalance":            user.B2BBalance.String(),
                        "unclaimedBalance":      user.UnclaimedBalance.String(),
                        "totalReferralEarnings": user.TotalReferralEarnings.String(),
                        "personalBlockHeight":   user.PersonalBlockHeight,
                        "lastClaimedBlock":      user.LastClaimedBlock,
                        "miningActive":          false,
                        "isAdmin":               user.IsAdmin,
                        "isFrozen":              user.IsFrozen,
                        "hasStartedMining":      user.HasStartedMining,
                        "lastActiveBlock":       user.LastActiveBlock,
                        "createdAt":             user.CreatedAt,
                }
                writeJSONResponse(w, http.StatusOK, userResponse)
                return
        }

        // Normal user response with actual hash power values
        userResponse := map[string]interface{}{
                "id":                    user.ID,
                "username":              user.Username,
                "referralCode":          user.ReferralCode,
                "usdtBalance":           user.USDTBalance.String(),
                "btcBalance":            user.BTCBalance.String(),
                "hashPower":             user.HashPower.String(),
                "baseHashPower":         user.BaseHashPower.String(),
                "referralHashBonus":     user.ReferralHashBonus.String(),
                "b2bBalance":            user.B2BBalance.String(),
                "unclaimedBalance":      user.UnclaimedBalance.String(),
                "totalReferralEarnings": user.TotalReferralEarnings.String(),
                "personalBlockHeight":   user.PersonalBlockHeight,
                "lastClaimedBlock":      user.LastClaimedBlock,
                "miningActive":          user.MiningActive,
                "isAdmin":               user.IsAdmin,
                "isFrozen":              user.IsFrozen,
                "hasStartedMining":      user.HasStartedMining,
                "lastActiveBlock":       user.LastActiveBlock,
                "createdAt":             user.CreatedAt,
        }

        writeJSONResponse(w, http.StatusOK, userResponse)
}

func getUserFromContext(ctx context.Context) *User {
        user, _ := ctx.Value("user").(*User)
        return user
}

func getClientIP(r *http.Request) string {
        ip := r.Header.Get("X-Real-IP")
        if ip == "" {
                ip = r.Header.Get("X-Forwarded-For")
                if ip != "" {
                        parts := strings.Split(ip, ",")
                        ip = strings.TrimSpace(parts[0])
                }
        }
        if ip == "" {
                ip = r.RemoteAddr
                if colon := strings.LastIndex(ip, ":"); colon != -1 {
                        ip = ip[:colon]
                }
        }
        return ip
}

func generateReferralCode(username string) string {
        prefix := strings.ToUpper(username[:min(3, len(username))])
        b := make([]byte, 5)
        rand.Read(b)
        suffix := base64.URLEncoding.EncodeToString(b)[:5]
        return fmt.Sprintf("%s%s", prefix, suffix)
}

func min(a, b int) int {
        if a < b {
                return a
        }
        return b
}

func splitHashedKey(hashedKey string) []string {
        return strings.Split(hashedKey, ":")
}

func compareHashes(a, b []byte) bool {
        if len(a) != len(b) {
                return false
        }
        for i := range a {
                if a[i] != b[i] {
                        return false
                }
        }
        return true
}

func verifyAccessKey(hashedKey, plainKey string) bool {
        parts := splitHashedKey(hashedKey)
        if len(parts) != 2 {
                return false
        }

        storedHash, err := base64.StdEncoding.DecodeString(parts[0])
        if err != nil {
                return false
        }

        salt, err := base64.StdEncoding.DecodeString(parts[1])
        if err != nil {
                return false
        }

        hash, err := scrypt.Key([]byte(plainKey), salt, 32768, 8, 1, 32)
        if err != nil {
                return false
        }

        return compareHashes(storedHash, hash)
}

func writeJSONResponse(w http.ResponseWriter, status int, data interface{}) {
        w.Header().Set("Content-Type", "application/json")
        w.WriteHeader(status)
        json.NewEncoder(w).Encode(data)
}

func writeErrorResponse(w http.ResponseWriter, status int, message string) {
        writeJSONResponse(w, status, map[string]string{"message": message})
}