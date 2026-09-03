# Reg ID Direct Reprint Design

**Date:** 2026-09-02

## Goal

When a user searches the kiosk using a registration ID and an existing registration is found, the kiosk skips the new-registration flow, displays the existing registration details, and lets the user explicitly print the registration ticket again.

## Scope

- Applies only to canonical Reg ID searches handled by the existing booking/search entry point.
- Does not create or modify a registration.
- Does not change the existing booking, patient-context, walk-in, biometric, SEP, or assistance flows.
- The user must see the registration details before printing and must press `Cetak ulang`.

## Data Contract

`PatientContextItem` is sufficient to identify the matching registration, but it is not sufficient to print a receipt because it does not contain the queue number or all receipt fields. The kiosk uses the existing HIS registration read operation keyed by `regId`:

```http
GET /api/Reg/{id}
```

This route is owned by `Bilreg.Api.Controllers.AdmisiContext.RegFeature.RegController.GetData` and returns `RegGetResponse`. No new backend endpoint is required.

The API client must validate `RegGetResponse`, then map it to a focused `RegistrationPrintData` containing:

- `regId: string`
- `noAntrian: number`
- `pasienName: string`
- `pasienId?: string`
- `tglLahir?: string`
- `tipeJaminanName?: string`
- `noSep?: string`
- `serviceName?: string`
- `dokterName?: string`

The mapping uses `RegGetResponse.RegId`, `NoAntrian`, `Pasien`, `Layanan`, `Dokter`, `TipeJaminan`, and `SjpNo`. The frontend must not fabricate `noAntrian`, SEP, or other receipt data. An incomplete response is an error and must not open the reprint screen.

## Flow

```text
BOOKING_SEARCH
  -> PATIENT_CONTEXT_SEARCH
  -> select one exact Registration result
  -> GET /api/Reg/{id}
  -> map validated RegGetResponse to RegistrationPrintData
  -> REGISTRATION_REPRINT
  -> user presses Cetak ulang
  -> printRegistration(printData)
```

Registration matching must inspect `registrations.items` for the normalized Reg ID. Exactly one match enters the detail lookup. Zero matches continues to the existing patient-context fallback. Multiple matches are a failure because the kiosk must not choose an ambiguous registration. `bestMatch` may be used only when it is itself a `Registration` with the expected registration ID. A patient or booking result must continue through the existing flow.

The transition map must allow `HOME -> REGISTRATION_REPRINT` because `KioskHome` submits its search directly while the flow is still `HOME`.

## UI

Add `RegistrationReprintStep.vue` with:

- Reg ID as the primary identifier.
- Patient name, service, doctor, and queue number.
- Print progress, success, and failure states.
- A disabled `Cetak ulang` button while printing.
- A `Kembali ke menu` action that clears the registration/reprint state.

`REGISTRATION_REPRINT` intentionally does not appear in the existing five-step registration stepper; it is a post-search reprint screen, not a registration step.

The existing `RegistrationSuccessStep.vue` remains for registrations created during the current kiosk session. It is not reused for an existing-registration reprint because its success copy and lifecycle semantics differ.

## State And Error Handling

- Add a dedicated reprint data ref to `useKioskRegistration`.
- Clear it in `goHome()` and before starting a new search.
- On a successful detail lookup, set the data and transition to `REGISTRATION_REPRINT`.
- On lookup failure, use the existing failure mapping and do not transition to the reprint step.
- On print failure, remain on `REGISTRATION_REPRINT` so the user can retry.
- Idle timeout and `Kembali ke menu` use the existing reset behavior.
- The new state and action names must not collide with the existing `reprintRegistration()` action used by `REGISTRATION_SUCCESS`; use names such as `registrationReprintData` and `loadRegistrationPrintData`.
- Keep `RegistrationReceiptData.noAntrian` required as a number. Remove the unrelated nullable/empty rendering relaxation so every receipt path has a real queue number.

## Testing

- Normalize and recognize canonical Reg IDs as before.
- Route an exact registration search result directly to `REGISTRATION_REPRINT`.
- Verify booking and patient results retain their existing transitions.
- Verify missing print data becomes `FAILURE` and never invokes the printer.
- Verify the reprint action passes the complete backend data to `printRegistration`.
- Verify print errors leave the reprint screen retryable.
- Verify `goHome()` clears reprint state.
- Verify `HOME -> REGISTRATION_REPRINT` is legal.
- Verify `REGISTRATION_REPRINT` does not trigger the registration-success auto-print path.

## Acceptance Criteria

1. Searching a valid existing Reg ID does not show patient confirmation, guarantee selection, service selection, or registration confirmation.
2. The kiosk displays the existing registration details before any print request.
3. No print request occurs until the user presses `Cetak ulang`.
4. The printed receipt uses the backend-provided queue number and registration data.
5. A missing or invalid registration detail response cannot produce a misleading receipt.
