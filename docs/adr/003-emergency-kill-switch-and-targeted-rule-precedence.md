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

2. **Independent Kill Switch State**:
   - Toggling the kill switch changes only `killSwitchActive` for the selected environment. The rollout percentage, enabled state, and targeting rules remain intact.
   - Releasing the switch resumes evaluation against the current configuration. A disabled environment stays disabled. Configuration edits made while the switch is active remain in effect after release.
   - State is persisted in SQLite and read by subsequent evaluations. There is no push propagation to clients or guarantee for previously evaluated results.

## Consequences
- **Positive**: Immediate emergency mitigation of production incidents with zero deployment latency.
- **Positive**: Safe gradual rollout pipeline allowing targeted canary testing before wide release.
