# Requirements Document

## Introduction

Add Docker healthchecks, `depends_on` conditions, and migration-gate patterns to the `docker-compose.dev.yml` stack so that services only report healthy after they are genuinely ready to serve traffic, and dependent services start in the correct order. This covers the relayer service (Node/Express, port 3000), the indexer service (Rust/SQLx, ports 3000 and 9090), and the migration job that must complete before the indexer can operate. The relayer already exposes `GET /relay/status`; the indexer already exposes `GET /health`. No new application endpoints are required.

## Glossary

- **Compose_Stack**: The set of services defined in `ancore/docker-compose.dev.yml`.
- **Indexer**: The Rust/SQLx service in `services/indexer/` that indexes blockchain activity and exposes a REST API on port 3000 and Prometheus metrics on port 9090.
- **Relayer**: The Node/Express service in `services/relayer/` that relays transactions and exposes a REST API on port 3000 (mapped to host port 3001).
- **Postgres**: The PostgreSQL 16 database container that already has a healthcheck defined in the Compose_Stack.
- **Migration_Job**: A short-lived container or Compose service that runs SQLx migrations against Postgres before the Indexer starts.
- **Healthcheck**: A Docker `HEALTHCHECK` instruction or Compose `healthcheck` block that Docker uses to determine whether a container is ready.
- **depends_on_condition**: A Compose `depends_on` entry with `condition: service_healthy` that delays a service's start until its dependency reports healthy.
- **curl**: The HTTP client used inside containers to probe HTTP health endpoints; must be available in the runtime image.

## Requirements

### Requirement 1: Relayer Healthcheck

**User Story:** As a developer, I want the relayer container to report healthy only when it is ready to accept requests, so that dependent services and `docker compose up --wait` do not proceed before the relayer is operational.

#### Acceptance Criteria

1. THE Compose_Stack SHALL define a `healthcheck` block on the relayer service that issues `GET http://localhost:3000/relay/status` and expects an HTTP 200 response.
2. WHEN the relayer process has not yet bound to port 3000, THE Compose_Stack SHALL report the relayer container status as `starting` or `unhealthy`, not `healthy`.
3. THE Compose_Stack SHALL configure the relayer healthcheck with `interval: 10s`, `timeout: 5s`, `retries: 5`, and `start_period: 15s`.
4. THE Relayer Dockerfile SHALL install `curl` in the runtime stage so the healthcheck command is available inside the container.

### Requirement 2: Indexer Healthcheck

**User Story:** As a developer, I want the indexer container to report healthy only when its HTTP API is ready, so that the relayer and any tooling that depends on the indexer do not start prematurely.

#### Acceptance Criteria

1. THE Compose_Stack SHALL define a `healthcheck` block on the indexer service that issues `GET http://localhost:3000/health` and expects an HTTP 200 response.
2. WHEN the indexer process has not yet bound to port 3000, THE Compose_Stack SHALL report the indexer container status as `starting` or `unhealthy`, not `healthy`.
3. THE Compose_Stack SHALL configure the indexer healthcheck with `interval: 10s`, `timeout: 5s`, `retries: 10`, and `start_period: 30s` to accommodate Rust binary startup and migration time.
4. THE Indexer Dockerfile SHALL install `curl` in the runtime stage so the healthcheck command is available inside the container.

### Requirement 3: Migration Job

**User Story:** As a developer, I want database migrations to run automatically before the indexer starts, so that the indexer does not fail on startup due to missing schema objects.

#### Acceptance Criteria

1. THE Compose_Stack SHALL define a `migrate` service that runs SQLx migrations against Postgres using the `DATABASE_URL` environment variable.
2. WHEN the `migrate` service exits with code 0, THE Compose_Stack SHALL consider migrations complete and allow the Indexer to start.
3. IF the `migrate` service exits with a non-zero code, THEN THE Compose_Stack SHALL not start the Indexer.
4. THE `migrate` service SHALL declare `depends_on` with `condition: service_healthy` on the Postgres service.
5. THE `migrate` service SHALL set `restart: no` so it does not loop on failure.
6. THE Indexer service SHALL declare `depends_on` with `condition: service_completed_successfully` on the `migrate` service, in addition to its existing `condition: service_healthy` on Postgres.

### Requirement 4: Relayer depends_on Indexer

**User Story:** As a developer, I want the relayer to start only after the indexer is healthy, so that the relayer does not attempt to connect to an indexer that is not yet ready.

#### Acceptance Criteria

1. THE Compose_Stack SHALL add a `depends_on` entry on the relayer service for the indexer service with `condition: service_healthy`.
2. WHEN the indexer healthcheck has not yet passed, THE Compose_Stack SHALL keep the relayer container in the `starting` state rather than running.

### Requirement 5: curl Availability in Runtime Images

**User Story:** As a developer, I want `curl` to be present in the indexer and relayer runtime images, so that Docker can execute the healthcheck commands without failing with "executable not found".

#### Acceptance Criteria

1. THE Indexer Dockerfile SHALL install `curl` in the runtime (`debian:bookworm-slim`) stage via `apt-get`.
2. THE Relayer Dockerfile SHALL install `curl` in the runtime (`node:20-slim`) stage via `apt-get`.
3. WHEN a healthcheck command runs inside either container, THE container SHALL execute `curl` without a "command not found" error.

### Requirement 6: Documentation Update

**User Story:** As a developer, I want `docs/development/local-services.md` to document the migration job and the new startup order, so that contributors understand how to bring up the stack and troubleshoot startup failures.

#### Acceptance Criteria

1. THE `docs/development/local-services.md` file SHALL document the `migrate` service and explain that it runs automatically before the indexer starts.
2. THE `docs/development/local-services.md` file SHALL document the service startup order: Postgres → migrate → Indexer (healthy) → Relayer.
3. THE `docs/development/local-services.md` file SHALL include a troubleshooting entry for the case where the `migrate` service exits with a non-zero code, including the command to inspect its logs.
4. THE `docs/development/local-services.md` file SHALL remove or update the manual migration instructions in the Quick Start section to reflect that migrations now run automatically via the `migrate` service.
