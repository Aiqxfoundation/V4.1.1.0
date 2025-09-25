package main

import (
	"time"

	"github.com/shopspring/decimal"
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
	GBTCBalance           decimal.Decimal `json:"gbtcBalance" db:"gbtc_balance"`
	UnclaimedBalance      decimal.Decimal `json:"unclaimedBalance" db:"unclaimed_balance"`
	TotalReferralEarnings decimal.Decimal `json:"totalReferralEarnings" db:"total_referral_earnings"`
	LastActiveBlock       *int            `json:"lastActiveBlock" db:"last_active_block"`
	IsAdmin               bool            `json:"isAdmin" db:"is_admin"`
	IsFrozen              bool            `json:"isFrozen" db:"is_frozen"`
	IsBanned              bool            `json:"isBanned" db:"is_banned"`
	HasStartedMining      bool            `json:"hasStartedMining" db:"has_started_mining"`
	KYCVerified           bool            `json:"kycVerified" db:"kyc_verified"`
	KYCVerificationHash   *string         `json:"kycVerificationHash" db:"kyc_verification_hash"`
	CreatedAt             time.Time       `json:"createdAt" db:"created_at"`
}

// Deposit represents the deposits table
type Deposit struct {
	ID        string          `json:"id" db:"id"`
	UserID    string          `json:"userId" db:"user_id"`
	Network   string          `json:"network" db:"network"`
	TxHash    string          `json:"txHash" db:"tx_hash"`
	Amount    decimal.Decimal `json:"amount" db:"amount"`
	Currency  string          `json:"currency" db:"currency"`
	Status    string          `json:"status" db:"status"`
	AdminNote *string         `json:"adminNote" db:"admin_note"`
	CreatedAt time.Time       `json:"createdAt" db:"created_at"`
	UpdatedAt time.Time       `json:"updatedAt" db:"updated_at"`
}

// Withdrawal represents the withdrawals table
type Withdrawal struct {
	ID        string          `json:"id" db:"id"`
	UserID    string          `json:"userId" db:"user_id"`
	Amount    decimal.Decimal `json:"amount" db:"amount"`
	Address   string          `json:"address" db:"address"`
	Network   string          `json:"network" db:"network"`
	Currency  string          `json:"currency" db:"currency"`
	Status    string          `json:"status" db:"status"`
	TxHash    *string         `json:"txHash" db:"tx_hash"`
	CreatedAt time.Time       `json:"createdAt" db:"created_at"`
}

// DeviceFingerprint represents device security data
type DeviceFingerprint struct {
	ID                 string    `json:"id" db:"id"`
	ServerDeviceID     string    `json:"serverDeviceId" db:"server_device_id"`
	LastIP             *string   `json:"lastIp" db:"last_ip"`
	Registrations      int       `json:"registrations" db:"registrations"`
	MaxRegistrations   int       `json:"maxRegistrations" db:"max_registrations"`
	Blocked            bool      `json:"blocked" db:"blocked"`
	RiskScore          int       `json:"riskScore" db:"risk_score"`
	UserAgent          string    `json:"userAgent" db:"user_agent"`
	ScreenResolution   string    `json:"screenResolution" db:"screen_resolution"`
	Timezone           string    `json:"timezone" db:"timezone"`
	Language           string    `json:"language" db:"language"`
	CanvasFingerprint  string    `json:"canvasFingerprint" db:"canvas_fingerprint"`
	WebGLFingerprint   string    `json:"webglFingerprint" db:"webgl_fingerprint"`
	AudioFingerprint   string    `json:"audioFingerprint" db:"audio_fingerprint"`
	CreatedAt          time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt          time.Time `json:"updatedAt" db:"updated_at"`
}

// SystemSetting represents system configuration
type SystemSetting struct {
	ID        string    `json:"id" db:"id"`
	Key       string    `json:"key" db:"key"`
	Value     string    `json:"value" db:"value"`
	UpdatedAt time.Time `json:"updatedAt" db:"updated_at"`
}

// LoginRequest represents the login request payload
type LoginRequest struct {
	Username  string `json:"username" validate:"required"`
	AccessKey string `json:"accessKey" validate:"required"`
}

// RegisterRequest represents the registration request payload
type RegisterRequest struct {
	Username     string  `json:"username" validate:"required,min=3,max=20"`
	AccessKey    string  `json:"accessKey" validate:"required,min=6"`
	ReferralCode *string `json:"referralCode,omitempty"`
}

// DeviceCheckRequest represents device check payload
type DeviceCheckRequest struct {
	ServerDeviceID       string `json:"serverDeviceId" validate:"required"`
	UserAgent            string `json:"userAgent" validate:"required"`
	ScreenResolution     string `json:"screenResolution" validate:"required"`
	Timezone             string `json:"timezone" validate:"required"`
	Language             string `json:"language" validate:"required"`
	CanvasFingerprint    string `json:"canvasFingerprint" validate:"required"`
	WebGLFingerprint     string `json:"webglFingerprint" validate:"required"`
	AudioFingerprint     string `json:"audioFingerprint" validate:"required"`
}

// DeviceCheckResponse represents device check response
type DeviceCheckResponse struct {
	DeviceID      string `json:"deviceId"`
	CanRegister   bool   `json:"canRegister"`
	Registrations int    `json:"registrations"`
	Blocked       bool   `json:"blocked"`
	RiskScore     int    `json:"riskScore"`
}

// ErrorResponse represents an error response
type ErrorResponse struct {
	Message string `json:"message"`
}

// SuccessResponse represents a success response
type SuccessResponse struct {
	Message string `json:"message"`
}