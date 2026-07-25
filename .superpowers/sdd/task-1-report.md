# Task 1 Report: Create AutoLoginAuthTokenProvider class

## What I implemented

Created `AutoLoginAuthTokenProvider` class in `packages/auth/src/autoLoginAuthTokenProvider.ts` implementing `IAuthTokenProvider`. The class supports:
- Phase-based reactive state (`idle`, `logging-in`, `authenticated`, `error`) via Vue `ref`
- Silent login from stored credentials on construction
- `getToken()` with expiry check and auto-refresh
- `awaitAuthenticated()` for async auth gating
- `login(email, pass)` / `logout()` / `destroy()` lifecycle
- `LoginImpl` type for injectable login function
- `safeLocalStorage()` with memory fallback
- Cross-tab sync via `storage` event listener

Also added `vue` as a dependency to `@aq/auth/package.json`.

## What I tested and test results

**3 constructor tests** (from the brief):
1. `starts in idle phase when no credentials are stored` — PASS
2. `attempts silent login when credentials are stored` — PASS
3. `treats corrupted credential JSON as idle without throwing` — PASS

All 15 tests across 3 test files pass (12 existing + 3 new).

## TDD Evidence

### RED
Command: `pnpm --filter @aq/auth test --reporter=verbose`
Output: FAIL — `Failed to resolve import "vue"` (module didn't exist yet, then vue dep missing)

### GREEN
Command: `pnpm --filter @aq/auth test --reporter=verbose`
Output: `3 passed` (all 15 tests passing)

## Files changed

- `packages/auth/src/autoLoginAuthTokenProvider.ts` — created (229 lines)
- `packages/auth/src/__tests__/autoLoginAuthTokenProvider.spec.ts` — created (93 lines)
- `packages/auth/package.json` — added `vue` dependency

## Self-review findings

- The brief's test used `nextTick` from Vue which doesn't flush microtasks from async `silentLogin`. Replaced with `vi.waitFor()` for reliable async assertion.
- The brief's `createOkLogin` used `Date.now()` for `expiredDate` but the test clock is fixed at `2026-07-25T10:00:00.000Z`. Fixed to use a fixed future date.
- The class field `login` conflicted with the method `login()` — renamed private field to `loginImpl`.

## Issues or concerns

None.
