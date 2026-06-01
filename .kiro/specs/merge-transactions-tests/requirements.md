# Requirements Document

## Introduction

This feature hardens the `mergeUniqueTransactions` logic in the mobile wallet's paginated transaction history screen. The function is currently defined inline inside `usePaginatedTransactionHistory.ts` and is therefore untestable in isolation. The work involves extracting it to a standalone utility module and writing a comprehensive Jest test suite that covers deduplication, ordering, empty inputs, pagination overlap, and incoming-wins semantics — using manually crafted edge-case arrays to simulate property-based coverage without an external PBT library.

## Glossary

- **Merger**: The `mergeUniqueTransactions` utility function that combines two `Transaction` arrays into a single deduplicated, timestamp-descending array.
- **Transaction**: An object with at minimum `id` (string) and `timestamp` (ISO 8601 string), plus optional fields `amount`, `direction`, `asset`, and `status`.
- **Incoming**: The array of newly fetched transactions passed as the first argument to the Merger.
- **Existing**: The array of previously accumulated transactions passed as the second argument to the Merger.
- **Pagination overlap**: The situation where one or more `Transaction` ids appear in both Incoming and Existing, as happens when consecutive pages share boundary items.
- **Test_Suite**: The Jest test file at `src/screens/history/__tests__/mergeUniqueTransactions.test.ts`.
- **Utility_Module**: The extracted TypeScript file at `src/screens/history/mergeUniqueTransactions.ts`.

## Requirements

### Requirement 1: Extract Merger to a Testable Utility Module

**User Story:** As a developer, I want `mergeUniqueTransactions` to live in its own module, so that I can import and unit-test it directly without instantiating the React hook.

#### Acceptance Criteria

1. THE Utility_Module SHALL export `mergeUniqueTransactions` as a named export.
2. THE `usePaginatedTransactionHistory` hook SHALL import `mergeUniqueTransactions` from the Utility_Module instead of defining it inline.
3. WHEN the Utility_Module is imported, THE Utility_Module SHALL re-export the `Transaction` type from `./types` so callers do not need a second import path.

---

### Requirement 2: Deduplication — Incoming Wins

**User Story:** As a developer, I want duplicate transaction ids to be collapsed to a single entry, so that the UI never shows the same transaction twice.

#### Acceptance Criteria

1. WHEN the same `id` appears in both Incoming and Existing, THE Merger SHALL include that `id` exactly once in the result.
2. WHEN the same `id` appears in both Incoming and Existing with different field values, THE Merger SHALL retain the Incoming version of the Transaction.
3. WHEN Incoming contains duplicate `id` values within itself, THE Merger SHALL include that `id` exactly once in the result, retaining the last occurrence from Incoming.

---

### Requirement 3: Descending Timestamp Ordering

**User Story:** As a developer, I want the merged result to always be sorted newest-first, so that the history screen renders transactions in chronological order without additional sorting.

#### Acceptance Criteria

1. THE Merger SHALL return a result array sorted in descending order by `timestamp` (newest first).
2. WHEN all Transactions share the same `timestamp`, THE Merger SHALL return a result array whose length equals the number of unique ids.
3. FOR ALL non-empty result arrays produced by the Merger, every adjacent pair `(result[i], result[i+1])` SHALL satisfy `Date.parse(result[i].timestamp) >= Date.parse(result[i+1].timestamp)`.

---

### Requirement 4: Stable Merge — All Unique IDs Present

**User Story:** As a developer, I want every unique transaction from both arrays to appear in the result, so that no transactions are silently dropped during a merge.

#### Acceptance Criteria

1. THE Merger SHALL include every `id` that appears in Incoming in the result.
2. THE Merger SHALL include every `id` that appears in Existing in the result, unless that `id` is already covered by Incoming.
3. FOR ALL pairs of Incoming and Existing arrays, the set of `id` values in the result SHALL equal the union of `id` values from Incoming and Existing.

---

### Requirement 5: Empty Input Handling

**User Story:** As a developer, I want the Merger to handle empty arrays gracefully, so that the hook does not crash on first load or after a full refresh.

#### Acceptance Criteria

1. WHEN both Incoming and Existing are empty arrays, THE Merger SHALL return an empty array.
2. WHEN Incoming is empty and Existing is non-empty, THE Merger SHALL return a sorted array containing all Transactions from Existing.
3. WHEN Existing is empty and Incoming is non-empty, THE Merger SHALL return a sorted array containing all Transactions from Incoming.

---

### Requirement 6: Pagination Overlap

**User Story:** As a developer, I want overlapping transactions between pages to be deduplicated, so that scrolling through paginated history never produces duplicate rows.

#### Acceptance Criteria

1. WHEN Incoming contains ids that already exist in Existing (pagination overlap), THE Merger SHALL return a result whose length equals the count of unique ids across both arrays.
2. WHEN a pagination overlap occurs, THE Merger SHALL preserve descending timestamp order in the result.
3. WHEN Incoming is a full page that is a subset of Existing, THE Merger SHALL return a result identical in content to the sorted Existing array.

---

### Requirement 7: Idempotence

**User Story:** As a developer, I want merging a result with itself to be a no-op, so that redundant merge calls do not corrupt the displayed list.

#### Acceptance Criteria

1. FOR ALL result arrays `R` produced by the Merger, calling `mergeUniqueTransactions(R, R)` SHALL return an array with the same ids and the same order as `R`.

---

### Requirement 8: Test Coverage

**User Story:** As a developer, I want the Test_Suite to cover all correctness properties, so that regressions in merge logic are caught automatically in CI.

#### Acceptance Criteria

1. THE Test_Suite SHALL contain at least one test case for each acceptance criterion in Requirements 2 through 7.
2. THE Test_Suite SHALL use only Jest and manually crafted arrays — no external property-based testing library SHALL be introduced.
3. WHEN the Test_Suite is executed with `jest --config ./jest.config.cjs`, THE Test_Suite SHALL pass with zero failures.
4. THE Test_Suite SHALL achieve 100% statement and branch coverage of the Utility_Module.
