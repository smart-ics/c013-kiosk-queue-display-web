# Domain Model — Kiosk Self-Registration

Text-based domain model for the Bilreg kiosk self-registration enhancement.
Companion to the ADRs (001–006) and the glossary.

## Core Entities

```
KioskSession ──1──► KioskFlow          (current screen/state)
     │
     ├──► selectedBooking: Booking|null
     ├──► selectedPatient: Patient|null
     ├──► selectedService: ServiceSelection|null   (poli → dokter → jadwal)
     ├──► selectedServicePoint: ServicePoint|null  (fallback only)
     ├──► registrationResult: Registration|null    ({ regId, noAntrian })
     ├──► assistanceQueue: QueueTicket|null
     ├──► biometricVerdict: Verdict|null
     └──► errorContext: FailureContext|null        (code + message, client-side)
```

## Aggregates

### 1. Booking (aggregate root)

Owns everything a check-in needs to confirm and register.

- `bookingId`, `bookingDate`, `tglBerobat`, `jamPraktek`, `noAntrian`
- `reg` (reference: `regId`, `pasienId`, `pasienName`)
- `layanan` (reference: `layananId`, `layananName`)
- `dokter` (reference: `ppaId`, `ppaName`, `isDefault`)
- `extAppRef` (reference: `extAppName`, `reffId`, `checkInQr`)
- `coverageInfo` (from `GET /Booking/{bookingId}`: `asuransiName`, `noPeserta`, `noRujukan`)

Invariants:
- Check-in is only valid for the active business date.
- `needsEligibility` derives from `coverageInfo.noPeserta` + polis + group map.

### 2. Registration (aggregate root)

The outcome of committing a check-in or walk-in.

- `regId`, `noAntrian` (antrian poli)
- Sourced from `rajalByBooking/direct` or `rajalWalkIn/direct`.

Invariants:
- `regId`/`noAntrian` returned verbatim; never synthesized client-side.
- Not idempotent: a failed call is never auto-retried (risk of duplicate).

### 3. Patient (aggregate root, walk-in)

Search result chosen by the patient.

- `pasienId`, name, disambiguators (MR/NIK/DOB)
- Jaminan context derived via `polis/list/{pasienId}` (not part of search item).

### 4. ServiceCatalog (walk-in picker)

- poli list → dokter per poli → jadwal per dokter, three calls, active business
  date only.
- Selected `dokter.ppaId` + jadwal map into `rajalWalkIn/direct`.

### 5. QueueTicket (assistance / intake fallback)

- Minted by admission-queue ledger: `queueLabel`, `noUrut`, `antrianId`.
- Render + print via print proxy.

## Value Objects

| Value Object | Notes |
| --- | --- |
| `tipeJaminanId` | `'00000'` ⇒ Umum |
| `noPeserta` | BPJS participant number |
| `biometricVerdict` | `READY \| SUCCESS \| FAILED \| CANCELLED \| TIMEOUT` |
| `FailureCode` | diagnostic enum, client-side only |
| `BookingCode` | raw keyword from manual entry or QR (no decode step) |
| `BusinessDate` | from `GET /api/system/business-date` |
| `userId` | constant `"hidokkiosk"` |
| `ServicePointId` | registration counter id |

## Domain Events

| Event | Emitted when | Consumed by |
| --- | --- | --- |
| `BookingSearched` | `Booking/search` returns | confirm screen |
| `BookingNotFound` | empty array | booking-assistance fallback |
| `PatientSearched` | `Pasien/search` returns | walk-in picker |
| `BiometricSucceeded` / `BiometricFailed` | `/biometrik` verdict | SEP chain / fallback |
| `RegistrationCommitted` | `/direct` returns `regId` | success screen + print |
| `RegistrationFailed` | `/direct` errors | failure screen → fallback |
| `AssistanceTicketIssued` | `booking-assistance` returns | display + print |
| `IntakeIssued` | walk-in fallback `/intake` | display + print |
| `SessionReset` | idle timeout / post-print | clear all state |

## Bounded Contexts

```
┌──────────────────────────────┐
│  Kiosk (this app)            │  orchestrates, renders, prints.
│  - no queue label allocation │  - no jaminan policy decisions beyond
│  - only displays API data    │    the replicated rule (ADR-002)
└──────┬───────────────────────┘
       │
┌──────▼──────────────┐   ┌──────────────────────────┐
│ Admission Queue     │   │ HIS Registration (Bilreg)│
│ - intake            │   │ - Booking/search         │
│ - booking-assistance│   │ - Pasien/search          │
│ - service-points    │   │ - rajalByBooking/direct  │
│ - business-date     │   │ - rajalWalkIn/direct     │
│                      │   │ - polis/list            │
└─────────────────────┘   └───────────┬──────────────┘
                                      │
                          ┌───────────▼──────────────┐
                          │ JETLI (BPJS)             │
                          │ - grupJaminan/map        │
                          │ - SEP/rujukan            │
                          │ - Sep (create/upload)    │
                          │ - SEP/finger             │
                          └──────────────────────────┘

Local machine services:
  Print proxy  http://localhost:<port>/print
  Biometric    POST /biometrik   (contract placeholder, ADR-003)
```

## Open Integration Items

- Walk-in patient item schema (picker fields + polis context).
- Service catalog endpoint paths + schemas (3 calls).
- `/direct` request payload shape (confirm minimal form).
- Biometric local-service payload/response JSON (placeholder).
