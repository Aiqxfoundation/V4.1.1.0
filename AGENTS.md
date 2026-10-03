# Base44 dev notes — B2B Mining Platform

## Stack
- **Node/Express + Vite (single origin)**: `server/index.ts` (run via `tsx`) serves the
  API and the Vite dev middleware for `client/` on the same port. In dev mode
  (`NODE_ENV=development`) it uses Vite middleware; otherwise it serves `dist/public`.
- **Go mining backend**: `go-backend/main.go` (chi router) on port 8080. The Express
  server proxies `/api/ws` (WebSocket upgrade) and forwards
  `/api/mining/unclaimed-blocks` to it. The Go backend URL is configurable via
  `GO_BACKEND_URL` (defaults to `http://localhost:8080` for Replit parity).
- **PostgreSQL**: required at boot. `server/db.ts` throws if `DATABASE_URL` is unset,
  and `initStorage()` throws if the DB is unreachable (memory-storage fallback is
  intentionally disabled). Sessions use an in-memory store (no session table needed;
  one is created anyway by the migrate step).

## Running here
`docker compose -f docker-compose.base44.yml up -d --build` brings up `db`,
`migrate` (one-shot, applies pending SQL migrations), `web` (port 3000), and `go-backend`.
Completed migrations are recorded in `base44_schema_migrations`; each pending file
and its ledger entry run in one transaction with `ON_ERROR_STOP=1`. Never replay
completed migrations: 0002 rewrites reward state. The original sandbox database
was baselined after verifying the already-applied migrations and repaired 0003 index.
The web preview is the single public entry point on port 3000. The Go backend is
internal-only (reached by the Express proxy as `http://go-backend:8080`).

## Secrets
No external credentials are required to boot. `DATABASE_URL` is local-infra (compose).
`SESSION_SECRET` has a code default; a placeholder is in `.env.base44-defaults`.

## Verifying
- `curl -s http://localhost:3000/` returns the Vite-served index.html.
- `docker compose -f docker-compose.base44.yml logs web` shows `serving on port 3000`
  and `Initialized DatabaseStorage`.
- Auth flows (`/api/...`) work against the local Postgres.

## Gotchas
- `npm run dev` hard-codes `NODE_ENV=development`; the compose also sets it. Don't run
  the production `start` script in dev — it expects a built `dist/`.
- The Go backend downloads modules on first start (slow); a `gomod` volume caches them.
- The Vite config conditionally loads the Replit cartographer plugin only when
  `REPL_ID` is set (it is not here), so it is safely skipped.
