package main

import (
        "context"
        "encoding/json"
        "net/http"
        "strings"
)

// Authentication middleware
func authMiddleware(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
                session, _ := store.Get(r, "session")
                
                userID, ok := session.Values["user_id"].(string)
                if !ok || userID == "" {
                        writeErrorResponse(w, http.StatusUnauthorized, "Authentication required")
                        return
                }
                
                // Get user from database
                user, err := getUserByID(r.Context(), userID)
                if err != nil || user == nil {
                        writeErrorResponse(w, http.StatusUnauthorized, "Invalid session")
                        return
                }
                
                // Check if user is banned or frozen
                if user.IsBanned {
                        writeErrorResponse(w, http.StatusForbidden, "Account is banned")
                        return
                }
                
                if user.IsFrozen {
                        writeErrorResponse(w, http.StatusForbidden, "Account is frozen")
                        return
                }
                
                // Add user to request context
                ctx := context.WithValue(r.Context(), "user", user)
                next.ServeHTTP(w, r.WithContext(ctx))
        })
}

// Admin middleware
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

// Register handler
func handleRegister(w http.ResponseWriter, r *http.Request) {
        var req RegisterRequest
        if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
                writeErrorResponse(w, http.StatusBadRequest, "Invalid request format")
                return
        }
        
        // Validate request
        if req.Username == "" || len(req.Username) < 3 || len(req.Username) > 20 {
                writeErrorResponse(w, http.StatusBadRequest, "Username must be 3-20 characters")
                return
        }
        
        if req.AccessKey == "" || len(req.AccessKey) < 6 {
                writeErrorResponse(w, http.StatusBadRequest, "Access key must be at least 6 characters")
                return
        }
        
        // Check if username already exists
        existingUser, err := getUserByUsername(r.Context(), req.Username)
        if err != nil {
                writeErrorResponse(w, http.StatusInternalServerError, "Database error")
                return
        }
        
        if existingUser != nil {
                writeErrorResponse(w, http.StatusConflict, "Username already exists")
                return
        }
        
        // Get client IP
        clientIP := getClientIP(r)
        
        // Create user
        user, err := createUser(r.Context(), req, clientIP)
        if err != nil {
                writeErrorResponse(w, http.StatusInternalServerError, "Failed to create user")
                return
        }
        
        // Create session
        session, _ := store.Get(r, "session")
        session.Values["user_id"] = user.ID
        session.Save(r, w)
        
        // Return user data (without sensitive fields)
        userResponse := map[string]interface{}{
                "id":                    user.ID,
                "username":              user.Username,
                "referralCode":          user.ReferralCode,
                "usdtBalance":           user.USDTBalance.String(),
                "btcBalance":            user.BTCBalance.String(),
                "hashPower":             user.HashPower.String(),
                "gbtcBalance":           user.GBTCBalance.String(),
                "unclaimedBalance":      user.UnclaimedBalance.String(),
                "totalReferralEarnings": user.TotalReferralEarnings.String(),
                "isAdmin":               user.IsAdmin,
                "hasStartedMining":      user.HasStartedMining,
                "kycVerified":           user.KYCVerified,
                "createdAt":             user.CreatedAt,
        }
        
        writeJSONResponse(w, http.StatusCreated, userResponse)
}

// Login handler
func handleLogin(w http.ResponseWriter, r *http.Request) {
        var req LoginRequest
        if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
                writeErrorResponse(w, http.StatusBadRequest, "Invalid request format")
                return
        }
        
        // Get user by username
        user, err := getUserByUsername(r.Context(), req.Username)
        if err != nil {
                writeErrorResponse(w, http.StatusInternalServerError, "Database error")
                return
        }
        
        if user == nil {
                writeErrorResponse(w, http.StatusUnauthorized, "Invalid credentials")
                return
        }
        
        // Verify access key
        if !verifyAccessKey(user.AccessKey, req.AccessKey) {
                writeErrorResponse(w, http.StatusUnauthorized, "Invalid credentials")
                return
        }
        
        // Check if user is banned or frozen
        if user.IsBanned {
                writeErrorResponse(w, http.StatusForbidden, "Account is banned")
                return
        }
        
        if user.IsFrozen {
                writeErrorResponse(w, http.StatusForbidden, "Account is frozen")
                return
        }
        
        // Create session
        session, _ := store.Get(r, "session")
        session.Values["user_id"] = user.ID
        session.Save(r, w)
        
        // Return user data (without sensitive fields)
        userResponse := map[string]interface{}{
                "id":                    user.ID,
                "username":              user.Username,
                "referralCode":          user.ReferralCode,
                "usdtBalance":           user.USDTBalance.String(),
                "btcBalance":            user.BTCBalance.String(),
                "hashPower":             user.HashPower.String(),
                "gbtcBalance":           user.GBTCBalance.String(),
                "unclaimedBalance":      user.UnclaimedBalance.String(),
                "totalReferralEarnings": user.TotalReferralEarnings.String(),
                "isAdmin":               user.IsAdmin,
                "hasStartedMining":      user.HasStartedMining,
                "kycVerified":           user.KYCVerified,
                "lastActiveBlock":       user.LastActiveBlock,
                "createdAt":             user.CreatedAt,
        }
        
        writeJSONResponse(w, http.StatusOK, userResponse)
}

// Logout handler
func handleLogout(w http.ResponseWriter, r *http.Request) {
        session, _ := store.Get(r, "session")
        session.Values["user_id"] = nil
        session.Options.MaxAge = -1
        session.Save(r, w)
        
        writeJSONResponse(w, http.StatusOK, map[string]string{"message": "Logged out successfully"})
}

// Device check handler
func handleDeviceCheck(w http.ResponseWriter, r *http.Request) {
        var req DeviceCheckRequest
        if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
                writeErrorResponse(w, http.StatusBadRequest, "Invalid device data format")
                return
        }
        
        // Get client IP
        clientIP := getClientIP(r)
        
        // Check/create device
        result, err := upsertDevice(r.Context(), req.ServerDeviceID, clientIP, req)
        if err != nil {
                writeErrorResponse(w, http.StatusInternalServerError, "Device check failed")
                return
        }
        
        writeJSONResponse(w, http.StatusOK, result)
}

// Device link handler  
func handleDeviceLink(w http.ResponseWriter, r *http.Request) {
        user := getUserFromContext(r.Context())
        if user == nil {
                writeErrorResponse(w, http.StatusUnauthorized, "Authentication required")
                return
        }
        
        var req struct {
                DeviceID string `json:"deviceId"`
        }
        
        if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
                writeErrorResponse(w, http.StatusBadRequest, "Invalid device ID format")
                return
        }
        
        if req.DeviceID == "" {
                writeErrorResponse(w, http.StatusBadRequest, "Device ID is required")
                return
        }
        
        // Link user to device
        if err := linkUserToDevice(r.Context(), user.ID, req.DeviceID); err != nil {
                writeErrorResponse(w, http.StatusInternalServerError, "Failed to link device")
                return
        }
        
        writeJSONResponse(w, http.StatusOK, map[string]bool{"success": true})
}

// Get current user handler
func handleGetUser(w http.ResponseWriter, r *http.Request) {
        user := getUserFromContext(r.Context())
        if user == nil {
                writeErrorResponse(w, http.StatusUnauthorized, "Authentication required")
                return
        }
        
        // Return user data (without sensitive fields)
        userResponse := map[string]interface{}{
                "id":                    user.ID,
                "username":              user.Username,
                "referralCode":          user.ReferralCode,
                "usdtBalance":           user.USDTBalance.String(),
                "btcBalance":            user.BTCBalance.String(),
                "hashPower":             user.HashPower.String(),
                "baseHashPower":         user.BaseHashPower.String(),
                "referralHashBonus":     user.ReferralHashBonus.String(),
                "gbtcBalance":           user.GBTCBalance.String(),
                "unclaimedBalance":      user.UnclaimedBalance.String(),
                "totalReferralEarnings": user.TotalReferralEarnings.String(),
                "isAdmin":               user.IsAdmin,
                "hasStartedMining":      user.HasStartedMining,
                "kycVerified":           user.KYCVerified,
                "lastActiveBlock":       user.LastActiveBlock,
                "createdAt":             user.CreatedAt,
        }
        
        writeJSONResponse(w, http.StatusOK, userResponse)
}

// Placeholder handlers for other endpoints
func handleCreateDeposit(w http.ResponseWriter, r *http.Request) {
        writeErrorResponse(w, http.StatusNotImplemented, "Deposit endpoint - implementation in progress")
}

func handleGetDeposits(w http.ResponseWriter, r *http.Request) {
        writeErrorResponse(w, http.StatusNotImplemented, "Get deposits endpoint - implementation in progress")
}

// Admin handlers
func handleGetUsers(w http.ResponseWriter, r *http.Request) {
        // Get all users (admin only)
        query := `
                SELECT id, username, referral_code, referred_by, registration_ip,
                       usdt_balance, btc_balance, hash_power, base_hash_power, referral_hash_bonus,
                       gbtc_balance, unclaimed_balance, total_referral_earnings, last_active_block,
                       is_admin, is_frozen, is_banned, has_started_mining, kyc_verified,
                       created_at
                FROM users ORDER BY created_at DESC
        `
        
        rows, err := db.Query(r.Context(), query)
        if err != nil {
                writeErrorResponse(w, http.StatusInternalServerError, "Failed to get users")
                return
        }
        defer rows.Close()
        
        var users []map[string]interface{}
        
        for rows.Next() {
                var user User
                err := rows.Scan(
                        &user.ID, &user.Username, &user.ReferralCode, &user.ReferredBy,
                        &user.RegistrationIP, &user.USDTBalance, &user.BTCBalance, &user.HashPower,
                        &user.BaseHashPower, &user.ReferralHashBonus, &user.GBTCBalance, &user.UnclaimedBalance,
                        &user.TotalReferralEarnings, &user.LastActiveBlock, &user.IsAdmin, &user.IsFrozen,
                        &user.IsBanned, &user.HasStartedMining, &user.KYCVerified, &user.CreatedAt,
                )
                if err != nil {
                        writeErrorResponse(w, http.StatusInternalServerError, "Failed to scan user")
                        return
                }
                
                userMap := map[string]interface{}{
                        "id":                    user.ID,
                        "username":              user.Username,
                        "referralCode":          user.ReferralCode,
                        "referredBy":            user.ReferredBy,
                        "registrationIp":        user.RegistrationIP,
                        "usdtBalance":           user.USDTBalance.String(),
                        "btcBalance":            user.BTCBalance.String(),
                        "hashPower":             user.HashPower.String(),
                        "baseHashPower":         user.BaseHashPower.String(),
                        "referralHashBonus":     user.ReferralHashBonus.String(),
                        "gbtcBalance":           user.GBTCBalance.String(),
                        "unclaimedBalance":      user.UnclaimedBalance.String(),
                        "totalReferralEarnings": user.TotalReferralEarnings.String(),
                        "lastActiveBlock":       user.LastActiveBlock,
                        "isAdmin":               user.IsAdmin,
                        "isFrozen":              user.IsFrozen,
                        "isBanned":              user.IsBanned,
                        "hasStartedMining":      user.HasStartedMining,
                        "kycVerified":           user.KYCVerified,
                        "createdAt":             user.CreatedAt,
                }
                
                users = append(users, userMap)
        }
        
        writeJSONResponse(w, http.StatusOK, users)
}

func handleAdminStats(w http.ResponseWriter, r *http.Request) {
        // Get admin dashboard stats
        type AdminStats struct {
                UserCount        int    `json:"userCount"`
                TotalDeposits    string `json:"totalDeposits"`
                TotalWithdrawals string `json:"totalWithdrawals"`
                TotalHashPower   string `json:"totalHashPower"`
        }
        
        var stats AdminStats
        
        // Get user count
        err := db.QueryRow(r.Context(), "SELECT COUNT(*) FROM users").Scan(&stats.UserCount)
        if err != nil {
                writeErrorResponse(w, http.StatusInternalServerError, "Failed to get user count")
                return
        }
        
        // Get total deposits (approved only)
        err = db.QueryRow(r.Context(), 
                "SELECT COALESCE(SUM(amount), 0) FROM deposits WHERE status = 'approved'").Scan(&stats.TotalDeposits)
        if err != nil {
                stats.TotalDeposits = "0.00"
        }
        
        // Get total withdrawals (completed only)
        err = db.QueryRow(r.Context(), 
                "SELECT COALESCE(SUM(amount), 0) FROM withdrawals WHERE status = 'completed'").Scan(&stats.TotalWithdrawals)
        if err != nil {
                stats.TotalWithdrawals = "0.00"
        }
        
        // Get total hash power
        err = db.QueryRow(r.Context(), 
                "SELECT COALESCE(SUM(hash_power), 0) FROM users").Scan(&stats.TotalHashPower)
        if err != nil {
                stats.TotalHashPower = "0.00"
        }
        
        writeJSONResponse(w, http.StatusOK, stats)
}

// Utility functions

func getUserFromContext(ctx context.Context) *User {
        if user, ok := ctx.Value("user").(*User); ok {
                return user
        }
        return nil
}

func getClientIP(r *http.Request) string {
        // Check X-Forwarded-For header first
        if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
                // X-Forwarded-For can contain multiple IPs, take the first one
                if ips := strings.Split(xff, ","); len(ips) > 0 {
                        return strings.TrimSpace(ips[0])
                }
        }
        
        // Check X-Real-IP header
        if xri := r.Header.Get("X-Real-IP"); xri != "" {
                return strings.TrimSpace(xri)
        }
        
        // Fall back to RemoteAddr
        ip := r.RemoteAddr
        if colon := strings.LastIndex(ip, ":"); colon != -1 {
                ip = ip[:colon]
        }
        
        return ip
}

func writeJSONResponse(w http.ResponseWriter, statusCode int, data interface{}) {
        w.Header().Set("Content-Type", "application/json")
        w.WriteHeader(statusCode)
        json.NewEncoder(w).Encode(data)
}

func writeErrorResponse(w http.ResponseWriter, statusCode int, message string) {
        w.Header().Set("Content-Type", "application/json")
        w.WriteHeader(statusCode)
        json.NewEncoder(w).Encode(ErrorResponse{Message: message})
}