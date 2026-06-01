# Implementation Plan: Docker Healthchecks

## Overview

Add healthchecks, `depends_on` conditions, a migration job, and `curl` to the dev stack so services start in the correct order and report healthy only when ready.

## Tasks

- [ ] 1. Install curl in Dockerfile runtime stages
  - [ ] 1.1 Add `curl` to the indexer runtime stage in `services/indexer/Dockerfile`
    - In the `debian:bookworm-slim` runtime stage, add `curl` to the existing `apt-get install` line alongside `ca-certificates` and `libssl3`
    - _Requirements: 5.1, 5.3_

  - [ ] 1.2 Add `curl` to the relayer runtime stage in `services/relayer/Dockerfile`
    - In the `node:20-slim` runtime stage, add an `apt-get update && apt-get install -y curl` step after the pnpm production install
    - _Requirements: 5.2, 5.3_

- [ ] 2. Add healthcheck to the relayer service in `docker-compose.dev.yml`
  - Add a `healthcheck` block to the `relayer` service using `CMD curl -f http://localhost:3000/relay/status`
  - Set `interval: 10s`, `timeout: 5s`, `retries: 5`, `start_period: 15s`
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 3. Add healthcheck to the indexer service in `docker-compose.dev.yml`
  - Add a `healthcheck` block to the `indexer` service using `CMD curl -f http://localhost:3000/health`
  - Set `interval: 10s`, `timeout: 5s`, `retries: 10`, `start_period: 30s`
  - _Requirements: 2.1, 2.2, 2.3_

- [ ] 4. Add the `migrate` service to `docker-compose.dev.yml`
  - Add a new `migrate` service using `ghcr.io/launchbadge/sqlx-cli:latest`
  - Set `command: sqlx migrate run`
  - Set `DATABASE_URL: postgres://postgres:ancore@postgres:5432/ancore_indexer`
  - Mount `./services/indexer/migrations:/migrations`
  - Set `depends_on: postgres: condition: service_healthy`
  - Set `restart: no`
  - Attach to `ancore-network`
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 5. Update `depends_on` for indexer and relayer in `docker-compose.dev.yml`
  - Update the `indexer` service `depends_on` to include `migrate: condition: service_completed_successfully` alongside the existing postgres dependency
  - Add `depends_on: indexer: condition: service_healthy` to the `relayer` service
  - _Requirements: 3.6, 4.1, 4.2_

- [ ] 6. Update `docs/development/local-services.md`
  - Document the `migrate` service and that it runs automatically before the indexer starts
  - Document the startup order: Postgres → migrate → Indexer (healthy) → Relayer
  - Add a troubleshooting entry for `migrate` non-zero exit with the log inspection command (`docker compose -f docker-compose.dev.yml logs migrate`)
  - Remove or update any manual migration instructions in the Quick Start section
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 7. Final checkpoint
  - Ensure all files are consistent: Dockerfiles install curl, compose file has all healthchecks and depends_on conditions, docs are updated
  - Ask the user if any questions arise.
