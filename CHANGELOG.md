# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.1.1] - 2026-11-14

### Fixed
- Version rules (`SEMVER_GTE`) follow SemVer 2.0.0 precedence in the editor, the exported evaluator and the server. Before, `2.5.0-beta2` compared as 2.5.2 and `1.0.0-rc10` as 1.0.10, and prereleases ranked above releases. Invalid versions never match.
- Rule values with blank lines, a trailing newline or Windows line endings no longer make Save fail with an index error. Values are trimmed and de-duplicated, and problems are reported by rule number.
- Fractional rollout values such as 0.1 are rejected on import with a message naming the flag and environment, because buckets are whole percents. A workspace saved with a fractional rollout still opens, rounded up to the percent it already served.
- Unsaved rule drafts survive kill switch, rollout and enabled changes, and the editor asks before switching flag or environment discards them.
- The name, description and tags of a local flag can now be edited.
- New local flags start disabled at 0 percent in every environment instead of 100 percent in staging and development.
- Importing flags.json asks before replacing the saved workspace and says how many flags and rules are replaced.
- The exported test vectors include rollout boundary buckets, non-matching cases for every operator and SemVer prerelease cases, and the exported files say the evaluator needs `crypto.subtle`.
- A new version of the offline app reaches open tabs: the page is fetched network first, the cache is filled with fresh copies, and a "Reload" notice appears when an update is ready.
- Downloads keep the file URL alive for ten seconds instead of releasing it immediately.
- The browser storage message names TogglePulse.

## [Unreleased]

### Added
- A test that checks every sideways scrolling table wrapper can be focused with the keyboard and has a name, so keyboard users can always scroll tables.
- Automated accessibility tests for the flag matrix, the detail drawer and the new flag dialog, using axe with the WCAG 2 A and AA rules. A test also checks that each kill switch is named by its flag and environment.

### Changed
- New visual identity: a dark switchboard. A search bar sits at the top, flags are rows and environments are columns, and every cell has its own kill switch toggle with the rollout percentage and state beside it.
- Flags with an engaged kill switch are pinned in their own group above the rest.
- The selected flag opens in a drawer on the right with the rollout slider, targeting rules, kill switch and evaluation tester. On phones each flag stacks over its three environments.
- Replaced the Sora, Geist and Geist Mono fonts with Manrope, Onest and Chivo Mono, and removed the stats strip.

## [1.0.0] - 2026-10-02

### Added
- A test that checks every sideways scrolling table wrapper can be focused with the keyboard and has a name, so keyboard users can always scroll tables.
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
