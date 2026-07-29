# Kiosk — Auth Removal & Code Review Cleanup

Date: 2026-07-29
Scope: `apps/kiosk-web`, `apps/display-web`, `packages/api-client`, `packages/device-config`

## Problem

1. Kiosk-web still imports and manages auth tokens (`EnvAuthTokenProvider`, `VITE_BILREG_TOKEN`, `MissingAuthTokenError`) but no longer needs them — all commented-out. The only app that needs auth is config-web.
2. Code review of PR#2 flagged several issues: stale `devices.json` text, duplicated composable, unused `'idle'` status, redundant fallback, silent empty return in `ApiDeviceConfigurationProvider`, and `listPublicKiosks` using `getJson` despite "Public" naming.

## Tasks

### A. Kiosk-web becomes authless

**What**: Remove every auth-related import, function, type, env var, and dependency from `apps/kiosk-web/`.

- `infrastructure.ts`: Delete `EnvAuthTokenProvider`/`IAuthTokenProvider` imports, `authTokenProvider` singleton, `getAuthTokenProvider()` function. Pass inline `{ getToken: () => null }` to `AdmissionQueueClient`. Remove `authTokenProvider = null` from `__resetInfrastructureForTests`.
- `KioskPage.vue`: Delete `MissingAuthTokenError` import and commented-out auth checks (lines 42-43, 63-66).
- `env.d.ts`: Remove `VITE_BILREG_TOKEN` declaration.
- `package.json`: Remove `"@aq/auth"` dependency.

### B. Fix `listPublicKiosks` auth mismatch

**What**: `listPublicKiosks` in `configuration.ts` uses `getJson` (requires token) despite "Public" in name. Change to `getPublicJson` to match `listPublicDisplays`. Without this the station picker breaks after kiosk-web loses auth.

### C. Stale `devices.json` text

**What**: `MissingScreenPicker.vue` still tells users to check `devices.json` which was deleted in PR#2. Change text to reference the backend/API.

### D. Deduplicate composable

**What**: `useDisplayScreenList` (display-web) and `useStationList` (kiosk-web) are 95% identical. Extract a shared `useDeviceList` factory composable into `@aq/device-config`.

- Factory signature: `useDeviceList(fetchImpl: () => Promise<string[]>, fallbackMsg: string)`.
- Status type drops `'idle'` — composable starts at `'loading'` synchronously.
- Both apps import the factory instead of duplicating the pattern.

### E. Remaining trivial fixes

- Drop `??` fallback in `MissingScreenPicker.vue:15` and `MissingStationPicker.vue:15` (error is always non-null when status is `'error'`).
- `ApiDeviceConfigurationProvider.listDisplayScreenIds` and `.listKioskStationIds`: throw `DeviceConfigInvalidError` if the required option is not provided, instead of silently returning `[]`.

## Non-goals

- No changes to config-web auth.
- No changes to `AdmissionQueueClient` constructor signature.
- No renamings beyond what's listed.
