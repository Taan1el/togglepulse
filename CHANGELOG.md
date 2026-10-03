# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Automated accessibility tests for the flag matrix, the detail drawer and the new flag dialog, using axe with the WCAG 2 A and AA rules. A test also checks that each kill switch is named by its flag and environment.

### Changed
- New visual identity: a dark switchboard. A search bar sits at the top, flags are rows and environments are columns, and every cell has its own kill switch toggle with the rollout percentage and state beside it.
- Flags with an engaged kill switch are pinned in their own group above the rest.
- The selected flag opens in a drawer on the right with the rollout slider, targeting rules, kill switch and evaluation tester. On phones each flag stacks over its three environments.
- Replaced the Sora, Geist and Geist Mono fonts with Manrope, Onest and Chivo Mono, and removed the stats strip.

## [1.0.0] - 2026-10-02

### Added
- Express API for feature flags with production, staging and development environments, stored in Node's native SQLite (`node:sqlite`, WAL mode).
- Deterministic percentage rollouts: a user's bucket (0 to 99) comes from a SHA-256 hash of the user ID and flag key, so the same user always lands in the same bucket and raising the percentage only adds users.
- Targeting rules (`EQUALS`, `NOT_EQUALS`, `IN`, `NOT_IN`, `CONTAINS`, `STARTS_WITH`, `SEMVER_GTE`) that are checked before the rollout, and a per-environment kill switch that overrides everything else.
- An evaluation endpoint that records each evaluation in an audit table, with per-flag counters and an audits endpoint.
- React 19 console with a flags table, rollout controls, kill switch, targeting rules and an evaluation tester.
- In-browser demo mode for GitHub Pages that runs the same shared evaluation and validation code against sample data, with a demo bar and a reset control.
- Validation of targeting rules and environment names when creating a flag, and of the initial environment settings.
- Shared `shared/` folder (evaluation logic, a synchronous SHA-256, validation and sample data) used by both the server and the demo.
- Server tests for routes, validation, rules, precedence and bucketing, and client tests for the main flows and the demo, using no real timers.
- MIT license, environment variable examples, a GitHub Pages workflow and a CI workflow that lints, tests, builds, builds the Pages bundle and builds the Docker image on Node 22 and 24.

### Changed
- Redesigned the console as a light interface with one crimson accent: a stats strip, a flags table with status dots and flat rollout meters, a narrow settings column with a separate kill switch panel, and an evaluation tester with its result beside the form.
- Self-hosted the Sora, Geist and Geist Mono fonts and replaced the previous icons with Lucide icons.
- Rewrote the README and removed claims that the code does not back, including unmeasured latency figures and unsupported rule operators.

### Fixed
- Triggering a kill switch no longer wipes the environment's rollout percentage and rules, and releasing it resumes the stored configuration.
- Boolean and numeric fields on the rollout and kill switch endpoints are validated instead of being coerced into stored state.
- Flag creation rejects malformed `environments` input instead of storing it.
- API errors return a stable `code` and a generic message instead of internal exception details, and malformed JSON bodies and unknown API routes return JSON errors.
- The README documented the bucket hash input in the wrong order; it is `userId:flagKey`.
- `npm start` and the Docker image pointed at a build output path that did not exist; both now run `server/dist/server/src/index.js`, and the image serves the built client.
- The SQLite database and WAL files are now ignored by git wherever the server is started from.
- An unknown environment name on the rollout endpoint created a stray environment entry; it is now rejected.
- A non-numeric `limit` on the audits endpoint no longer reaches the database query.
