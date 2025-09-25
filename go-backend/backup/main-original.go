package main

import (
        "context"
        "log"
        "net/http"
        "os"

        "github.com/go-chi/chi/v5"
        "github.com/go-chi/cors"
        "github.com/gorilla/sessions"
        "github.com/jackc/pgx/v4/pgxpool"
)

var (
        db    *pgxpool.Pool
        store *sessions.CookieStore
)

func main() {
        // Initialize database connection
        dbURL := os.Getenv("DATABASE_URL")
        if dbURL == "" {
                dbURL = "postgres://user:password@localhost/testdb?sslmode=disable" // dev fallback
                log.Printf("Warning: Using default DATABASE_URL for development")
        }

        var err error
        db, err = pgxpool.Connect(context.Background(), dbURL)
        if err != nil {
                log.Fatalf("Failed to connect to database: %v", err)
        }
        defer db.Close()

        // Initialize session store
        sessionSecret := os.Getenv("SESSION_SECRET")
        if sessionSecret == "" {
                sessionSecret = "your-secret-key-change-in-production"
        }
        store = sessions.NewCookieStore([]byte(sessionSecret))
        store.Options = &sessions.Options{
                Path:     "/",
                MaxAge:   86400 * 7, // 7 days
                HttpOnly: true,
                Secure:   false, // Set to true in production with HTTPS
                SameSite: http.SameSiteDefaultMode,
        }

        r := chi.NewRouter()

        // CORS configuration for frontend compatibility (Replit proxy support)
        r.Use(cors.Handler(cors.Options{
                AllowedOrigins:   []string{"*"}, // Allow all origins for Replit proxy
                AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
                AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
                ExposedHeaders:   []string{"Link"},
                AllowCredentials: true,
                MaxAge:           300,
        }))

        // Health check endpoint
        r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
                w.Header().Set("Content-Type", "application/json")
                w.WriteHeader(http.StatusOK)
                w.Write([]byte(`{"status":"ok","service":"bit2block-mining-go"}`))
        })

        // API routes
        r.Route("/api", func(r chi.Router) {
                // Authentication routes (public)
                r.Post("/register", handleRegister)
                r.Post("/login", handleLogin)
                r.Post("/logout", handleLogout)
                
                // Device management (public)
                r.Post("/device/check", handleDeviceCheck)
                
                // Protected routes
                r.Group(func(r chi.Router) {
                        r.Use(authMiddleware)
                        
                        // User routes
                        r.Get("/user", handleGetUser)
                        r.Post("/device/link", handleDeviceLink)
                        
                        // Mining routes
                        r.Post("/purchase-power", handlePurchasePower)
                        r.Post("/start-mining", handleStartMining)
                        r.Post("/claim-rewards", handleClaimRewards)
                        r.Get("/global-stats", handleGlobalStats)
                        r.Get("/supply-metrics", handleSupplyMetrics)
                        r.Get("/referrals", handleReferrals)
                        
                        // BTC routes
                        r.Get("/btc/prices", handleBTCPrices)
                        r.Get("/btc/balance", handleBTCBalance)
                        
                        // Deposit/Withdrawal routes
                        r.Post("/deposits", handleCreateDeposit)
                        r.Get("/deposits", handleGetDeposits)
                        
                        // Admin routes
                        r.Group(func(r chi.Router) {
                                r.Use(adminMiddleware)
                                r.Get("/users", handleGetUsers)
                                r.Get("/admin/stats", handleAdminStats)
                        })
                })
        })

        port := os.Getenv("PORT")
        if port == "" {
                port = "8080" // Different port from frontend during migration
        }

        log.Printf("Go backend starting on port %s", port)
        log.Fatal(http.ListenAndServe(":"+port, r))
}