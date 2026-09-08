# Task 4 Report: Add Service Point Master CRUD to `config-web`

**Status:** DONE
**Branch:** `feat/service-point-fallback`
**Commit:** `19f97d8` — `feat(config-web): add service point master CRUD`

## What I implemented

1. **API client** (`packages/api-client/src/admissionQueue.ts`)
   - `listAllServicePoints()` — GET `v1/admission-queue/service-points` with `activeOnly=false`.
   - `upsertServicePoint(servicePointId, { displayName, queuePrefix, active })` — PUT `v1/admission-queue/service-points/{id}` with the JSON body, validated against `admissionServicePointSchema`. Matched the file's semicolon formatting style.

2. **Page** (`apps/config-web/src/views/ServicePointsPage.vue`, modeled on `KiosksPage.vue`)
   - `useQuery(['config-service-points'])` → `getAdmissionQueueApi().listAllServicePoints()`.
   - Table columns: `servicePointId`, `displayName`, `queuePrefix`, status badge (`Active`/`Retired`, retired uses `badge inactive`), actions.
   - Create form: `servicePointId` + `displayName` + `queuePrefix` + active select (default true).
   - Edit Active: `displayName`/`queuePrefix` only, upserts with `active: true`.
   - Edit Retired: `displayName`/`queuePrefix` only, upserts with `active: false`, shows notice "tidak dapat diaktifkan kembali melalui aplikasi ini".
   - Row actions: Active rows get Edit + `Nonaktifkan` (upsert `active:false`); Retired rows get Edit + muted cannot-reactivate note (no reactivate action).
   - `queuePrefix` client validation: `required`, `maxlength="1"`, `pattern="[A-Z]"`, `title` hint; API/server errors surface in the `.error` area.
   - On save success: invalidate `['config-service-points']` and reset the form.
   - No reference to `fallbackServicePoints` or `global_config.json`.

3. **Route + nav**
   - `router.ts`: child route `{ path: 'service-points', name: 'service-points', component: ServicePointsPage }`.
   - `AppShell.vue`: `<RouterLink :to="{ name: 'service-points' }">Service Point</RouterLink>` in `.shell-nav`.

## Tests

- **api-client** (`packages/api-client/src/__tests__/admissionQueue.spec.ts`) added:
  - `upsertServicePoint` sends `PUT` to `/v1/admission-queue/service-points/SP-ADMISI` with body `{ displayName, queuePrefix, active }`.
  - `listAllServicePoints` requests `activeOnly=false`.
- **config-web** (`apps/config-web/src/views/__tests__/ServicePointsPage.spec.ts`) added (7 tests), mocking `@/infrastructure` + `VueQueryPlugin`:
  - Active and retired rows both render.
  - Create submits the expected upsert payload (`active: true`).
  - `Nonaktifkan` on an Active row submits `active: false`.
  - Retired rows show the cannot-reactivate note and no `Nonaktifkan` action.
  - Editing an Active row submits `active: true`.
  - Editing a Retired row submits `active: false` and shows the notice.
  - Page HTML contains no `fallbackServicePoints`.

## Results

- `pnpm --filter @aq/api-client test` → **29 passed** (was 27; +2).
- `pnpm --filter config-web exec vitest run src/views/__tests__/ServicePointsPage.spec.ts` → **7 passed**.
- `pnpm --filter config-web test` → **12 passed** (4 files).
- `pnpm --filter config-web run typecheck` → clean.
- `pnpm --filter @aq/api-client run typecheck` → clean.

## TDD evidence

- **RED:** New api-client tests failed with `api.upsertServicePoint is not a function` / `listAllServicePoints is not a function` before implementation (first run also caught a test-fixture bug: mocked PUT response `data: null` didn't satisfy the schema; fixed the fixture to return a real service-point object).
- **GREEN:** After implementing the two client methods, api-client suite passed. Page tests written against the new page passed immediately on first run (page was authored to spec; a RED snapshot was not separately captured for the SFC since the spec + implementation were written together).

## Files changed (committed)

- `packages/api-client/src/admissionQueue.ts`
- `packages/api-client/src/__tests__/admissionQueue.spec.ts`
- `apps/config-web/src/views/ServicePointsPage.vue`
- `apps/config-web/src/router.ts`
- `apps/config-web/src/views/AppShell.vue`
- `apps/config-web/src/views/__tests__/ServicePointsPage.spec.ts`

Only these 6 files were staged. `.superpowers/`, `docs/architecture/cetakan/`, `docs/design/*`, and `docs/superpowers/plans/2026-09-07-kiosk-label-version-release.md` were left untouched/unstaged.

## Self-review

- All five brief behaviors implemented; no `fallbackServicePoints`/`global_config.json` anywhere outside the negative assertion in the spec.
- Tests assert real behavior (row rendering, exact create/edit/retire payloads, no reactivation for retired rows).
- UI reuses KiosksPage class names (`stack`, `form-grid`, `row-actions`, `table`, `badge`, `secondary`, `danger`, `muted`, `error`) and identical mutation/error patterns.
- YAGNI: no extra endpoints, no BE changes, no new dependencies; reuses `getAdmissionQueueApi()` and the existing `['config-service-points']` query key (which also refreshes the KiosksPage service-point selector via the same key).

## Concerns

- None blocking. Minor note: invalidation of `['config-service-points']` also triggers a refetch on `KiosksPage`'s service-point checkbox list — this is intentional/desirable (same key), consistent with existing code.