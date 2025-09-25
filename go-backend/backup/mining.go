package main

import (
        "encoding/json"
        "net/http"

        "github.com/shopspring/decimal"
)

// Mining endpoints for Go backend

// Global stats endpoint
func handleGlobalStats(w http.ResponseWriter, r *http.Request) {
        stats := map[string]interface{}{
                "totalHashrate":       1000.0,
                "blockHeight":         1,
                "totalBlockHeight":    0,
                "activeMiners":        0,
                "blockReward":         50.0,
                "totalCirculation":    0.0,
                "maxSupply":           2100000,
                "nextHalving":         210000,
                "blocksUntilHalving":  210000,
        }
        
        // Get real data from database if possible
        var totalHashrate float64
        if err := db.QueryRow(r.Context(), 
                "SELECT COALESCE(SUM(hash_power), 0) FROM users").Scan(&totalHashrate); err == nil {
                stats["totalHashrate"] = totalHashrate
        }
        
        writeJSONResponse(w, http.StatusOK, stats)
}

// Purchase hash power endpoint  
func handlePurchasePower(w http.ResponseWriter, r *http.Request) {
        user := getUserFromContext(r.Context())
        if user == nil {
                writeErrorResponse(w, http.StatusUnauthorized, "Unauthorized")
                return
        }
        
        var req struct {
                Amount float64 `json:"amount"`
        }
        
        if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
                writeErrorResponse(w, http.StatusBadRequest, "Invalid request format")
                return
        }
        
        if req.Amount < 1 {
                writeErrorResponse(w, http.StatusBadRequest, "Minimum purchase is 1 USDT")
                return
        }
        
        // Check balance
        if user.USDTBalance.LessThan(decimal.NewFromFloat(req.Amount)) {
                writeErrorResponse(w, http.StatusBadRequest, "Insufficient USDT balance")
                return
        }
        
        // Update user balances - deduct USDT, add hash power
        newUSDT := user.USDTBalance.Sub(decimal.NewFromFloat(req.Amount))
        newHashPower := user.HashPower.Add(decimal.NewFromFloat(req.Amount))
        
        _, err := db.Exec(r.Context(), 
                "UPDATE users SET usdt_balance = $1, hash_power = $2 WHERE id = $3",
                newUSDT.String(), newHashPower.String(), user.ID)
        
        if err != nil {
                writeErrorResponse(w, http.StatusInternalServerError, "Failed to purchase hash power")
                return
        }
        
        writeJSONResponse(w, http.StatusOK, map[string]string{"message": "Hash power purchased successfully"})
}

// Start mining endpoint
func handleStartMining(w http.ResponseWriter, r *http.Request) {
        user := getUserFromContext(r.Context())
        if user == nil {
                writeErrorResponse(w, http.StatusUnauthorized, "Unauthorized")
                return
        }
        
        if user.HashPower.LessThanOrEqual(decimal.Zero) {
                writeErrorResponse(w, http.StatusBadRequest, "Hash power required to start mining")
                return
        }
        
        // Mark user as having started mining
        _, err := db.Exec(r.Context(), 
                "UPDATE users SET has_started_mining = true WHERE id = $1", user.ID)
        
        if err != nil {
                writeErrorResponse(w, http.StatusInternalServerError, "Failed to start mining")
                return
        }
        
        writeJSONResponse(w, http.StatusOK, map[string]string{"message": "Mining started successfully"})
}

// Claim rewards endpoint
func handleClaimRewards(w http.ResponseWriter, r *http.Request) {
        user := getUserFromContext(r.Context())
        if user == nil {
                writeErrorResponse(w, http.StatusUnauthorized, "Unauthorized")
                return
        }
        
        if user.UnclaimedBalance.LessThanOrEqual(decimal.Zero) {
                writeErrorResponse(w, http.StatusBadRequest, "No rewards to claim")
                return
        }
        
        // Move unclaimed to GBTC balance
        newGBTC := user.GBTCBalance.Add(user.UnclaimedBalance)
        
        _, err := db.Exec(r.Context(), 
                "UPDATE users SET gbtc_balance = $1, unclaimed_balance = '0' WHERE id = $2",
                newGBTC.String(), user.ID)
        
        if err != nil {
                writeErrorResponse(w, http.StatusInternalServerError, "Failed to claim rewards")
                return
        }
        
        writeJSONResponse(w, http.StatusOK, map[string]string{"message": "Rewards claimed successfully"})
}

// Supply metrics endpoint
func handleSupplyMetrics(w http.ResponseWriter, r *http.Request) {
        metrics := map[string]interface{}{
                "circulating":         "0.00000000",
                "currentBlockReward":  "50.00000000",
                "halvingProgress": map[string]interface{}{
                        "nextHalving":     210000,
                        "blocksRemaining": 210000,
                },
        }
        
        writeJSONResponse(w, http.StatusOK, metrics)
}

// BTC related endpoints
func handleBTCPrices(w http.ResponseWriter, r *http.Request) {
        prices := map[string]interface{}{
                "btcPrice":                "95000.00",
                "hashratePrice":           "1.00", 
                "requiredHashratePerBTC":  95000.0,
                "timestamp":               "2025-01-18T12:00:00Z",
        }
        
        writeJSONResponse(w, http.StatusOK, prices)
}

func handleBTCBalance(w http.ResponseWriter, r *http.Request) {
        user := getUserFromContext(r.Context())
        if user == nil {
                writeErrorResponse(w, http.StatusUnauthorized, "Unauthorized")
                return
        }
        
        writeJSONResponse(w, http.StatusOK, map[string]string{
                "btcBalance": user.BTCBalance.String(),
        })
}

// Referrals endpoint
func handleReferrals(w http.ResponseWriter, r *http.Request) {
        user := getUserFromContext(r.Context())
        if user == nil {
                writeErrorResponse(w, http.StatusUnauthorized, "Unauthorized")
                return
        }
        
        referralCode := user.Username[:min(6, len(user.Username))] + "123"
        if user.ReferralCode != nil {
                referralCode = *user.ReferralCode
        }
        
        response := map[string]interface{}{
                "referralCode":    referralCode,
                "totalReferrals":  0,
                "activeReferrals": 0,
                "totalEarnings":   user.TotalReferralEarnings.String(),
                "referrals":       []interface{}{},
        }
        
        writeJSONResponse(w, http.StatusOK, response)
}

func min(a, b int) int {
        if a < b {
                return a
        }
        return b
}