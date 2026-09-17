# ADR-009: Patient Context Re-query Narrowing and Booking Continuation

- **Status:** Proposed
- **Date:** 2026-09-16
- **Branch:** fix/patient-search-flows

## Context

Commit 70793c0 introduced a re-query in `confirmPatientContext` when today's registrations were empty in the cached `patientContextResult`. The re-query fetched fresh patient context with the selected patient's `pasienId` as keyword, then overwrote `patientContextResult` with the fresh result.

This caused issues:
1. **Misread risk:** Overwriting `patientContextResult` with fresh data could corrupt the pick list, causing wrong patient selection downstream.
2. **Unnecessary re-query:** Deep-search patients (bestMatch = Patient) triggered re-query even without evidence of an existing registration.
3. **Booking data ignored:** When the matched item had a `bookingId`, the flow still went to walk-in instead of continuing with the booking.

## Decision

### Booking Continuation

When the matched patient item has `bookingId` (or `item.kind === 'Booking'`):
- Set `mode = 'booking'`
- Call `getBookingDetail(item.bookingId)` to fetch current booking detail
- Load polis, validate BPJS coverage, compute eligibility
- Transition to BOOKING_CONFIRM
- **No re-query**

This reuses the existing booking flow logic (extracted into `proceedToBookingConfirm` helper).

### Re-query Narrowing

Re-query patient context ONLY when:
1. `todayRegistrations.length === 0` (no cached registration for today)
2. `patientContextResult.bestMatch?.kind === 'Registration'` AND `bestMatch.registrationId` (best match indicates an existing registration)

The fresh result is used **ONLY for validation**:
- Filter `fresh.registrations` for today's registration for the selected patient
- If exactly 1 found → REGISTRATION_REPRINT (use fresh registrationId)
- Else → WALKIN_SELECT_GUARANTEE
- **DO NOT overwrite `patientContextResult` with fresh result**

### Deep-Search Path

For deep-search synthetic results (bestMatch = Patient):
- `todayRegistrations` empty (synthetic result has no registrations)
- `bestMatch.kind === 'Patient'` → re-query condition fails
- **Result:** WALKIN_SELECT_GUARANTEE directly (no re-query)

## Consequences

### Positive
- Eliminates re-query misread risk (fresh data never overwrites pick list)
- Faster UX for booking matches (auto-continue with booking data)
- Re-query only when there's evidence of an existing registration to validate
- Deep-search patients skip unnecessary re-query

### Negative
- Deep-search patients who already registered today will walk-in instead of reprint (lost reprint detection for deep-search path)
- Existing tests for 70793c0 re-query behavior must update

### Neutral
- `BOOKING_NOT_FOUND` remains in enum but unused
- Re-query logic simplified to a single condition

## Implementation Notes

### Helper Extraction

Extract booking-loading logic from `submitBookingKeyword` into `proceedToBookingConfirm(booking: BookingSearchItem)`:
```ts
async function proceedToBookingConfirm(booking: BookingSearchItem): Promise<void> {
  selectedBooking.value = booking
  const detail = await deps.getBookingDetail(booking.bookingId)
  const polisList = await deps.listPolis(detail.reg.pasienId)
  // ... BPJS validation, eligibility ...
  bookingDetail.value = detail
  bookingEligibility.value = {...}
  transition('BOOKING_CONFIRM')
}
```

### confirmPatientContext Booking Path

```ts
if (item.bookingId) {
  mode.value = 'booking'
  const booking: BookingSearchItem = { /* construct minimal item from context item */ }
  return withSubmit(async () => {
    try {
      await proceedToBookingConfirm(booking)
    } catch (error) {
      setFailure(mapErrorToFailureCode(error), messageFromError(error))
    }
  })
}
```

### Re-query Guard

```ts
const todayRegistrations = filter(patientContextResult.registrations, patientId + visitDate === today)

if (todayRegistrations.length === 0 &&
    patientContextResult.bestMatch?.kind === 'Registration' &&
    patientContextResult.bestMatch.registrationId) {
  const fresh = await deps.searchPatientContext({ keyword: normalizePasienIdKeyword(item.patientId), businessDate: today })
  const validated = filter(fresh.registrations, patientId + visitDate === today)
  if (validated.length === 1) {
    // Use validated[0].registrationId for reprint
    // DO NOT assign patientContextResult.value = fresh
  }
}
```

## Related

- ADR-008: PATIENT_NOT_REGISTERED Failure Code for Empty Patient Context
- docs/superpowers/specs/2026-09-16-patient-search-flow-design.md
- Commit 70793c0: fix: re-query patient context when registrations empty for deep-search path
- Commit 2b93e92: fix: normalize pasienId keyword for context re-query
