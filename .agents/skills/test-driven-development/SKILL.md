---
name: test-driven-development
description: Test-first loop and test-quality rules for this repo. Use when fixing a bug, or when adding or changing domain logic, Server Actions or component behaviour.
---

# Test-Driven Development

Commands, coverage floors and the merge gate: [`docs/CONTRIBUTING.md#validation-gate`](../../../docs/CONTRIBUTING.md#validation-gate). This skill only covers *how* to write the tests.

## Loop

1. **Red:** write one test for the next behaviour; run it and watch it fail for the expected reason. A test that passes on the first run proves nothing.
2. **Green:** write the minimum code to pass.
3. **Refactor:** clean up with the test green.

Focused run during the loop: `npx vitest run <path-or-pattern>`. Full gate once, before the PR.

**Bug fixes (prove it):** reproduce the bug with a failing test *before* touching the fix; keep the test as the regression guard.

## Where tests go

- Group tests into a `tests/` subdirectory at module level (e.g. `src/domain/tests/`, `src/features/<feature>/tests/`, `src/config/tests/`, `src/app/tests/`).
- Suffix all test files with `*.test.ts(x)`.
- **Grouping vs. Specializing in `tests/`**:
  - Keep related, lightweight, stateless checks sharing fixtures grouped (e.g. `tests/schemas.test.ts`) to avoid runner overhead and boilerplate fragmentation (< 200–250 lines).
  - Break into specialized test files when a capability has distinct lifecycle/setup requirements, complex state transitions, or exceeds ~250 lines (e.g. `tests/order-lifecycle.test.ts`, `tests/pricing.test.ts`).
- `src/domain/`: pure unit tests, the bulk of the suite; no mocks needed.
- Server Actions: test the zod parsing and auth rejection paths, not only the happy path.
- Components: render and assert what the user sees. Query by role/label first; `getByTestId` when there is no accessible handle.
- Visual flows: Playwright screenshots per [SCREENS.md#loop-per-flow](../../../docs/design/SCREENS.md#loop-per-flow).

## Test quality

- Assert outcomes (returned values, rendered output, state), not internal calls.
- Prefer real code > fakes > stubs > mocks. Mock only at boundaries (the Supabase client, network, clock).
- One behaviour per test; names read as specs (`rejects an order without items`).
- Arrange-Act-Assert; self-contained tests over shared helpers that hide the setup.
- Deterministic: fixed dates/ids, no order dependence, no real network.

## Red flags

- Fix without a reproduction test.
- Test written after the code and never seen failing.
- Snapshot tests nobody reviews.
- Re-running an unchanged suite "to be sure".
