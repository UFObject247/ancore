# Implementation Plan

## Tasks

- [ ] 1. Extract mergeUniqueTransactions to utility module
  - [ ] 1.1 Create `src/screens/history/mergeUniqueTransactions.ts` with the named export `mergeUniqueTransactions`, importing `Transaction` from `./types`
  - [ ] 1.2 Remove the inline `mergeUniqueTransactions` definition from `usePaginatedTransactionHistory.ts` and add the import from `./mergeUniqueTransactions`
  - [ ] 1.3 Verify the existing hook test file (`usePaginatedTransactionHistory.test.tsx`) still passes after the refactor

- [ ] 2. Write the Jest test suite
  - [ ] 2.1 Create `src/screens/history/__tests__/mergeUniqueTransactions.test.ts` with a `makeTx` helper and the top-level `describe` block
  - [ ] 2.2 Add `empty inputs` tests: both empty → `[]`; incoming empty → sorted existing; existing empty → sorted incoming (covers Req 5)
  - [ ] 2.3 Add `deduplication` tests: shared id appears once; incoming version wins on collision; duplicate ids within incoming itself (covers Req 2)
  - [ ] 2.4 Add `ordering` tests: mixed timestamps produce descending order; all-same timestamp result has correct length; assert ordering invariant on a 10-item merge (covers Req 3)
  - [ ] 2.5 Add `stable merge` tests: disjoint arrays contain all ids; overlapping arrays contain union of ids; result length equals unique id count (covers Req 4)
  - [ ] 2.6 Add `pagination overlap` tests: 5-item existing + 3-item incoming with 2 shared ids → 6 unique items, descending order; incoming is full subset of existing → result equals sorted existing (covers Req 6)
  - [ ] 2.7 Add `idempotence` test: `mergeUniqueTransactions(R, R)` produces same ids and order as `R` (covers Req 7)

- [ ] 3. Verify test suite passes
  - [ ] 3.1 Run `jest --config ./jest.config.cjs --testPathPattern mergeUniqueTransactions --coverage` and confirm zero failures and 100% coverage of the utility module
