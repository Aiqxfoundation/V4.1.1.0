package main

import (
        "context"
        "crypto/rand"
        "encoding/base64"
        "fmt"
        "time"

        "github.com/jackc/pgx/v4"
        "github.com/shopspring/decimal"
        "golang.org/x/crypto/scrypt"
)

// Database operations for the mining platform

// getUserByID retrieves a user by ID
func getUserByID(ctx context.Context, userID string) (*User, error) {
        query := `
                SELECT id, username, access_key, referral_code, referred_by, registration_ip,
                       usdt_balance, btc_balance, hash_power, base_hash_power, referral_hash_bonus,
                       gbtc_balance, unclaimed_balance, total_referral_earnings, last_active_block,
                       is_admin, is_frozen, is_banned, has_started_mining, kyc_verified,
                       kyc_verification_hash, created_at
                FROM users WHERE id = $1
        `
        
        var user User
        var usdtStr, btcStr, hashStr, baseHashStr, refHashStr, gbtcStr, unclaimedStr, refEarningsStr string
        err := db.QueryRow(ctx, query, userID).Scan(
                &user.ID, &user.Username, &user.AccessKey, &user.ReferralCode, &user.ReferredBy,
                &user.RegistrationIP, &usdtStr, &btcStr, &hashStr,
                &baseHashStr, &refHashStr, &gbtcStr, &unclaimedStr,
                &refEarningsStr, &user.LastActiveBlock, &user.IsAdmin, &user.IsFrozen,
                &user.IsBanned, &user.HasStartedMining, &user.KYCVerified, &user.KYCVerificationHash,
                &user.CreatedAt,
        )
        
        if err == nil {
                user.USDTBalance, _ = decimal.NewFromString(usdtStr)
                user.BTCBalance, _ = decimal.NewFromString(btcStr)
                user.HashPower, _ = decimal.NewFromString(hashStr)
                user.BaseHashPower, _ = decimal.NewFromString(baseHashStr)
                user.ReferralHashBonus, _ = decimal.NewFromString(refHashStr)
                user.GBTCBalance, _ = decimal.NewFromString(gbtcStr)
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

// getUserByUsername retrieves a user by username
func getUserByUsername(ctx context.Context, username string) (*User, error) {
        query := `
                SELECT id, username, access_key, referral_code, referred_by, registration_ip,
                       usdt_balance, btc_balance, hash_power, base_hash_power, referral_hash_bonus,
                       gbtc_balance, unclaimed_balance, total_referral_earnings, last_active_block,
                       is_admin, is_frozen, is_banned, has_started_mining, kyc_verified,
                       kyc_verification_hash, created_at
                FROM users WHERE username = $1
        `
        
        var user User
        var usdtStr, btcStr, hashStr, baseHashStr, refHashStr, gbtcStr, unclaimedStr, refEarningsStr string
        err := db.QueryRow(ctx, query, username).Scan(
                &user.ID, &user.Username, &user.AccessKey, &user.ReferralCode, &user.ReferredBy,
                &user.RegistrationIP, &usdtStr, &btcStr, &hashStr,
                &baseHashStr, &refHashStr, &gbtcStr, &unclaimedStr,
                &refEarningsStr, &user.LastActiveBlock, &user.IsAdmin, &user.IsFrozen,
                &user.IsBanned, &user.HasStartedMining, &user.KYCVerified, &user.KYCVerificationHash,
                &user.CreatedAt,
        )
        
        if err == nil {
                user.USDTBalance, _ = decimal.NewFromString(usdtStr)
                user.BTCBalance, _ = decimal.NewFromString(btcStr)
                user.HashPower, _ = decimal.NewFromString(hashStr)
                user.BaseHashPower, _ = decimal.NewFromString(baseHashStr)
                user.ReferralHashBonus, _ = decimal.NewFromString(refHashStr)
                user.GBTCBalance, _ = decimal.NewFromString(gbtcStr)
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

// createUser creates a new user account
func createUser(ctx context.Context, req RegisterRequest, clientIP string) (*User, error) {
        // Hash the access key using scrypt
        salt := make([]byte, 32)
        if _, err := rand.Read(salt); err != nil {
                return nil, fmt.Errorf("failed to generate salt: %w", err)
        }
        
        hash, err := scrypt.Key([]byte(req.AccessKey), salt, 32768, 8, 1, 32)
        if err != nil {
                return nil, fmt.Errorf("failed to hash access key: %w", err)
        }
        
        hashedKey := base64.StdEncoding.EncodeToString(hash) + ":" + base64.StdEncoding.EncodeToString(salt)
        
        // Generate referral code from username
        referralCode := generateReferralCode(req.Username)
        
        query := `
                INSERT INTO users (username, access_key, referral_code, referred_by, registration_ip,
                                  usdt_balance, btc_balance, hash_power, base_hash_power, referral_hash_bonus,
                                  gbtc_balance, unclaimed_balance, total_referral_earnings)
                VALUES ($1, $2, $3, $4, $5, 0.00, 0.00000000, 0.00, 0.00, 0.00, 0.00000000, 0.00000000, 0.00)
                RETURNING id, username, access_key, referral_code, referred_by, registration_ip,
                          usdt_balance, btc_balance, hash_power, base_hash_power, referral_hash_bonus,
                          gbtc_balance, unclaimed_balance, total_referral_earnings, last_active_block,
                          is_admin, is_frozen, is_banned, has_started_mining, kyc_verified,
                          kyc_verification_hash, created_at
        `
        
        var user User
        var usdtStr, btcStr, hashStr, baseHashStr, refHashStr, gbtcStr, unclaimedStr, refEarningsStr string
        err = db.QueryRow(ctx, query, req.Username, hashedKey, referralCode, req.ReferralCode, clientIP).Scan(
                &user.ID, &user.Username, &user.AccessKey, &user.ReferralCode, &user.ReferredBy,
                &user.RegistrationIP, &usdtStr, &btcStr, &hashStr,
                &baseHashStr, &refHashStr, &gbtcStr, &unclaimedStr,
                &refEarningsStr, &user.LastActiveBlock, &user.IsAdmin, &user.IsFrozen,
                &user.IsBanned, &user.HasStartedMining, &user.KYCVerified, &user.KYCVerificationHash,
                &user.CreatedAt,
        )
        
        if err == nil {
                user.USDTBalance, _ = decimal.NewFromString(usdtStr)
                user.BTCBalance, _ = decimal.NewFromString(btcStr)
                user.HashPower, _ = decimal.NewFromString(hashStr)
                user.BaseHashPower, _ = decimal.NewFromString(baseHashStr)
                user.ReferralHashBonus, _ = decimal.NewFromString(refHashStr)
                user.GBTCBalance, _ = decimal.NewFromString(gbtcStr)
                user.UnclaimedBalance, _ = decimal.NewFromString(unclaimedStr)
                user.TotalReferralEarnings, _ = decimal.NewFromString(refEarningsStr)
        }
        
        if err != nil {
                return nil, fmt.Errorf("failed to create user: %w", err)
        }
        
        return &user, nil
}

// verifyAccessKey verifies the user's access key
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

// upsertDevice creates or updates device fingerprint
func upsertDevice(ctx context.Context, serverDeviceID, clientIP string, fingerprints DeviceCheckRequest) (*DeviceCheckResponse, error) {
        // Check if device exists
        var device DeviceFingerprint
        query := `
                SELECT id, server_device_id, last_ip, registrations, max_registrations, blocked, risk_score
                FROM device_fingerprints WHERE server_device_id = $1
        `
        
        err := db.QueryRow(ctx, query, serverDeviceID).Scan(
                &device.ID, &device.ServerDeviceID, &device.LastIP, &device.Registrations,
                &device.MaxRegistrations, &device.Blocked, &device.RiskScore,
        )
        
        if err != nil && err != pgx.ErrNoRows {
                return nil, fmt.Errorf("failed to query device: %w", err)
        }
        
        if err == pgx.ErrNoRows {
                // Create new device
                device.ServerDeviceID = serverDeviceID
                device.Registrations = 0
                device.MaxRegistrations = 2 // Default max registrations
                device.Blocked = false
                device.RiskScore = calculateRiskScore(fingerprints)
                
                insertQuery := `
                        INSERT INTO device_fingerprints (server_device_id, last_ip, registrations, max_registrations,
                                                       blocked, risk_score, user_agent, screen_resolution, timezone,
                                                       language, canvas_fingerprint, webgl_fingerprint, audio_fingerprint)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                        RETURNING id
                `
                
                err = db.QueryRow(ctx, insertQuery,
                        serverDeviceID, clientIP, device.Registrations, device.MaxRegistrations,
                        device.Blocked, device.RiskScore, fingerprints.UserAgent, fingerprints.ScreenResolution,
                        fingerprints.Timezone, fingerprints.Language, fingerprints.CanvasFingerprint,
                        fingerprints.WebGLFingerprint, fingerprints.AudioFingerprint,
                ).Scan(&device.ID)
                
                if err != nil {
                        return nil, fmt.Errorf("failed to create device: %w", err)
                }
        } else {
                // Update existing device
                updateQuery := `
                        UPDATE device_fingerprints 
                        SET last_ip = $1, risk_score = $2, user_agent = $3, screen_resolution = $4,
                            timezone = $5, language = $6, canvas_fingerprint = $7, webgl_fingerprint = $8,
                            audio_fingerprint = $9, updated_at = NOW()
                        WHERE server_device_id = $10
                `
                
                device.RiskScore = calculateRiskScore(fingerprints)
                _, err = db.Exec(ctx, updateQuery,
                        clientIP, device.RiskScore, fingerprints.UserAgent, fingerprints.ScreenResolution,
                        fingerprints.Timezone, fingerprints.Language, fingerprints.CanvasFingerprint,
                        fingerprints.WebGLFingerprint, fingerprints.AudioFingerprint, serverDeviceID,
                )
                
                if err != nil {
                        return nil, fmt.Errorf("failed to update device: %w", err)
                }
        }
        
        canRegister := !device.Blocked && device.Registrations < device.MaxRegistrations
        
        return &DeviceCheckResponse{
                DeviceID:      device.ID,
                CanRegister:   canRegister,
                Registrations: device.Registrations,
                Blocked:       device.Blocked,
                RiskScore:     device.RiskScore,
        }, nil
}

// linkUserToDevice links a user to a device after successful registration
func linkUserToDevice(ctx context.Context, userID, deviceID string) error {
        // Increment device registration count
        query := `
                UPDATE device_fingerprints 
                SET registrations = registrations + 1, updated_at = NOW()
                WHERE id = $1
        `
        
        _, err := db.Exec(ctx, query, deviceID)
        if err != nil {
                return fmt.Errorf("failed to link user to device: %w", err)
        }
        
        // You could also create a user_devices junction table here if needed
        
        return nil
}

// Helper functions

func generateReferralCode(username string) string {
        // Simple referral code generation - first 6 chars of username in uppercase
        code := username
        if len(code) > 6 {
                code = code[:6]
        }
        return fmt.Sprintf("%s%d", code, time.Now().Unix()%1000)
}

func splitHashedKey(hashedKey string) []string {
        // Split the hashed key by ":" separator
        parts := make([]string, 0, 2)
        start := 0
        for i, r := range hashedKey {
                if r == ':' {
                        parts = append(parts, hashedKey[start:i])
                        start = i + 1
                }
        }
        if start < len(hashedKey) {
                parts = append(parts, hashedKey[start:])
        }
        return parts
}

func compareHashes(a, b []byte) bool {
        if len(a) != len(b) {
                return false
        }
        
        result := byte(0)
        for i := 0; i < len(a); i++ {
                result |= a[i] ^ b[i]
        }
        
        return result == 0
}

func calculateRiskScore(fingerprints DeviceCheckRequest) int {
        // Simple risk scoring based on fingerprint completeness
        score := 0
        
        if fingerprints.UserAgent == "" {
                score += 10
        }
        if fingerprints.ScreenResolution == "" {
                score += 5
        }
        if fingerprints.CanvasFingerprint == "" {
                score += 15
        }
        if fingerprints.WebGLFingerprint == "" {
                score += 10
        }
        
        return score
}