# ADR-004: Booking-Assistance Fallback Mapping

- **Status:** Accepted
- **Date:** 2026-08-03
- **Branch:** feature/kiosk-self-registration
- **Relates:** ADR-001 (fallback routing), ADR-003 (biometric verdicts)

## Context

When a booking check-in fails for any reason, the kiosk routes the patient to
the registration desk via `POST /api/v1/admission-queue/booking-assistance`.
The PRD payload is `{ bookingId, servicePointId, failureCode, kioskId, userId }`.
This ADR pins down where each field comes from in the stateless kiosk.

## Decision (confirmed 2026-08-03)

| Field | Source |
| --- | --- |
| `bookingId` | Optional. Known booking id if the booking was already resolved; otherwise **not required** — the UI never blocks on it. |
| `servicePointId` | **User-selected** from the kiosk's existing `deviceConfig.servicePointIds` (option b — no dedicated assistance service point). |
| `failureCode` | **Not sent to backend.** The backend does no failure logging. The client logs the failure reason locally when possible. |
| `kioskId` | The `stationId` already present in the URL route — exactly what the kiosk uses when opening a specific station. |
| `userId` | Constant `"hidokkiosk"`. |

### Resulting payload

```json
{
  "bookingId": "known-booking-id | empty",
  "servicePointId": "user-selected-from-device-config",
  "kioskId": "<stationId from route>",
  "userId": "hidokkiosk"
}
```

## UX flow (failure → assistance)

1. Registration attempt fails → show **failure notification** screen.
2. Show the **service point picker** immediately (same picker surface as the
   existing intake flow) — no re-input of booking data.
3. Patient selects a service point → `POST booking-assistance` with the mapping
   above.
4. Response yields the **Antrian Bantuan** number → display + print via the
   existing print proxy.

> **Booking-not-found (confirmed Q15 — option b):** an empty
> `Booking/search` result does **not** offer re-entry. It goes **immediately**
> to the failure notification → service point picker → `booking-assistance`.
> Rationale: the assistance call consumes the booking context
> (`bookingId`), so the fallback path owns the "can't proceed" outcome; there
> is no manual-re-entry loop for a typo'd or expired code.

## Consequences

- **No dedicated assistance service point in config.** Reuses
  `deviceConfig.servicePointIds`.
- **`failureCode` is client-side diagnostics only** — the PRD's failure-code
  table is still useful for internal logging/UI messaging, but is not an API
  contract.
- The assistance flow deliberately mirrors the existing intake picker, so the
  print ticket rendering can reuse the existing queue-ticket layout.
