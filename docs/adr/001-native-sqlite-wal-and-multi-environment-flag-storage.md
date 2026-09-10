# ADR 001: Native SQLite WAL and Multi-Environment Flag Storage

## Status
Accepted

## Context
Feature flagging and dynamic configuration engines sit in the critical path of application requests. They require low-latency reads, reliable persistence of multi-environment configurations (`production`, `staging`, `development`), and atomic updates when engineers ramp up rollouts or toggle emergency kill switches.

For TogglePulse, we required:
1. Zero-dependency local developer execution (`npm run dev` running immediately without external Redis, PostgreSQL, or DynamoDB instances).
2. Sub-millisecond flag retrieval and evaluation latency.
3. Durable persistence of evaluation audits to track rollout distributions.

## Decision
1. **Node.js 24 Native `node:sqlite` in WAL Mode**:
   - Utilize Node.js's built-in `DatabaseSync` engine in Write-Ahead Logging mode (`PRAGMA journal_mode = WAL;`).
   - Store feature flags, multi-environment configurations, and evaluation telemetry with indexed constraints.

2. **Multi-Environment Relational Structure**:
   - Store environment configurations (`enabled`, `killSwitchActive`, `rolloutPercentage`, `rules`) within a structured JSON column, enabling flexible schema evolution while maintaining relational keys and timestamps.

## Consequences
- **Positive**: Blazing fast sub-millisecond evaluation lookups with zero external infrastructure dependencies.
- **Positive**: Unit and integration test suites instantiate ephemeral `:memory:` SQLite instances with instant teardown and 100% test isolation.
- **Trade-off**: In large edge deployments, the SQLite database can serve as the primary source of truth, replicating to edge worker nodes via CDN or memory caches.
