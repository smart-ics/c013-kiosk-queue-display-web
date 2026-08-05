# ADR-005: Kiosk Orchestration — State Machine, Double-Submit, Reset

- **Status:** Accepted
- **Date:** 2026-08-03
- **Branch:** feature/kiosk-self-registration
- **Relates:** ADR-001, ADR-004

## Context

The kiosk gains three entry modes (check-in booking, go-show walk-in, existing
queue intake) on a shared public device. State must be scoped per session,
double-submit must be impossible, and a public kiosk must auto-reset.

## Decision

### Not idempotent (confirmed Q11 — option b)

`POST /api/Reg/rajalByBooking/direct` and `POST /api/Reg/rajalWalkIn/direct`
are **not idempotent**. The backend rejects duplicates
(`DUPLICATE_REGISTRATION`) rather than returning the prior result.

Therefore:

- **No auto-retry** after an uncertain reg failure. A lost response could mean
  the registration actually committed — retrying risks a duplicate.
- Any reg-call failure → failure screen → service point picker →
  `booking-assistance` (booking) or `/intake` (walk-in).
- This includes the existing `isUncertainIntakeError` pattern: an "uncertain"
  intake failure must *not* be auto-retried for registration flows.

### Double-submit protection

- A per-session `submitting` guard covers all mutating calls (reg, SEP create,
  biometric call, assistance/intake fallback). While in-flight, submit buttons
  are disabled.
- The biometric call is single-flight: the capture popup cannot be opened twice.

### State machine

`KioskFlow` extends the PRD list:

```ts
type KioskFlow =
  | 'HOME'
  | 'BOOKING_SEARCH'
  | 'BOOKING_CONFIRM'
  | 'BIOMETRIC_VERIFY'
  | 'WALKIN_SEARCH'
  | 'WALKIN_SELECT_PATIENT'      // picker (single or multiple)
  | 'WALKIN_SELECT_SERVICE'
  | 'WALKIN_CONFIRM'
  | 'REGISTRATION_SUCCESS'
  | 'FAILURE'                     // failure notification + service point picker
  | 'ASSISTANCE_QUEUE'
```

Session state (scoped, cleared on reset):
`selectedBooking`, `selectedPatient`, `selectedDoctor`, `selectedService`,
`registrationResult`, `assistanceQueue`, `errorContext`, `verdict` (biometric).

### Auto-reset boundaries

| Trigger | Action |
| --- | --- |
| 60s idle | Reset to `HOME`, clear all session state |
| Print succeeded (reg receipt) | Return to `HOME` in 10s |
| Assistance ticket printed | Return to `HOME` in 15s |
| Session reset | Clear sensitive fields (patient/booking/SEP data), abort in-flight requests, close biometric popup |

## Consequences

- The existing `useKioskIntake` flow is **preserved untouched** as the third
  home-screen entry; new flows get their own orchestrator that reuses
  `useKioskPrint`.
- Uncertain-failure handling diverges by flow: intake keeps its existing retry
  UX; registration flows never auto-retry.
