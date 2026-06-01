# Design Document: Relayer Coverage Reporting

## Overview

This design adds Jest coverage configuration, a CI artifact upload step, and a PR comment step for the `services/relayer` package. The changes touch exactly two files:

- `ancore/services/relayer/package.json` — add `coverageReporters` and `coverageThreshold` to the inline Jest config
- `ancore/.github/workflows/ci.yml` — add `pull-requests: write` permission, an artifact upload step, and a PR comment step to the `services` job

No new test files, no new scripts, and no new dependencies are required.

## Architecture

### Data Flow

```
jest --coverage
  └─> services/relayer/coverage/
        ├── coverage-summary.json   (json-summary reporter)
        ├── lcov.info               (lcov reporter)
        └── text output to stdout   (text reporter)

CI services job
  ├── Test step          → runs jest, fails if lines < 70%
  ├── Upload artifact    → uploads coverage/ as "relayer-coverage" (always runs)
  └── Post PR comment    → reads coverage-summary.json, posts/updates PR comment
```

### Threshold Enforcement

Jest's `coverageThreshold` causes the process to exit non-zero after all tests pass if any threshold is not met. The threshold is applied globally across all instrumented files. Setting only `lines: 70` is intentional — branches, functions, and statements are reported but not enforced at this stage, keeping the initial bar achievable.

### PR Comment Strategy

The comment step uses `peter-evans/find-comment` to look for an existing comment from the bot on the PR, then `peter-evans/create-or-update-comment` to either update it or create a new one. This prevents comment spam on PRs with multiple pushes.

The comment step only runs on `pull_request` events (guarded by `if: github.event_name == 'pull_request'`). It does not run on direct pushes to `main` or `develop`.

## Components and Interfaces

### services/relayer/package.json — Jest config changes

Add `coverageReporters` and `coverageThreshold` to the existing `"jest"` block:

```json
"jest": {
  "preset": "ts-jest",
  "testEnvironment": "node",
  "testMatch": ["**/src/**/*.test.ts", "**/tests/**/*.test.ts"],
  "transform": {
    "^.+\\.tsx?$": ["ts-jest", { "tsconfig": "tsconfig.test.json" }]
  },
  "coverageReporters": ["json-summary", "lcov", "text"],
  "coverageThreshold": {
    "global": {
      "lines": 70
    }
  }
}
```

`json-summary` produces `coverage/coverage-summary.json` which the CI comment step reads. `lcov` produces `coverage/lcov.info` for the uploaded artifact. `text` prints the table to stdout for inline CI log visibility.

### .github/workflows/ci.yml — services job changes

**1. Add job-level permissions:**

```yaml
services:
  name: Services — Lint & Test
  runs-on: ubuntu-latest
  permissions:
    contents: read
    pull-requests: write
```

**2. Upload coverage artifact (after the test step):**

```yaml
- name: Upload relayer coverage
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: relayer-coverage
    path: services/relayer/coverage/
    retention-days: 7
```

`if: always()` ensures the artifact is uploaded even when the test step fails (e.g. threshold not met), so developers can inspect partial coverage data.

**3. Find existing PR comment:**

```yaml
- name: Find existing coverage comment
  if: github.event_name == 'pull_request'
  uses: peter-evans/find-comment@v3
  id: find-comment
  with:
    issue-number: ${{ github.event.pull_request.number }}
    comment-author: github-actions[bot]
    body-includes: '<!-- relayer-coverage -->'
```

**4. Post or update PR comment:**

```yaml
- name: Post coverage comment
  if: github.event_name == 'pull_request'
  uses: peter-evans/create-or-update-comment@v4
  with:
    comment-id: ${{ steps.find-comment.outputs.comment-id }}
    issue-number: ${{ github.event.pull_request.number }}
    edit-mode: replace
    body: |
      <!-- relayer-coverage -->
      ## @ancore/relayer — Coverage Report

      ${{ steps.coverage-summary.outputs.body }}
```

**5. Parse coverage-summary.json (shell step before the comment step):**

```yaml
- name: Parse coverage summary
  if: github.event_name == 'pull_request'
  id: coverage-summary
  run: |
    SUMMARY="services/relayer/coverage/coverage-summary.json"
    if [ -f "$SUMMARY" ]; then
      LINES=$(jq '.total.lines.pct' "$SUMMARY")
      BRANCHES=$(jq '.total.branches.pct' "$SUMMARY")
      FUNCTIONS=$(jq '.total.functions.pct' "$SUMMARY")
      STATEMENTS=$(jq '.total.statements.pct' "$SUMMARY")
      echo "body=| Metric | Coverage |\n|--------|----------|\n| Lines | ${LINES}% |\n| Branches | ${BRANCHES}% |\n| Functions | ${FUNCTIONS}% |\n| Statements | ${STATEMENTS}% |" >> "$GITHUB_OUTPUT"
    else
      echo "body=Coverage data unavailable — \`coverage-summary.json\` was not produced." >> "$GITHUB_OUTPUT"
    fi
```

`jq` is pre-installed on `ubuntu-latest` GitHub-hosted runners.

## Correctness Properties

### Property 1: Threshold exit code (Requirement 2.2, 2.3)

For any Jest run against the relayer:
- If `coverage.total.lines.pct < 70` → Jest process exit code ≠ 0
- If `coverage.total.lines.pct >= 70` and all tests pass → Jest process exit code = 0

This is enforced by Jest's built-in `coverageThreshold` mechanism. The configuration value `"lines": 70` maps directly to this invariant.

### Property 2: Artifact always uploaded (Requirement 3.3)

For any CI run of the services job, the upload-artifact step runs regardless of whether the test step succeeded or failed. This is guaranteed by `if: always()` on the upload step, which overrides the default `if: success()` behavior.

### Property 3: Comment idempotence (Requirement 4.4)

For any sequence of N pushes to the same PR, the number of `<!-- relayer-coverage -->` comments on that PR is always 1 after the first CI run completes. The find-comment + create-or-update-comment pattern enforces this: if a comment-id is found, the existing comment is replaced; otherwise a new one is created.

### Property 4: Graceful degradation (Requirement 4.3)

If `coverage-summary.json` does not exist (e.g. Jest crashed before writing output), the parse step sets a fallback message and the comment step still posts successfully. The workflow does not fail due to a missing coverage file.

## Data Models

### coverage-summary.json schema (produced by jest json-summary reporter)

```json
{
  "total": {
    "lines":      { "total": 0, "covered": 0, "skipped": 0, "pct": 0.0 },
    "branches":   { "total": 0, "covered": 0, "skipped": 0, "pct": 0.0 },
    "functions":  { "total": 0, "covered": 0, "skipped": 0, "pct": 0.0 },
    "statements": { "total": 0, "covered": 0, "skipped": 0, "pct": 0.0 }
  }
}
```

Only the `total` key is read by the CI comment step. Per-file entries are present in the file but ignored.

## Constraints and Notes

- The `peter-evans/find-comment@v3` and `peter-evans/create-or-update-comment@v4` actions are well-maintained, widely used GitHub Actions. No new npm dependencies are introduced.
- The `pull-requests: write` permission is scoped to the `services` job only, not the entire workflow, minimising blast radius.
- The `services/relayer/coverage/` directory is already gitignored (standard Jest behaviour adds `coverage/` to `.gitignore` by default). No `.gitignore` changes are needed.
- The `retention-days: 7` value balances storage cost against developer utility. Coverage artifacts are diagnostic, not archival.
