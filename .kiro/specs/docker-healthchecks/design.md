# Design Document: Docker Healthchecks

## Overview

This design adds Docker healthchecks, `depends_on` conditions, and an automatic migration job to the `docker-compose.dev.yml` development stack. The goal is to ensure services only report healthy when genuinely ready, and that dependent services start in the correct order without manual intervention.

The changes are confined to four files:
- `ancore/docker-compose.dev.yml` — healthcheck blocks, `depends_on` conditions, new `migrate` service
- `ancore/services/relayer/Dockerfile` — install `curl` in runtime stage
- `ancore/services/indexer/Dockerfile` — install `curl` in runtime stage
- `ancore/docs/development/local-services.md` — updated startup order and migration documentation

No new application endpoints are required. The relayer already exposes `GET /relay/status` and the indexer already exposes `GET /health`.

## Architecture

### Service Startup Order

```mermaid
graph TD
    A[postgres] -->|service_healthy| B[migrate]
    A -->|service_healthy| C[indexer]
    B -->|service_completed_successfully| C
    C -->|service_healthy| D[relayer]
```

The startup sequence is:

1. **postgres** starts and passes its existing `pg_isready` healthcheck
2. **migrate** starts (depends on postgres healthy), runs `sqlx migrate run`, exits 0 on success
3. **indexer** starts (depends on postgres healthy + migrate completed successfully), waits for its own HTTP healthcheck to pass
4. **relayer** starts (depends on indexer healthy), waits for its own HTTP healthcheck to pass

### Migration Job Strategy

The `migrate` service uses the official `ghcr.io/launchbadge/sqlx-cli` image rather than building from the indexer's builder stage. This avoids re-compiling the Rust toolchain just to run migrations and keeps the compose file self-contained without requiring a multi-stage build artifact to be shared between services.

The `migrate` service mounts the `services/indexer/migrations` directory and runs `sqlx migrate run` against the `DATABASE_URL`. It sets `restart: no` so a migration failure surfaces immediately rather than looping.

## Components and Interfaces

### docker-compose.dev.yml Changes

**migrate service** (new):
```yaml
migrate:
  image: ghcr.io/launchbadge/sqlx-cli:latest
  command: sqlx migrate run
  environment:
    DATABASE_URL: postgres://postgres:ancore@postgres:5432/ancore_indexer
  volumes:
    - ./services/indexer/migrations:/migrations
  depends_on:
    postgres:
      condition: service_healthy
  restart: no
  networks:
    - ancore-network
```

**indexer service** — add healthcheck and update depends_on:
```yaml
healthcheck:
  test: ['CMD', 'curl', '-f', 'http://localhost:3000/health']
  interval: 10s
  timeout: 5s
  retries: 10
  start_period: 30s
depends_on:
  postgres:
    condition: service_healthy
  migrate:
    condition: service_completed_successfully
```

**relayer service** — add healthcheck and depends_on indexer:
```yaml
healthcheck:
  test: ['CMD', 'curl', '-f', 'http://localhost:3000/relay/status']
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 15s
depends_on:
  indexer:
    condition: service_healthy
```

### Dockerfile Changes

**services/indexer/Dockerfile** — runtime stage, add `curl`:
```dockerfile
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    curl \
    && rm -rf /var/lib/apt/lists/*
```

**services/relayer/Dockerfile** — runtime stage, add `curl`:
```dockerfile
# After the existing pnpm install line, add:
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
```

The `node:20-slim` base image is Debian-based, so `apt-get` is available. `curl` is not installed by default in slim images.

### Healthcheck Command Choice

Both healthchecks use `curl -f` (fail on HTTP error status). The `-f` flag causes curl to exit non-zero on HTTP 4xx/5xx responses, which is what Docker needs to mark a container unhealthy. An alternative is `wget --spider`, but since we are installing `curl` anyway for the healthcheck, `curl -f` is the idiomatic choice.

## Data Models

No new data models are introduced. The migration job operates on the existing SQLx migration files:
- `services/indexer/migrations/001_create_account_activity_table.sql`
- `services/indexer/migrations/002_create_ingest_checkpoints_table.sql`

SQLx tracks applied migrations in a `_sqlx_migrations` table it creates automatically. Re-running `sqlx migrate run` on an already-migrated database is idempotent — it skips already-applied migrations.

### sqlx-cli Image and Migration Directory

The `ghcr.io/launchbadge/sqlx-cli` image expects migrations in `/migrations` by default. The compose volume mount maps `./services/indexer/migrations` to `/migrations` inside the container, matching this convention.

