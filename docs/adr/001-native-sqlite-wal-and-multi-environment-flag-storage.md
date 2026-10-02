# ADR 001: Native SQLite WAL and Multi-Environment Flag Storage

## Status
Accepted

## Context
Feature flagging and dynamic configuration engines sit in the critical path of application requests. They require low-latency reads, reliable persistence of multi-environment configurations (`production`, `staging`, `development`), and atomic updates when engineers ramp up rollouts or toggle emergency kill switches.

For TogglePulse, we required:
1. Zero-dependency local developer execution (`npm run dev` running immediately without external Redis, PostgreSQL, or DynamoDB instances).
2. Flag reads and evaluations served from a local file, with no network hop to a separate datastore.
3. Durable persistence of evaluation audits to track rollout distributions.

## Decision
1. **Node.js 24 Native `node:sqlite` in WAL Mode**:
   - Utilize Node.js's built-in `DatabaseSync` engine in Write-Ahead Logging mode (`PRAGMA journal_mode = WAL;`).
   - Store feature flags, multi-environment configurations, and evaluation telemetry with indexed constraints.

2. **Multi-Environment Relational Structure**:
   - Store environment configurations (`enabled`, `killSwitchActive`, `rolloutPercentage`, `rules`) within a structured JSON column, enabling flexible schema evolution while maintaining relational keys and timestamps.

## Consequences
- **Positive**: Evaluation reads one row from a local file and there is no separate datastore to run. Latency has not been benchmarked.
- **Positive**: Unit and integration test suites instantiate ephemeral `:memory:` SQLite instances with fast teardown and no shared state between tests.
- **Trade-off**: The database is a single file on one node. Running several server instances would need a shared store, which this project does not provide.
