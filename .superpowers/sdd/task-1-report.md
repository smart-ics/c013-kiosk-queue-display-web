# Task 1 Report: Fix `listPublicKiosks` → `getPublicJson`

## What I implemented

Changed `listPublicKiosks()` in `packages/api-client/src/configuration.ts:338` from calling `client.getJson` (auth-required) to `client.getPublicJson` (no auth), matching its sibling `listPublicDisplays()`. The function name has "Public" in it so it was clearly a bug.

## What I tested

- Ran `pnpm typecheck` from `packages/api-client/` — passed with no errors.

## Files changed

- `packages/api-client/src/configuration.ts` — one-line change: `getJson` → `getPublicJson`

## Self-review findings

- The fix is correct and minimal. Both `getJson` and `getPublicJson` have the same signature (url + schema + optional params), so no type issues.
- The sibling `listPublicDisplays()` on line 330 already uses `getPublicJson` — consistency verified.
- No callers of `listPublicKiosks` needed updating; the return type is identical.
