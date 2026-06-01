# Implementation Plan: Relayer Coverage Reporting

## Overview

Add Jest coverage reporters and a 70% line threshold to `services/relayer/package.json`, then extend the CI `services` job to upload the coverage artifact and post a PR summary comment.

## Tasks

- [ ] 1. Update Jest config in `services/relayer/package.json`
  - [ ] 1.1 Add `coverageReporters` to the `jest` block
    - Add `"coverageReporters": ["json-summary", "lcov", "text"]` inside the existing `"jest"` object
    - _Requirements: 1.1, 1.2_

  - [ ] 1.2 Add `coverageThreshold` to the `jest` block
    - Add `"coverageThreshold": { "global": { "lines": 70 } }` inside the existing `"jest"` object
    - _Requirements: 2.1, 2.2, 2.3_

- [ ] 2. Update `.github/workflows/ci.yml` — services job permissions
  - Add a `permissions` block to the `services` job with `contents: read` and `pull-requests: write`
  - _Requirements: 5.1, 5.2_

- [ ] 3. Add coverage artifact upload step to the services job
  - After the existing "Test services" step, add an `actions/upload-artifact@v4` step named "Upload relayer coverage"
  - Set `if: always()` so it runs even when the test step fails
  - Set `path: services/relayer/coverage/`, `name: relayer-coverage`, `retention-days: 7`
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 4. Add coverage summary parse step to the services job
  - After the upload step, add a shell step named "Parse coverage summary" with `if: github.event_name == 'pull_request'` and `id: coverage-summary`
  - Read `services/relayer/coverage/coverage-summary.json` with `jq` and write lines/branches/functions/statements percentages to `$GITHUB_OUTPUT` as `body`
  - If the file does not exist, write a fallback message to `body` instead
  - _Requirements: 4.1, 4.2, 4.3_

- [ ] 5. Add find-comment step to the services job
  - After the parse step, add a `peter-evans/find-comment@v3` step named "Find existing coverage comment" with `if: github.event_name == 'pull_request'` and `id: find-comment`
  - Set `issue-number: ${{ github.event.pull_request.number }}`, `comment-author: github-actions[bot]`, `body-includes: '<!-- relayer-coverage -->'`
  - _Requirements: 4.4_

- [ ] 6. Add create-or-update-comment step to the services job
  - After the find-comment step, add a `peter-evans/create-or-update-comment@v4` step named "Post coverage comment" with `if: github.event_name == 'pull_request'`
  - Set `comment-id: ${{ steps.find-comment.outputs.comment-id }}`, `issue-number: ${{ github.event.pull_request.number }}`, `edit-mode: replace`
  - Set the comment body to include the `<!-- relayer-coverage -->` marker, the heading `## @ancore/relayer — Coverage Report`, and `${{ steps.coverage-summary.outputs.body }}`
  - _Requirements: 4.1, 4.2, 4.4_

- [ ] 7. Final checkpoint
  - Verify `package.json` has both `coverageReporters` and `coverageThreshold` in the `jest` block with no JSON syntax errors
  - Verify the `services` job in `ci.yml` has the permissions block and all four new steps in the correct order: upload → parse → find-comment → post-comment
  - Confirm no other jobs or workflow-level permissions were modified
