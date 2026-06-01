# Requirements Document

## Introduction

This feature formalizes the versioning and breaking-change policy for all `@ancore/*` packages published from the pnpm workspace. It adds a "Versioning & Breaking Changes" section to `CONTRIBUTING.md`, documents BREAKING CHANGE conventional commit examples, defines an RC (release candidate) process, and introduces a pre-push hook warning when breaking changes are detected — integrating with the existing Husky setup and `pnpm publish -r` release workflow.

## Glossary

- **Breaking_Change**: Any modification to a public API of an `@ancore/*` package that removes, renames, or changes the contract of an exported symbol, type, or behaviour in a way that requires consumers to update their code.
- **CONTRIBUTING_Doc**: The file `CONTRIBUTING.md` at the repository root.
- **Hook**: The Husky shell script at `.husky/pre-push` that runs before every `git push`.
- **RC_Tag**: A Git tag whose name matches the pattern `vX.Y.Z-rc.N` (e.g. `v2.0.0-rc.1`).
- **Release_Workflow**: The GitHub Actions workflow defined in `.github/workflows/release.yml`.
- **Semver**: Semantic Versioning 2.0.0 — MAJOR.MINOR.PATCH version scheme.
- **SDK_Package**: Any package under `packages/*` whose `name` field starts with `@ancore/` (core-sdk, crypto, stellar, types, ui-kit, account-abstraction, test-fixtures).
- **Warning_Script**: A shell script at `scripts/check-breaking-changes.sh` that inspects commit messages in the current push range for `BREAKING CHANGE` footers or `!` type markers and prints a warning when found.

---

## Requirements

### Requirement 1: Semver Policy Documentation

**User Story:** As a contributor, I want a clear semver policy for `@ancore/*` packages documented in `CONTRIBUTING.md`, so that I know which version component to bump for each type of change.

#### Acceptance Criteria

1. THE CONTRIBUTING_Doc SHALL contain a "Versioning & Breaking Changes" section that defines MAJOR, MINOR, and PATCH version increments for SDK_Package changes.
2. THE CONTRIBUTING_Doc SHALL list at least three concrete examples of changes that constitute a Breaking_Change for an SDK_Package (e.g. removing an exported function, renaming a type, changing a function signature in an incompatible way).
3. THE CONTRIBUTING_Doc SHALL state that SDK_Package versions follow Semver and that packages with a version below `1.0.0` treat MINOR bumps as potentially breaking.
4. WHEN a contributor opens a pull request that modifies files under `packages/*`, THE CONTRIBUTING_Doc SHALL instruct the contributor to declare whether the change is a Breaking_Change in the PR description checklist.

---

### Requirement 2: BREAKING CHANGE Conventional Commit Examples

**User Story:** As a contributor, I want documented examples of BREAKING CHANGE conventional commits in `CONTRIBUTING.md`, so that I can write correctly formatted commit messages when introducing breaking changes.

#### Acceptance Criteria

1. THE CONTRIBUTING_Doc SHALL include at least two complete conventional commit examples that use the `BREAKING CHANGE:` footer token, covering both a function removal and a type rename.
2. THE CONTRIBUTING_Doc SHALL include at least one example using the `!` shorthand marker (e.g. `feat!:` or `refactor!:`).
3. THE CONTRIBUTING_Doc SHALL specify that the `BREAKING CHANGE:` footer MUST appear after a blank line following the commit body, in accordance with the Conventional Commits 1.0.0 specification.
4. IF a commit message contains `BREAKING CHANGE:` without the required blank-line separator, THEN THE CONTRIBUTING_Doc SHALL show the incorrect form alongside the correct form as a counter-example.

---

### Requirement 3: Release Candidate (RC) Process Documentation

**User Story:** As a maintainer, I want a documented RC process for major SDK releases in `CONTRIBUTING.md`, so that consumers can test pre-release versions before a stable publish.

#### Acceptance Criteria

1. THE CONTRIBUTING_Doc SHALL define the RC_Tag naming convention (`vX.Y.Z-rc.N`) and explain that pushing an RC_Tag triggers the Release_Workflow with `prerelease: true`.
2. THE CONTRIBUTING_Doc SHALL specify the steps to publish an RC: bump the package version to `X.Y.Z-rc.N`, commit with `chore(release): vX.Y.Z-rc.N`, tag, and push the tag.
3. THE CONTRIBUTING_Doc SHALL state that RC versions MUST be published to npm with the `next` dist-tag so that `npm install @ancore/<pkg>` does not install them by default.
4. THE CONTRIBUTING_Doc SHALL describe the promotion path from RC to stable: verify the RC with consumers, remove the `-rc.N` suffix from the version, tag `vX.Y.Z`, and push the tag.
5. WHEN an RC_Tag is pushed, THE Release_Workflow SHALL mark the resulting GitHub release as a pre-release (the existing `prerelease` condition in `release.yml` already handles tags containing `rc`; this requirement documents that behaviour explicitly).

---

### Requirement 4: Pre-Push Breaking Change Warning Hook

**User Story:** As a contributor, I want the pre-push hook to warn me when my commits contain breaking changes, so that I am reminded to follow the RC process and update the PR checklist before pushing.

#### Acceptance Criteria

1. THE Hook SHALL invoke the Warning_Script as part of the pre-push sequence, after the existing lint and format checks.
2. WHEN the Warning_Script detects one or more commits in the push range whose messages contain `BREAKING CHANGE:` or a `!` type marker, THE Hook SHALL print a warning message that lists the offending commit hashes and subjects.
3. WHEN the Warning_Script detects a Breaking_Change, THE Hook SHALL exit with code 0 so that contributors are informed but not prevented from pushing.
4. WHEN no Breaking_Change indicators are found in the push range, THE Warning_Script SHALL produce no output and exit with code 0.
5. THE Warning_Script SHALL read the push range from the arguments passed by Git to the pre-push hook (`<local-ref> <local-sha1> <remote-ref> <remote-sha1>`) and SHALL NOT scan commits outside that range.
6. IF the remote SHA1 passed to the Hook is the null SHA (`0000000000000000000000000000000000000000`), THEN THE Warning_Script SHALL scan all commits reachable from the local SHA1 that are not yet present on the remote branch.

---

### Requirement 5: Root Script Registration

**User Story:** As a contributor, I want a named pnpm script to run the breaking-change check manually, so that I can verify my commits without triggering a full push.

#### Acceptance Criteria

1. THE `package.json` at the repository root SHALL define a script named `check:breaking` that executes the Warning_Script.
2. WHEN `pnpm check:breaking` is run outside of a Git push context, THE Warning_Script SHALL compare `HEAD` against the upstream tracking branch and report any Breaking_Change commits found.
3. THE CONTRIBUTING_Doc SHALL document the `pnpm check:breaking` command in the "Versioning & Breaking Changes" section so contributors know how to run it manually.

---

### Requirement 6: PR Checklist Update

**User Story:** As a reviewer, I want the pull request template in `CONTRIBUTING.md` to include breaking-change checklist items, so that contributors explicitly confirm versioning decisions before merge.

#### Acceptance Criteria

1. THE CONTRIBUTING_Doc PR template section SHALL include a "Breaking Change" checklist group containing: confirmation that no SDK_Package public API is removed or renamed without a MAJOR version bump; confirmation that a `BREAKING CHANGE:` footer is present in at least one commit if the PR introduces a Breaking_Change; and confirmation that an RC_Tag has been published and tested if the change targets a MAJOR version increment.
2. THE CONTRIBUTING_Doc SHALL instruct contributors to leave the breaking-change checklist items unchecked and add an explanatory comment if the PR does not affect any SDK_Package.
