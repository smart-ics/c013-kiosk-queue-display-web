# ADR-008: PATIENT_NOT_REGISTERED Failure Code for Empty Patient Context

- **Status:** Proposed
- **Date:** 2026-09-16
- **Branch:** fix/patient-search-flows

## Context

The kiosk unified search flow cascades through `searchBooking` → `deepSearchPasien` → `searchPatientContext`. When all three return empty results, the patient is not found in any hospital system (no booking, no registration, no patient record).

Previously, this scenario emitted failure code `BOOKING_NOT_FOUND` with message "Data pasien tidak ditemukan. Silakan coba lagi atau ambil antrian pendaftaran." This conflated "booking not found" (a booking search miss) with "patient not registered at all" (no patient record exists).

The failure screen shows a manual service point selector for assistance queue intake. The KioskPage automatic fallback watcher currently auto-intakes for `BOOKING_NOT_FOUND` when a fallback is configured.

## Decision

Introduce a new failure code `PATIENT_NOT_REGISTERED` with message:

> "Pasien yang dicari belum terdata di rumah sakit. Silakan ambil antrian pendaftaran atau hubungi petugas."

**Routing:**
- `confirmAssistance` treats `PATIENT_NOT_REGISTERED` like `BOOKING_NOT_FOUND`: routes to `intake(servicePointId)` (no bookingId available).
- KioskPage automatic fallback watcher skips `PATIENT_NOT_REGISTERED`: FAILURE screen shows manual service point selector (no auto-intake).

**Legacy:** `BOOKING_NOT_FOUND` remains in the `FAILURE_CODES` enum for defensive/compatibility reasons but is no longer emitted by the `searchPatientContextFor` path.

## Consequences

### Positive
- Clearer diagnostic: distinguishes "booking not found" from "patient not registered at all"
- Appropriate UX: manual selector for patients not registered (no auto-assistance)
- Analytics can track patient-not-registered vs booking-not-found separately

### Negative
- Existing tests expecting `BOOKING_NOT_FOUND` for empty context must update to `PATIENT_NOT_REGISTERED`
- KioskPage auto-intake behavior changes for empty context (manual selector instead)

### Neutral
- `BOOKING_NOT_FOUND` remains in enum but unused (defensive)

## Compliance

- Does not modify `b09-bilreg-api`
- Uses existing `setFailure` mechanism
- Maintains FAILURE screen with manual selector (per user requirement)
- `confirmAssistance` routing updated to exclude `PATIENT_NOT_REGISTERED` from booking-assistance path

## Related

- ADR-009: Patient Context Re-query and Booking Continuation
- docs/superpowers/specs/2026-09-16-patient-search-flow-design.md
