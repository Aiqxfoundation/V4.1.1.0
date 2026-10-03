# Base44 Dev Environment — BIT2BLOCK Mining

## Architecture
Fullstack app with three processes sharing one PostgreSQL database:
- **`web`** (Node 22 + Express + Vite/React): the single public entry point on port 3000.
  `npm run dev` runs `tsx server/index.ts`, which starts Express and mounts Vite in
  middleware mode (live source + HMR — NOT a prebuilt bundle). Serves the React client
  and the REST API. Proxies `/api/ws` (WebSocket) and mining calls to the Go backend.
- **`go-backend`** (Go 1.24): internal mining engine / WebSocket hub on port 8080.
  Source of truth for mining state. Not published to the host; reachable from `web`
  as `http://go-backend:8080`.
- **`db`** (Postgres 16): shared by both backends.

## Run
```
docker compose -f docker-compose.base44.yml up -d
```
Services: `db` → `migrate` (one-shot) → `go-backend` → `web`. Health: `docker compose ps`.

## Key non-obvious facts
- The Go backend URL was hardcoded to `localhost:8080` in `server/routes.ts`. It is now
  configurable via `GO_BACKEND_URL` / `GO_BACKEND_WS_URL` env (defaults keep old behavior)
  so the two compose services can communicate by service name.
- `server/storage.ts` `initStorage()` throws if the DB is unreachable — memory-storage
  fallback was intentionally disabled by the project. A working Postgres is required.
- SQL migrations live in `migrations/`. `0000` is non-idempotent (plain `CREATE TABLE`);
  the compose `migrate` service runs it only when the schema is empty. `0001`–`0005` are
  idempotent. `0003` contains a partial index with `CURRENT_TIMESTAMP` (non-immutable)
  that Postgres rejects — it is applied without abort-on-error; the rest of that file
  (table + valid indexes) still applies. The rejected index is a perf optimization only.
  `0004` adds the `security_pin` column to `users` (was in schema but missing from DB).
  `0005` backfills the default 100 KH/s (0.1 system units) hashrate for existing users
  who had 0 — ensures fair default for all users per app rules.
- No external credentials are required. All config (DATABASE_URL, SESSION_SECRET,
  GO_PORT) is local infra generated in compose.
- Vite `allowedHosts: true` already accepts the preview origin; no host/origin allowlist
  changes needed.

## Verify
- `curl -fsS http://localhost:3000/` → Vite-served HTML (HMR preamble present = live source).
- `curl -fsS http://localhost:3000/src/App.tsx` → 200 (modules resolve, incl. `@shared`).
- From `web` container: `curl http://go-backend:8080/api/global-stats` → mining stats JSON.
