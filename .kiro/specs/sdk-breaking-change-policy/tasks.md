# Implementation Plan: SDK Breaking Change Policy

## Overview

Purely tooling and documentation changes: a POSIX shell warning script, a pre-push hook update, a root `package.json` script, `CONTRIBUTING.md` additions, and property-based tests for the shell script.

## Tasks

- [ ] 1. Create `scripts/check-breaking-changes.sh`
  - Write a POSIX shell script that reads push range from Git's pre-push stdin (`<local-ref> <local-sha1> <remote-ref> <remote-sha1>`)
  - Run `git log --format="%H %s" <range>` and grep for `BREAKING CHANGE:` in the full commit message body and `^[a-z][^:]*!:` in the subject line
  - When breaking commits are found, print a warning block to stderr listing each offending hash and subject
  - When remote SHA is `0000000000000000000000000000000000000000`, scan all commits reachable from local SHA not present on any remote ref (`git log <sha> --not --remotes`)
  - When run outside a push context (no stdin), fall back to comparing `HEAD` against `@{upstream}`; if no upstream is configured, print a notice and exit 0
  - All error paths (git failure, detached HEAD, missing upstream) must exit 0 — never block a push
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.2_

- [ ] 2. Update `.husky/pre-push` and `package.json`
  - [ ] 2.1 Append the Warning_Script invocation to `.husky/pre-push` after the existing `format:check` block
    - Add the three lines: `echo "🔍 Checking for breaking changes..."`, `bash scripts/check-breaking-changes.sh`, `echo "✅ Breaking change check complete!"`
    - _Requirements: 4.1_
  - [ ] 2.2 Add `check:breaking` script to root `package.json`
    - Add `"check:breaking": "bash scripts/check-breaking-changes.sh"` to the `scripts` object
    - _Requirements: 5.1_

- [ ] 3. Update `CONTRIBUTING.md`
  - [ ] 3.1 Add "Versioning & Breaking Changes" section after the "Development Workflow" section
    - Include a semver policy table defining MAJOR/MINOR/PATCH increments for SDK_Package changes
    - State that packages below `1.0.0` treat MINOR bumps as potentially breaking
    - List at least three concrete Breaking_Change examples (removing an exported function, renaming a type, changing a function signature)
    - Include at least two complete conventional commit examples using the `BREAKING CHANGE:` footer token (function removal and type rename)
    - Include at least one `!` shorthand example (e.g. `feat(core-sdk)!:`)
    - Show correct vs incorrect blank-line placement for the `BREAKING CHANGE:` footer as a counter-example
    - Document the RC process: `vX.Y.Z-rc.N` naming, steps to publish (bump version, commit, tag, push tag), `next` dist-tag requirement, and promotion path to stable
    - Reference `pnpm check:breaking` as the manual check command
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 5.3_
  - [ ] 3.2 Update the "Pull Request Template" section in `CONTRIBUTING.md`
    - Add a "Breaking Change" checklist group with three items: (1) no SDK_Package public API removed/renamed without a MAJOR bump; (2) `BREAKING CHANGE:` footer present in at least one commit if the PR introduces a breaking change; (3) an RC_Tag published and tested if targeting a MAJOR version increment
    - Add an instruction to leave the breaking-change items unchecked with an explanatory comment if the PR does not affect any SDK_Package
    - _Requirements: 1.4, 6.1, 6.2_

- [ ] 4. Checkpoint — verify static artifacts
  - Ensure `scripts/check-breaking-changes.sh` exists and is syntactically valid (`bash -n scripts/check-breaking-changes.sh`)
  - Ensure `.husky/pre-push` contains the `check-breaking-changes.sh` invocation after the format check block
  - Ensure `package.json` `scripts.check:breaking` key exists
  - Ensure `CONTRIBUTING.md` contains the "Versioning & Breaking Changes" heading and the "Breaking Change" checklist group
  - Ask the user if any adjustments are needed before proceeding to tests

- [ ] 5. Write property-based and unit tests in `scripts/__tests__/check-breaking-changes.test.ts`
  - [ ] 5.1 Set up test file with vitest and fast-check imports; add a `createTempRepo` helper that initialises a bare git repo in a temp directory, makes commits, and returns the repo path and commit SHAs
    - _Requirements: 4.2, 4.3, 4.4_
  - [ ]* 5.2 Write property test for Property 1: Breaking change commits produce a warning with hash and subject
    - **Property 1: Breaking change commits produce a warning with hash and subject**
    - **Validates: Requirements 4.2, 4.3**
    - Use `fc.array` of commit message strings with at least one randomly chosen to be a breaking change (either `BREAKING CHANGE:` footer or `!` type marker); create a real git repo, run the script with the push range, assert exit code === 0 and stderr/stdout contains each breaking commit's hash and subject
    - Include edge cases in the generator: null SHA (new branch), mixed breaking/non-breaking commits, `!` in scope (`feat(core-sdk)!:`), `BREAKING CHANGE:` without blank line
    - Minimum 100 iterations
  - [ ]* 5.3 Write property test for Property 2: Clean commits produce no output
    - **Property 2: Clean commits produce no output**
    - **Validates: Requirements 4.4**
    - Use `fc.array` of conventional commit messages with no `BREAKING CHANGE:` and no `!` marker; create a git repo, run the script, assert exit code === 0 and combined output is empty
    - Minimum 100 iterations
  - [ ] 5.4 Write unit tests for static artifact checks
    - Assert `CONTRIBUTING.md` contains the "Versioning & Breaking Changes" section heading
    - Assert `CONTRIBUTING.md` contains at least two `BREAKING CHANGE:` footer examples
    - Assert `CONTRIBUTING.md` contains at least one `!` shorthand example
    - Assert `CONTRIBUTING.md` contains the correct/incorrect blank-line counter-example
    - Assert `CONTRIBUTING.md` contains `vX.Y.Z-rc.N`
    - Assert `CONTRIBUTING.md` contains the `next` dist-tag instruction
    - Assert `CONTRIBUTING.md` contains `pnpm check:breaking`
    - Assert `CONTRIBUTING.md` PR template contains the "Breaking Change" checklist group with three items
    - Assert root `package.json` `scripts["check:breaking"]` references `check-breaking-changes.sh`
    - Assert `.husky/pre-push` invokes `check-breaking-changes.sh` after the format check line
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 4.1, 5.1, 5.3, 6.1_

- [ ] 6. Final checkpoint — ensure all tests pass
  - Run `pnpm --filter scripts test --run` (or equivalent vitest invocation for the scripts test file)
  - Ensure all tests pass; ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The shell script must always exit 0 — it is a warning, not a gate
- Property tests require a real git binary available in the test environment (`child_process.spawnSync`)
- No new runtime dependencies are introduced; `fast-check` and `vitest` are already present in the repo
