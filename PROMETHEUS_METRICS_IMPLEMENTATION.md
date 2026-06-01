# Prometheus Metrics Implementation

## Summary

This PR adds a Prometheus `/metrics` endpoint to the indexer service that exposes ingest lag gauges for monitoring and alerting.

## Changes Made

### 1. Added Prometheus Dependencies (`services/indexer/Cargo.toml`)
- Added `metrics = "0.22"` for metric recording
- Added `metrics-exporter-prometheus = "0.13"` with HTTP listener feature for Prometheus text format export

### 2. Enhanced Metrics Module (`services/indexer/src/metrics.rs`)
- Added `init_prometheus_metrics()` function to register metric descriptions at startup
- Added `record_lag()` function to update Prometheus gauges with lag values
- Metrics exposed:
  - `indexer_lag_blocks`: Number of ledgers behind chain head
  - `indexer_lag_seconds`: Estimated seconds behind chain head

### 3. Updated Main Entry Point (`services/indexer/src/main.rs`)
- Initialized Prometheus exporter with HTTP listener on configurable port (default: 9090)
- Called `metrics::init_prometheus_metrics()` at startup
- Added `/metrics/prometheus` route for documentation (actual metrics served on separate port)

### 4. Updated Health Handler (`services/indexer/src/api/health.rs`)
- Integrated `record_lag()` call to update Prometheus metrics on each health check
- Metrics are automatically updated whenever `/health` endpoint is called

### 5. Updated Metrics API Handler (`services/indexer/src/api/metrics.rs`)
- Added documentation clarifying JSON vs Prometheus format endpoints
- Added `prometheus_metrics_handler()` for informational purposes

### 6. Updated Prometheus Configuration (`services/prometheus.yml`)
- Changed indexer scrape target from `indexer:8081` to `indexer:9090`
- Renamed job from `indexer` to `ancore-indexer` for clarity
- Configured to scrape `/metrics` endpoint every 15 seconds

### 7. Updated Documentation (`services/indexer/README.md`)
- Added Prometheus Metrics section with usage examples
- Documented available metrics and their meanings
- Added Prometheus configuration example
- Updated API examples with correct ports (3000 for API, 9090 for metrics)
- Added `PROMETHEUS_PORT` environment variable documentation

## Architecture

The implementation follows best practices:

1. **Separate Ports**: API runs on port 3000, Prometheus metrics on port 9090
2. **Automatic Updates**: Metrics are updated on every health check call
3. **Standard Format**: Uses Prometheus text format for scraping
4. **Configurable**: Port is configurable via `PROMETHEUS_PORT` environment variable
5. **Non-blocking**: Metrics recording is synchronous and fast

## Testing

### Manual Testing

```bash
# Check Prometheus metrics endpoint
curl -s localhost:9090/metrics

# Expected output:
# HELP indexer_lag_blocks Number of ledgers behind chain head
# TYPE indexer_lag_blocks gauge
indexer_lag_blocks 0

# HELP indexer_lag_seconds Estimated seconds behind chain head
# TYPE indexer_lag_seconds gauge
indexer_lag_seconds 0
```

### Prometheus Configuration Validation

```bash
promtool check config services/prometheus.yml
```

## Acceptance Criteria

- ✅ GET /metrics returns Prometheus text format
- ✅ Lag gauges updated on health/ingest tick (via health handler)
- ✅ Prometheus configuration updated with indexer scrape target
- ✅ Documented in services/indexer/README.md

## Environment Variables

- `PROMETHEUS_PORT`: Port for Prometheus metrics endpoint (default: 9090)

## Deployment Notes

1. Ensure port 9090 is exposed in Docker/Kubernetes configuration
2. Update Prometheus scraper to target `indexer:9090`
3. Set `PROMETHEUS_PORT` environment variable if using a different port
4. Metrics are automatically populated when the `/health` endpoint is called

## Related Issues

- Independent of cursor serializer tests (#477)
- Part of Stellar Wave initiative
- Enhances developer experience and infrastructure monitoring
