# Patient Context Search Flow — Design & Decision Brainstorm (2026-09-16)

**For:** `fix/patient-search-flows` branch  
**Context:** Kiosk self-registration unified search flow: `searchBooking` → `deepSearchPasien` → `searchPatientContext` → `confirmPatientContext`

## Overview

This document enumerates all possible flow paths through the patient context search cascade, identifies edge cases, and documents the decisions for two enhancements:

1. **Case 1:** Empty patient-context result → new failure code `PATIENT_NOT_REGISTERED` with message "Pasien yang dicari belum terdata di rumah sakit." Flow remains FAILURE screen with manual service point selector.
2. **Case 2:** Rework re-query logic in `confirmPatientContext` (commit 70793c0):
   - If matched item has booking data (`bookingId` or `kind === 'Booking'`), automatically continue registration with that booking data (fetch booking detail → BOOKING_CONFIRM). No re-query.
   - Re-query patient context ONLY when the best match already has a registration (`kind === 'Registration'` with `registrationId`) — to re-validate that the selected patient already has a registration today.
   - Fresh re-query result used ONLY for validation; never overwrite the pick list (`patientContextResult`).

## Flow Decision Tree

### submitBookingKeyword(keyword)

```
searchBooking(tgl, keyword)
├─ matches.length === 0
│  ├─ keyword is canonical RG ID (RG00000000)
│  │  └─ searchPatientContextFor(keyword)  [skip deepsearch]
│  └─ keyword non-canonical
│     ├─ deepSearchPasien(keyword) → deepMatches
│     │  ├─ deepMatches.length > 0
│     │  │  └─ build synthetic patientContextResult (patients only, bestMatch = Patient)
│     │  │     └─ PATIENT_CONTEXT_CONFIRM
│     │  └─ deepMatches.length === 0
│     │     └─ searchPatientContextFor(keyword)
│     └─ (deepsearch error handled via failure)
├─ matches.length > 1 → FAILURE UNKNOWN_ERROR "Ditemukan lebih dari satu booking"
└─ matches.length === 1 → proceedToBookingConfirm(booking)
```

### searchPatientContextFor(keyword)

```
searchPatientContext({keyword, businessDate})
├─ result.bestMatch || patients.total > 0
│  └─ PATIENT_CONTEXT_CONFIRM
└─ result.bestMatch === null && patients.total === 0
   └─ FAILURE PATIENT_NOT_REGISTERED "Pasien yang dicari belum terdata di rumah sakit."
```

**Note:** Previously emitted `BOOKING_NOT_FOUND`; now emits `PATIENT_NOT_REGISTERED`. The `BOOKING_NOT_FOUND` code remains in the enum for defensive/compatibility reasons but is no longer emitted by this path.

### confirmPatientContext(item)

```
validate item.patientId
set selectedContextPatient, selectedPatient, listPolis

├─ item.bookingId OR item.kind === 'Booking'
│  └─ CASE 2: proceedToBookingConfirm(item.bookingId)
│     ├─ mode = 'booking'
│     ├─ getBookingDetail(bookingId)
│     ├─ listPolis(detail.reg.pasienId)
│     ├─ BPJS validation (coverageInfo check)
│     ├─ deriveBookingJaminan + eligibility
│     └─ transition BOOKING_CONFIRM
│     └─ NO re-query
│
└─ (no booking)
   mode = 'walkin'
   todayRegistrations = filter(patientContextResult.registrations, patientId + visitDate === today)
   
   ├─ todayRegistrations.length > 0
   │  └─ (cached reg found) proceed to reprint/walk-in
   │
   └─ todayRegistrations.length === 0
      ├─ patientContextResult.bestMatch?.kind === 'Registration' && bestMatch.registrationId
      │  └─ CASE 2: re-query ONLY for registration validation
      │     ├─ fresh = searchPatientContext({keyword: normalizePasienIdKeyword(item.patientId)})
      │     ├─ validated = filter(fresh.registrations, patientId + visitDate === today)
      │     ├─ if validated.length === 1 → REGISTRATION_REPRINT (use fresh registrationId)
      │     └─ else → WALKIN_SELECT_GUARANTEE
      │     └─ DO NOT overwrite patientContextResult with fresh
      │
      └─ (bestMatch not a Registration)
         └─ WALKIN_SELECT_GUARANTEE (no re-query)
```

### FAILURE → confirmAssistance(servicePointId)

```
mode === 'booking' && errorContext.code
├─ code === 'BOOKING_NOT_FOUND' OR code === 'PATIENT_NOT_REGISTERED'
│  └─ NO booking identified → intake(servicePointId)
│
└─ code other (e.g., BACKEND_ERROR, DUPLICATE_REGISTRATION)
   └─ booking identified → bookingAssistance({bookingId, servicePointId, ...})
```

### KioskPage automatic fallback watcher

```
watch([flow, mode, submitting, fallbackServicePointId, errorContext.code])
├─ flow !== 'FAILURE' → reset
├─ mode !== 'booking' → skip
├─ submitting → skip
├─ !fallbackServicePointId → skip
├─ errorContext.code === 'BOOKING_NOT_FOUND' OR code === 'PATIENT_NOT_REGISTERED'
│  └─ skip auto-fallback (manual selector remains)
│
└─ otherwise
   └─ registration.confirmAssistance(fallbackServicePointId)
      └─ on success → ASSISTANCE_QUEUE
      └─ on failure → restore manual selector
```

## Flow Scenarios (Brainstorm)

### Scenario 1: Canonical RG ID, patient not found
- Input: `RG12345678`
- `searchBooking` → `[]`
- `searchPatientContextFor` → `bestMatch=null, patients.total=0`
- **Result:** FAILURE `PATIENT_NOT_REGISTERED`, manual selector

### Scenario 2: Non-canonical keyword, deep search hit, patient selected
- Input: `Budi`
- `searchBooking` → `[]`
- `deepSearchPasien` → `[Budi patient]`
- Synthetic `patientContextResult` (bestMatch = Patient)
- User selects Budi patient (no bookingId)
- `confirmPatientContext`: bestMatch.kind = 'Patient' → no re-query → WALKIN_SELECT_GUARANTEE

### Scenario 3: Non-canonical keyword, deep search hit, patient selected has booking
- Input: `Budi`
- `deepSearchPasien` → `[Budi patient with bookingId]`
- User selects Budi patient (item.bookingId present)
- `confirmPatientContext`: bookingId → proceedToBookingConfirm → BOOKING_CONFIRM (auto-continue), no re-query

### Scenario 4: Patient-context search returns Registration bestMatch
- Input: `RG12345678` (canonical) or name search
- `searchPatientContext` → `bestMatch = Registration (registrationId=RG12345678)`
- User selects the patient item (kind Patient, no bookingId)
- `todayRegistrations` empty (filtered by patientId)
- bestMatch.kind === 'Registration' → re-query
- Fresh result: validated registration found → REGISTRATION_REPRINT

### Scenario 5: Patient-context search empty (no patient, no booking, no registration)
- Input: `XYZ`
- `searchPatientContext` → `bestMatch=null, patients.total=0`
- **Result:** FAILURE `PATIENT_NOT_REGISTERED`, manual selector

### Scenario 6: Booking failure → automatic fallback configured
- Input: booking code
- `searchBooking` → `[booking]`
- `getBookingDetail` → success
- Registration fails (e.g., backend error)
- `errorContext.code = BACKEND_ERROR`
- KioskPage watcher: auto-fallback triggers → `bookingAssistance` with bookingId → ASSISTANCE_QUEUE

### Scenario 7: Booking failure (not found) → automatic fallback configured
- Input: booking code
- `searchBooking` → `[]` → `searchPatientContext` → empty
- `errorContext.code = PATIENT_NOT_REGISTERED`
- KioskPage watcher: skip auto-fallback → FAILURE screen with manual selector (user picks service point manually)

## Decisions

### D1: New failure code PATIENT_NOT_REGISTERED

**Context:** Empty patient-context result (no bestMatch, no patients) means the patient is not registered in the hospital at all. The previous code `BOOKING_NOT_FOUND` conflated "booking not found" with "patient not registered."

**Decision:** Introduce `PATIENT_NOT_REGISTERED` failure code with message "Pasien yang dicari belum terdata di rumah sakit. Silakan ambil antrian pendaftaran atau hubungi petugas."

**Consequences:**
- `confirmAssistance` routes to `intake` (no bookingId available)
- KioskPage auto-fallback watcher skips this code (manual selector remains)
- `BOOKING_NOT_FOUND` remains in enum for defensive/compatibility but is no longer emitted

### D2: Booking continuation in confirmPatientContext

**Context:** When the matched patient item has a `bookingId` (or `kind === 'Booking'`), the patient has an existing booking that can be used to continue registration. The previous 70793c0 re-query logic would re-fetch patient context unnecessarily, risking misread data.

**Decision:** If `item.bookingId` or `item.kind === 'Booking'`, automatically continue with booking:
- Set `mode = 'booking'`
- Call `getBookingDetail(item.bookingId)`
- Load polis, BPJS validation, eligibility
- Transition to BOOKING_CONFIRM
- No re-query

**Consequences:**
- Faster UX for patients with bookings found via context search
- Avoids unnecessary re-query that can overwrite pick list
- Reuses existing booking flow logic

### D3: Re-query narrowed to registration validation only

**Context:** Commit 70793c0 introduced re-query whenever today's registrations were empty in cache. This caused misreads when the fresh result overwrote `patientContextResult`, and re-queried unnecessarily for deep-search patients.

**Decision:** Re-query patient context ONLY when:
1. `todayRegistrations.length === 0` (no cached registration for today)
2. `patientContextResult.bestMatch?.kind === 'Registration'` AND `bestMatch.registrationId` (best match indicates an existing registration)

The fresh result is used ONLY for validation:
- Filter `fresh.registrations` for today's registration
- If found → REGISTRATION_REPRINT
- Else → WALKIN_SELECT_GUARANTEE
- DO NOT overwrite `patientContextResult` with fresh result

**Consequences:**
- Re-query only when there's evidence of an existing registration to validate
- Fresh result never corrupts the pick list
- Deep-search patients (bestMatch = Patient) skip re-query → walk-in directly

## Glossary Additions

| Term | Definition |
| --- | --- |
| **PATIENT_NOT_REGISTERED** | Failure code emitted when patient-context search returns no results (no bestMatch, no patients). Indicates the patient is not registered in the hospital at all. Flow shows FAILURE screen with manual service point selector. |
| **Patient Context Search** | Backend endpoint `POST /v1/admisi-rajal/patient-context-search` that returns a unified result set: bookings, registrations, patients, and a bestMatch. Used as a cascade fallback when booking search returns empty. |
| **Deep Search** | Backend endpoint `POST /v1/admisi-rajal/pasien/deep-search` that searches patient records by keyword (NIK, name, phone, etc.). Returns patient objects without booking/registration context. Used as an intermediate fallback before patient-context search. |
| **Booking Continuation** | Flow in `confirmPatientContext` where a matched patient item with `bookingId` automatically continues registration via the booking flow (fetch booking detail → BOOKING_CONFIRM), bypassing re-query. |
| **Registration Validation Re-query** | Narrowed re-query in `confirmPatientContext` that only fires when `bestMatch.kind === 'Registration'` to re-validate whether the selected patient has a registration today. Fresh result used only for validation, never overwrites pick list. |

## Open Questions

1. **BOOKING_NOT_FOUND auto-fallback behavior:** Currently the KioskPage watcher auto-intakes for `BOOKING_NOT_FOUND`. After this change, `BOOKING_NOT_FOUND` is no longer emitted. Should we keep the auto-intake behavior for `PATIENT_NOT_REGISTERED`? **Decision:** No — user requirement explicitly states manual selector for empty-context case. Auto-intake removed for `PATIENT_NOT_REGISTERED`.

2. **Deep-search patient with today's registration:** Under new rules, deep-search patients (bestMatch = Patient) skip re-query entirely. If a deep-search patient already registered today, they will walk-in instead of reprint. Is this acceptable? **Decision:** Yes — user explicitly wants to avoid re-query misreads. Deep-search path is for finding unknown patients; if they already registered, they should search by RG ID directly.

3. **Multiple today registrations for selected patient:** Current code only handles `todayRegistrations.length === 1` → reprint. If > 1, walk-in. Should we show a picker? **Decision:** Out of scope — keep existing behavior (walk-in for > 1).
