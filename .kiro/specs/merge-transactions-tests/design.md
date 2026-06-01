# Design Document

## Overview

Extract `mergeUniqueTransactions` from `usePaginatedTransactionHistory.ts` into a standalone utility module and write a Jest test suite that exercises all correctness properties. No new runtime dependencies are introduced; the test suite uses Jest with manually crafted arrays.

## Architecture

### Affected Files

| File | Change |
|------|--------|
| `src/screens/history/mergeUniqueTransactions.ts` | **Create** — extracted utility with named export |
| `src/screens/history/__tests__/mergeUniqueTransactions.test.ts` | **Create** — Jest test suite |
| `src/screens/history/usePaginatedTransactionHistory.ts` | **Modify** — replace inline definition with import |

No other files change. The `Transaction` type already lives in `./types.ts` and is imported by both the utility and the hook.

---

## Component Design

### Utility Module — `mergeUniqueTransactions.ts`

```typescript
import type { Transaction } from './types';

/**
 * Merges two Transaction arrays into a single deduplicated array sorted
 * descending by timestamp. Incoming entries win on id collision.
 */
export const mergeUniqueTransactions = (
  incoming: Transaction[],
  existing: Transaction[]
): Transaction[] => {
  const byId = new Map<string, Transaction>();
  for (const tx of existing) { byId.set(tx.id, tx); }
  for (const tx of incoming) { byId.set(tx.id, tx); }
  return [...byId.values()].sort(
    (a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)
  );
};
```

The implementation is identical to the current inline version. Extraction is purely structural.

### Hook Modification — `usePaginatedTransactionHistory.ts`

Remove the inline `mergeUniqueTransactions` definition and add:

```typescript
import { mergeUniqueTransactions } from './mergeUniqueTransactions';
```

All call sites inside the hook remain unchanged.

---

## Test Design

### Test File Structure

```
describe('mergeUniqueTransactions', () => {
  describe('empty inputs', ...)
  describe('deduplication', ...)
  describe('ordering', ...)
  describe('stable merge — all ids present', ...)
  describe('pagination overlap', ...)
  describe('idempotence', ...)
})
```

### Helper

A minimal `makeTx` factory keeps test data concise:

```typescript
const makeTx = (id: string, timestamp: string, overrides?: Partial<Transaction>): Transaction => ({
  id,
  amount: '0',
  direction: 'in',
  timestamp,
  ...overrides,
});
```

### Correctness Properties

The following properties are verified by the test suite. Each maps to one or more acceptance criteria from the requirements.

#### Property 1 — Ordering invariant (Req 3.3)

For every non-empty result array, every adjacent pair satisfies:

```
Date.parse(result[i].timestamp) >= Date.parse(result[i+1].timestamp)
```

Verified by a helper `assertDescending(result)` called after every merge in the ordering and overlap test groups.

#### Property 2 — Stable merge / union of ids (Req 4.3)

```
new Set(result.map(t => t.id)) equals new Set([...incoming, ...existing].map(t => t.id))
```

Verified across multiple array shapes (disjoint, overlapping, subset).

#### Property 3 — Deduplication count (Req 2.1)

```
result.length === new Set([...incoming, ...existing].map(t => t.id)).size
```

#### Property 4 — Incoming wins on collision (Req 2.2)

When the same id appears in both arrays with different `status` values, the result entry carries the incoming `status`.

#### Property 5 — Idempotence (Req 7.1)

```
mergeUniqueTransactions(R, R) produces same ids and order as R
```

Tested with a representative result array of 5 transactions.

#### Property 6 — Empty identity (Req 5.1–5.3)

- `merge([], [])` → `[]`
- `merge(txs, [])` → sorted `txs`
- `merge([], txs)` → sorted `txs`

#### Property 7 — Pagination overlap length (Req 6.1)

```
result.length === uniqueIdCount(incoming ∪ existing)
```

Tested with a 5-item existing list and a 3-item incoming page where 2 ids overlap.

### Edge Cases Covered

| Scenario | Why it matters |
|----------|---------------|
| Both arrays empty | Prevents crash on first load |
| Single-element arrays | Boundary for sort comparator |
| All same timestamp | Sort stability edge case |
| Incoming is full subset of existing | Full overlap — no new items |
| Existing is full subset of incoming | Full replacement scenario |
| Duplicate ids within incoming itself | Last-write-wins within a single page |
| Large disjoint arrays (20 + 20) | Exercises Map iteration order |

---

## Data Flow

```
usePaginatedTransactionHistory
        │
        │ calls
        ▼
mergeUniqueTransactions(incoming, existing)
        │
        ├─ build Map from existing  (existing entries first)
        ├─ overwrite Map from incoming  (incoming wins)
        └─ sort Map values descending by timestamp
        │
        ▼
    Transaction[]  (deduplicated, sorted)
```

---

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| `Date.parse` returns `NaN` for malformed timestamps | Out of scope for this issue; existing behaviour is unchanged. A follow-up requirement can add input validation. |
| Map iteration order differs across JS engines | ES2015+ guarantees insertion-order iteration for Maps; this is safe in all supported environments. |
| Hook behaviour changes after extraction | The extracted function is byte-for-byte identical to the inline version; existing hook tests in `usePaginatedTransactionHistory.test.tsx` continue to pass. |
