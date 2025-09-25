package database

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/jackc/pgx/v4/pgxpool"
)

var DB *pgxpool.Pool

func InitDatabase() error {
	// Get database URL from environment
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		// Construct from individual components
		host := os.Getenv("PGHOST")
		if host == "" {
			host = "localhost"
		}
		
		port := os.Getenv("PGPORT")
		if port == "" {
			port = "5432"
		}
		
		user := os.Getenv("PGUSER")
		if user == "" {
			user = "postgres"
		}
		
		password := os.Getenv("PGPASSWORD")
		database := os.Getenv("PGDATABASE")
		if database == "" {
			database = "bit2block"
		}

		if password != "" {
			databaseURL = fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable",
				user, password, host, port, database)
		} else {
			databaseURL = fmt.Sprintf("postgres://%s@%s:%s/%s?sslmode=disable",
				user, host, port, database)
		}
	}

	// Configure connection pool
	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return fmt.Errorf("failed to parse database config: %w", err)
	}

	// Set connection pool settings
	config.MaxConns = 20
	config.MinConns = 5
	config.MaxConnLifetime = time.Hour
	config.MaxConnIdleTime = 30 * time.Minute
	config.HealthCheckPeriod = 1 * time.Minute

	// Create connection pool
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	DB, err = pgxpool.ConnectConfig(ctx, config)
	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}

	// Test the connection
	if err := DB.Ping(ctx); err != nil {
		return fmt.Errorf("failed to ping database: %w", err)
	}

	log.Println("Database connection established successfully")
	return nil
}

func CloseDatabase() {
	if DB != nil {
		DB.Close()
		log.Println("Database connection closed")
	}
}

func GetDB() *pgxpool.Pool {
	return DB
}

// Helper function to check if tables exist
func CheckTablesExist(ctx context.Context) error {
	requiredTables := []string{
		"users",
		"mining_blocks",
		"unclaimed_blocks",
		"mining_history",
		"deposits",
		"withdrawals",
	}

	for _, table := range requiredTables {
		var exists bool
		err := DB.QueryRow(ctx, `
			SELECT EXISTS (
				SELECT FROM information_schema.tables 
				WHERE table_schema = 'public' 
				AND table_name = $1
			)
		`, table).Scan(&exists)

		if err != nil {
			return fmt.Errorf("failed to check table %s: %w", table, err)
		}

		if !exists {
			return fmt.Errorf("required table '%s' does not exist", table)
		}
	}

	log.Println("All required tables exist")
	return nil
}