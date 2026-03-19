# B2B Mining Platform V2.0

## Overview

A revolutionary next-generation mining platform inspired by Bitcoin's 2nd Block reward mechanics, implementing a unique 21 million B2B token ecosystem with accelerated distribution mechanics. Built with React, Express, and PostgreSQL, the platform features 1-hour block generation, 3,200 B2B initial block rewards, and 3-month halving cycles. Mining operations automatically cease at 65.5% supply distribution (13,755,000 B2B) with the remaining 34.5% reserved and locked for future mining and community benefits (details to be revealed as infrastructure scales). The platform democratizes mining access through zero-hardware requirements while maintaining Bitcoin's fundamental principles of scarcity and decentralization.

## Security & Bug Fixes (March 2026)
- **Security backdoor removed**: TEST2024 bypass code removed from `server/auth.ts` — device fingerprinting always enforced
- **btcConversions persisted to DB**: Was stored in-memory Map; now uses `btcConversions` PostgreSQL table
- **securityPin field added**: New `securityPin text` column on users table for hashed PIN storage
- **PIN change endpoint fixed**: `POST /api/change-pin` now properly hashes/verifies against DB; `POST /api/verify-pin` added
- **Double-credit on restart fixed**: `fixDepositStatuses()` no longer re-credits already-approved deposits
- **Duplicate admin route removed**: Second `GET /api/admin/withdrawals` (pending-only) route removed
- **personalBlockHeight double-count fixed**: Removed extra increment from `storage.claimBlock`/`claimAllBlocks`; Go backend manages via block generation
- **Go single-claim transaction**: `handleClaimRewards` now wrapped in DB transaction (atomic mark+credit)
- **Go CORS fixed**: `REPLIT_DEV_DOMAIN` env var now added to allowed origins list
- **Go session security**: `Secure` cookie flag now enabled when running on Replit (HTTPS)
- **Go miner count fix**: Manual block generation uses DB `COUNT(*)` instead of WebSocket client count
- **UI hardcodes fixed**: Mining dashboard block number, transfer page supply metrics, referral page stats all use real API data

## Recent Changes (December 2024)
- **Face KYC System Removed**: Completely removed face verification requirements and face-api.js dependency
- **Username-Based Referral System**: Changed from referral codes to username-based invitations
- **Device Fingerprinting Retained**: Anti-abuse device tracking remains for security without facial verification
- **Redesigned Admin User Management with Separate Category Pages**: 
  - Main Users page shows three navigation cards for Active, Inactive, and Default categories
  - Each category opens dedicated page with full user list (A-Z alphabetical sorting)
  - Configurable pagination: 100, 200, 300, 400, or 500 users per page
  - Clean table design with search functionality on each category page
  - Settings button for each user to access detailed profile
  - Enhanced user profiles with transaction summaries and referral statistics
- **Individual Balance Editing**: Each asset (USDT, BTC, B2B, Hash Power) has separate edit functionality
- **Professional Ban System**: Banned users receive professional suspension message on login attempt
- **Streamlined Admin Dashboard**: 
  - Four main sections: Overview, Users, Transactions, System
  - No separate Miners menu - all user categories integrated into Users section
  - Professional sidebar navigation with active route highlighting
- **Simplified Deposit System**: 
  - Admin panel reduced to single "Add Address" feature only - no complex management UI
  - Random address assignment from admin-managed pool for all users
  - No user-specific assignments or 24-hour cooldowns
  - Simple "Get Deposit Address" button in wallet for instant random address
  - Offline-capable with local caching of address pool
- **Comprehensive Performance Optimization (September 2025)**:
  - Applied React.memo to frequently re-rendering components (Button, Table, Admin pages)
  - Implemented useMemo for expensive calculations (filtering, sorting, pagination)
  - Added useCallback for event handlers and callback optimizations
  - Cleaned production code by removing debug console.logs
  - Optimized mining factory animations with proper memoization
  - Enhanced admin data table performance for large user lists
  - Fixed all TypeScript compilation errors for production readiness

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **React with TypeScript**: Modern React application using functional components and hooks
- **Wouter**: Lightweight client-side routing for navigation
- **TanStack Query**: Server state management with caching, background updates, and optimistic updates
- **Shadcn/ui**: Component library built on Radix UI primitives with Tailwind CSS styling
- **Form Handling**: React Hook Form with Zod validation for type-safe form management
- **Styling**: Tailwind CSS with custom design tokens and dark theme support

### Backend Architecture
- **Express.js**: RESTful API server with TypeScript support
- **Session-based Authentication**: Passport.js with local strategy and secure password hashing using scrypt
- **Middleware Pattern**: Request logging, error handling, and authentication middleware
- **Mining Simulation**: Cron job-based system for automated block generation and reward distribution
- **Storage Layer**: Abstracted database operations through a storage interface

### Database Design
- **PostgreSQL**: Primary database with Drizzle ORM for type-safe database operations
- **Schema Structure**:
  - Users table with balance tracking (USDT, hash power, GBTC, unclaimed rewards)
  - Deposits/withdrawals with approval workflow and transaction tracking
  - Mining blocks with reward distribution history
  - System settings for configurable parameters
- **Session Storage**: PostgreSQL-backed session store using connect-pg-simple

### Authentication & Authorization
- **Session Management**: Secure session handling with HttpOnly cookies
- **Role-based Access**: Admin and regular user roles with protected routes
- **Password Security**: Async scrypt hashing with salt for secure password storage
- **Protected Routes**: Client-side route protection with loading states and redirects

### Mining System Architecture
- **Automated Block Generation**: Cron jobs generate new blocks every hour (UTC-aligned)
- **Reward Distribution**: Proportional reward distribution based on user hash power
- **System Settings**: Configurable block rewards and mining parameters
- **Real-time Updates**: Automatic balance updates and unclaimed reward tracking
- **Performance Optimizations**: 
  - Throttled animation intervals (250-500ms) for smooth 60fps rendering
  - Memoized expensive calculations and component renders
  - UseRef for volatile visual states to prevent unnecessary re-renders
  - Reduced motion support for accessibility
  - 70-80% reduction in component re-renders

### Build & Development
- **Vite**: Fast development server and optimized production builds
- **TypeScript**: Full type safety across frontend, backend, and shared schemas
- **Path Aliases**: Organized imports with @ and @shared path mapping
- **Hot Reload**: Development environment with HMR and error overlays

## External Dependencies

### Database & Infrastructure
- **Neon Database**: Serverless PostgreSQL database with connection pooling
- **Database Migrations**: Drizzle Kit for schema management and migrations

### UI & Styling
- **Radix UI**: Accessible component primitives for complex UI components
- **Tailwind CSS**: Utility-first CSS framework with custom design system
- **Lucide Icons**: Consistent icon library for UI elements
- **Font Assets**: Google Fonts integration for typography

### Backend Services
- **Session Management**: PostgreSQL session store for scalable session handling
- **Cron Jobs**: Node-cron for scheduled mining operations
- **Password Security**: Built-in Node.js crypto module for secure hashing

### Development Tools
- **ESBuild**: Fast JavaScript bundler for production builds
- **PostCSS**: CSS processing with Tailwind and Autoprefixer
- **TypeScript**: Type checking and compilation across the entire stack
- **Replit Integration**: Development environment optimizations and debugging tools