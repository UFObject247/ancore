# Requirements Document

## Introduction

Add Jest coverage reporting, a minimum line coverage threshold, CI artifact upload, and a PR summary comment for the `services/relayer` package. The goal is to make coverage visible in every pull request and enforce a 70% line coverage floor so regressions are caught automatically.

No new test files are required. All changes are configuration and CI workflow additions.

## Glossary

- **Relayer**: The `@ancore/relayer` Node.js service located at `services/relayer/`.
- **Jest**: The test framework used by the Relayer, configured inline in `services/relayer/package.json`.
- **Coverage_Threshold**: A Jest configuration block that fails the test run when coverage falls below specified percentages.
- **Coverage_Artifact**: The coverage output files (JSON summary, LCOV, text) uploaded to GitHub Actions as a named artifact.
- **PR_Comment**: A GitHub Actions step that posts a coverage summary as a comment on the pull request that triggered the CI run.
- **CI**: The GitHub Actions workflow defined in `.github/workflows/ci.yml`.
- **Services_Job**: The `services` job within the CI workflow that runs lint and tests for `@ancore/relayer`.

## Requirements

### Requirement 1: Jest Coverage Reporters

**User Story:** As a developer, I want Jest to emit machine-readable and human-readable coverage formats, so that CI can upload artifacts and display a summary.

#### Acceptance Criteria

1. THE Relayer's Jest configuration SHALL include `coverageReporters` set to `["json-summary", "lcov", "text"]`.
2. WHEN Jest runs with `--coverage`, THE Relayer SHALL write coverage output to the default `coverage/` directory inside `services/relayer/`.
3. THE Relayer's existing `test` script (`jest --coverage`) SHALL remain unchanged.

### Requirement 2: Coverage Threshold Enforcement

**User Story:** As a developer, I want the test run to fail automatically when line coverage drops below 70%, so that coverage regressions are caught in CI before merging.

#### Acceptance Criteria

1. THE Relayer's Jest configuration SHALL include a `coverageThreshold` block with `global.lines` set to `70`.
2. WHEN Jest runs and the measured line coverage is below 70%, THE Jest process SHALL exit with a non-zero exit code.
3. WHEN Jest runs and the measured line coverage is at or above 70%, THE Jest process SHALL exit with exit code 0 (assuming all tests pass).

### Requirement 3: CI Coverage Artifact Upload

**User Story:** As a developer, I want the coverage output to be uploaded as a CI artifact after the relayer tests run, so that I can download and inspect the full report for any build.

#### Acceptance Criteria

1. WHEN the Services_Job test step completes successfully, THE CI SHALL upload the contents of `services/relayer/coverage/` as a named artifact called `relayer-coverage`.
2. THE Coverage_Artifact SHALL be retained for 7 days.
3. IF the test step fails, THE CI SHALL still attempt to upload the coverage artifact so partial reports are available for debugging.

### Requirement 4: PR Coverage Summary Comment

**User Story:** As a developer, I want a coverage summary posted as a PR comment on every pull request, so that I can see coverage numbers without downloading the artifact.

#### Acceptance Criteria

1. WHEN the CI run is triggered by a pull request event, THE CI SHALL post a comment to the pull request containing the line, branch, function, and statement coverage percentages parsed from `services/relayer/coverage/coverage-summary.json`.
2. THE PR_Comment SHALL include the Relayer package name and the measured percentages for lines, branches, functions, and statements.
3. IF `coverage-summary.json` does not exist or cannot be parsed, THE CI SHALL post a comment indicating that coverage data is unavailable rather than failing the workflow.
4. WHEN the same CI run posts a comment, THE CI SHALL use the `peter-evans/create-or-update-comment` action (or equivalent) so that repeated pushes to the same PR update the existing comment rather than creating duplicates.

### Requirement 5: CI Permissions

**User Story:** As a developer, I want the CI workflow to have the minimum permissions needed to post PR comments, so that the security posture of the workflow is not unnecessarily broadened.

#### Acceptance Criteria

1. THE Services_Job SHALL declare `pull-requests: write` permission so the PR comment step can post comments.
2. THE Services_Job SHALL NOT be granted any permissions beyond those already present plus `pull-requests: write`.
