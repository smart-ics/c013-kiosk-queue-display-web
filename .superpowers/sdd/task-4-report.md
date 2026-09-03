# Task 4 Report: Route Existing Reg IDs In The Registration Composable

## Status: DONE_WITH_CONCERNS

## What was implemented

In `apps/kiosk-web/src/composables/useKioskRegistration.ts`:

1. Extended `KioskRegistrationDeps` with required `getRegistrationPrintData(regId: string): Promise<RegistrationPrintData>`.
2. Added state `registrationReprintData = ref<RegistrationPrintData | null>(null)`; cleared in `goHome()` and at the start of `submitBookingKeyword`.
3. Added `reprintExistingRegistration()` — no-ops when the ref is null; otherwise builds `RegistrationPrintContext` exactly as specified (`{ result: { regId, noAntrian }, pasienName, pasienId, tglLahir, tipeJaminanName, noSep, serviceName, dokterName }`) and calls `deps.printRegistration(ctx)`.
4. In `searchPatientContextFor`, AFTER obtaining the result and only when `isCanonicalRegistrationIdKeyword(keyword)`:
   - exact matches from `result.registrations.items` where `item.registrationId === keyword`;
   - if zero items matches and `bestMatch.kind === 'Registration'` with `bestMatch.registrationId === keyword`, the bestMatch counts as the single exact match;
   - exactly one match → `await deps.getRegistrationPrintData(keyword)`, assign `registrationReprintData.value`, `transition('REGISTRATION_REPRINT')`, return;
   - more than one → `setFailure('UNKNOWN_ERROR', 'Ditemukan lebih dari satu registrasi. Hubungi petugas.')`, return;
   - zero → falls through to the existing patient-context / BOOKING_NOT_FOUND behavior unchanged.
   - `getRegistrationPrintData` rejections are caught by the existing catch → `setFailure`; never enters REGISTRATION_REPRINT with partial data.
   - `bestMatch` Booking/Patient are rejected as direct-reprint candidates (existing behavior preserved).
5. `registerBooking` / `registerWalkin` / `printRegistration` are never called during lookup.
6. Existing `reprintRegistration()` for REGISTRATION_SUCCESS left untouched and separate.

Tests: added the brief's Step 1 tests verbatim, plus the `bestMatch` Registration-as-exact-ID case, bestMatch Booking rejection, bestMatch Patient rejection, a `reprintExistingRegistration` print/no-op test, and a `goHome` clears-reprint-data test. Added fixtures `registrationContextResponse`, `multipleRegistrationContextResponse`, `registrationPrintData`, and a default `getRegistrationPrintData` mock in `makeDeps` (the only `KioskRegistrationDeps` factory in the file; `makeContextDeps` delegates to it).

## Commands run and observed results

- `pnpm --filter kiosk-web exec vitest run src/composables/__tests__/useKioskRegistration.spec.ts` (pre-implementation, Step 2): **6 failed / 40 passed** (46 total) — failures were exactly the new reprint-routing tests (dep/state/transition missing), as expected.
- `pnpm --filter kiosk-web exec vitest run src/composables/__tests__/useKioskRegistration.spec.ts` (post-implementation, Step 5): **46 passed** (1 file), all existing booking/walk-in/patient-context tests included.
- `pnpm --filter kiosk-web exec vue-tsc -p tsconfig.app.json --noEmit`: **clean (no output)**.
- Re-ran the vitest suite after the typecheck fix: **46 passed**.

## Commits created

- `729a5e3` — `feat(kiosk-web): route existing registration ids to reprint` (3 files: `useKioskRegistration.ts`, `useKioskRegistration.spec.ts`, `KioskPage.vue`)

## Concerns / deviations

1. **Modified `apps/kiosk-web/src/views/KioskPage.vue` (1 line)** — outside the brief's listed files. Because `getRegistrationPrintData` is a required dep on `KioskRegistrationDeps`, the real consumer `KioskPage.vue` failed `vue-tsc` without wiring it. The API already exists as `getHisApi().getRegistrationPrintData(regId)` (committed in `5bae1c8`). Added `getRegistrationPrintData: (regId) => getHisApi().getRegistrationPrintData(regId)` — minimal, necessary wiring for the required typecheck gate. Included in the commit; the commit message matches the brief exactly.
2. The working-tree in-flight normalization work in `useKioskRegistration.ts` (task 1–3 context: `REGISTRATION_ID_INPUT_PATTERN`, `normalizeRegistrationIdKeyword`, `isCanonicalRegistrationIdKeyword`, the canonical-ID branch in `submitBookingKeyword`) was preserved untouched and committed together with this feature, as instructed.
3. One test assertion required `vi.mocked(deps.printRegistration).mockClear()` because `makeDeps` is typed as `KioskRegistrationDeps` (plain function types) rather than `Mock`. Runtime behavior unchanged.

## Files changed

- `apps/kiosk-web/src/composables/useKioskRegistration.ts`
- `apps/kiosk-web/src/composables/__tests__/useKioskRegistration.spec.ts`
- `apps/kiosk-web/src/views/KioskPage.vue` (wiring, see concern 1)