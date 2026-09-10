# ADR 003: Emergency Kill Switch and Targeted Rule Precedence

## Status
Accepted

## Context
When rolling out experimental code or complex integrations to production, critical regressions, memory leaks, or downstream service outages can occur. Engineering teams must have the ability to instantly deactivate a feature across all environments without performing a full code rollback or redeploying Docker containers.

Simultaneously, teams need fine-grained control to target specific user segments (such as internal employees, beta testers, or specific countries) before opening the feature up to broader percentage cohorts.

## Decision
1. **Strict Evaluation Precedence Hierarchy**:
   The evaluation engine enforces an unambiguous 4-tier decision cascade:
   - **Tier 1 (Emergency Kill Switch)**: If `killSwitchActive === true`, immediately return `false` (`reason: KILL_SWITCH`). Overrides all rules and rollouts.
   - **Tier 2 (Environment Toggle)**: If `enabled === false`, return `false` (`reason: DISABLED`).
   - **Tier 3 (Targeting Rules)**: Evaluate rules sequentially (`EQUALS`, `IN`, `CONTAINS`, `SEMVER_GTE`). First matching rule dictates the result (`reason: RULE_MATCH`).
   - **Tier 4 (Canary Rollout)**: Calculate deterministic SHA-256 bucket and compare with `rolloutPercentage` (`reason: ROLLOUT_BUCKET`).

2. **Sub-Millisecond Kill Switch Propagation**:
   - Updating the kill switch updates SQLite WAL storage and invalidates local cache, ensuring instant cutoff across client applications.

## Consequences
- **Positive**: Immediate emergency mitigation of production incidents with zero deployment latency.
- **Positive**: Safe gradual rollout pipeline allowing targeted canary testing before wide release.
