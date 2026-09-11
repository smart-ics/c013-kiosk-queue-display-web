# Re-print Registration via Any Identifier — Design

Date: 2026-09-11 | App: `apps/kiosk-web` | Composable: `useKioskRegistration.ts`

## Problem
Re-print (`REGISTRATION_REPRINT`) only triggers on exact `registrationId` scan.
Patients who scan pasienId / bookingId / name / NIK land on `PATIENT_CONTEXT_CONFIRM`
(patient list) which always continues to walk-in/new registration — today's
registration is never offered for re-print.

## Decision
Reuse the `searchPatientContext` response already in memory. No new endpoint, no
new backend contract. Frontend-only change. One-reg-per-day invariant holds, so
the post-pick check is binary.

## Flow
1. **Search (unchanged):** `searchBooking(keyword)` → on miss → `searchPatientContextFor(keyword)`.
   Keyword may be pasienId, bookingId, uniqueBookingId, name, NIK.
2. **Patient list (unchanged UI):** `PATIENT_CONTEXT_CONFIRM` lists all matched
   patients; the patient self-selects the correct one (identity safety).
3. **Smart check (new, in `confirmPatientContext`):** before transitioning to
   `WALKIN_SELECT_GUARANTEE`, filter cached `patientContextResult.registrations.items`
   for `patientId == picked.patientId` scoped to today's `businessDate`:
   - **Found (exactly 1):** `getRegistrationPrintData(regId)` → `REGISTRATION_REPRINT`.
   - **Not found:** if cache has no registrations at all (deep-search path), re-query
     backend via `searchPatientContext({ keyword: numericPatientIdSuffix, businessDate })`.
     The keyword is the trailing numeric pasienId suffix because backend `PasienFinder` parses pasienId only from numeric input. Backend finds registrations for that patient on today's date. If still 0 → walk-in.
     If exactly 1 → reprint. If >1 → error (should not happen).
   - **Not found with cached registrations:** existing behavior → `WALKIN_SELECT_GUARANTEE`.
4. **Scope guard:** only today's businessDate registrations qualify. Older ones are ignored.

## Non-goals
- Multi-registration picker (not allowed: 1 reg/day).
- New list-by-pasienId endpoint.
- Changes to `BookingSearchStep` input (numeric pad + scanner stay as-is).

## Files to touch (implementation plan input)
- `src/composables/useKioskRegistration.ts`: `confirmPatientContext()` + keep
  `patientContextResult` cached until after the check (currently overwritten on new search — fine).
- `src/views/steps/PatientContextConfirmStep.vue`: no change (already lists patients).
- Tests: `src/__tests__/` — picked patient with/without today's registration.

## Implementation Notes

- Added `PATIENT_CONTEXT_CONFIRM -> REGISTRATION_REPRINT` transition in `flow.ts`.
- Added post-pick check in `confirmPatientContext()` that filters cached registrations for `patientId == picked.patientId` scoped to today's `businessDate`. If exactly 1 match, fetches print data via `getRegistrationPrintData` and transitions to `REGISTRATION_REPRINT`.
- Added fallback re-query for deep-search results with empty cached registrations; re-query keyword uses the trailing numeric pasienId suffix (for example `RS0100000001` → `00000001`) to match backend `PasienFinder` behavior.
- Added `registrationReprintData` prop and `reprint` emit to `PatientContextConfirmStep`; added "Cetak Ulang Karcis" button in the footer (styled matching the "Ambil Antrian Pendaftaran" existing button).
- Wired `:registration-reprint-data` and `@reprint` in `KioskPage.vue` template.
- Verified end-to-end flow with DOM-driven test: booking search → patient context confirm → reprint button click → print functions called.
- Verified type safety (`vue-tsc --noEmit` clean) and all 196 tests passing.
