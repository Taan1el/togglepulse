# ADR 002: Deterministic SHA-256 Hash Bucketing for Canary Rollouts

## Status
Accepted

## Context
Gradual canary releases (e.g. ramping up a new payment flow from 5% to 25% to 100% of users) must guarantee consistency. If a user receives the new feature on one page view and reverts to the old feature on the next, user experience degrades and metrics are invalidated. Furthermore, maintaining a stateful database record for every user-to-flag assignment creates massive database read/write bottlenecks during high traffic spikes.

## Decision
1. **Stateless Deterministic SHA-256 Hash Bucketing**:
   - Compute the user's cohort bucket integer ($0-99$) mathematically:
     $$\text{Bucket} = \text{SHA256}(\text{userId} + \text{":"} + \text{flagKey}).\text{readUInt32BE}(0) \pmod{100}$$
   - If $\text{Bucket} < \text{RolloutPercentage}$, the flag evaluates to `true`; otherwise `false`.

2. **Properties of Deterministic Hashing**:
   - **Consistency**: The same user always lands in the same bucket for a given flag across all sessions and microservices.
   - **Monotonic Progression**: Ramping up from 10% to 25% guarantees that all users who had the feature enabled at 10% will continue to have it enabled at 25%.
   - **Uniform Distribution**: SHA-256 output is close to uniform, so buckets fill roughly evenly. With few users the split can differ noticeably from the target percentage.

## Consequences
- **Positive**: No per-user assignment is stored; the bucket is recomputed from the hash on every evaluation, so evaluation needs no extra database writes for assignments.
- **Positive**: Eliminates sticky session caching requirements across client applications.
