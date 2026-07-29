# Task 2 Report: Remove auth from kiosk-web

## What I implemented

Removed all auth-related code from kiosk-web:

1. **`apps/kiosk-web/src/infrastructure.ts`** — Removed `EnvAuthTokenProvider`/`IAuthTokenProvider` imports, `authTokenProvider` singleton, and `getAuthTokenProvider()` function. Replaced `auth: getAuthTokenProvider()` with `auth: { getToken: () => null }` in both factories. Removed `authTokenProvider = null` from `__resetInfrastructureForTests`.

2. **`apps/kiosk-web/src/views/KioskPage.vue`** — Removed `MissingAuthTokenError` import and all three commented-out auth check blocks.

3. **`apps/kiosk-web/env.d.ts`** — Removed `readonly VITE_BILREG_TOKEN: string`.

4. **`apps/kiosk-web/package.json`** — Removed `"@aq/auth": "workspace:*"` from dependencies.

## Test results

- `pnpm typecheck` — passed with no errors.

## Files changed

- `apps/kiosk-web/src/infrastructure.ts`
- `apps/kiosk-web/src/views/KioskPage.vue`
- `apps/kiosk-web/env.d.ts`
- `apps/kiosk-web/package.json`
- `pnpm-lock.yaml` (auto-updated)

## Self-review findings

- All auth references removed from the four target files.
- No remaining imports from `@aq/auth` in kiosk-web (verified: the import was only in these two files).
- The `@aq/auth` package is still used by config-web — no cross-app impact.
- `auth: { getToken: () => null }` is a valid inline object matching the `IAuthProvider` interface contract, with no type errors.
