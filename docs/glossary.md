# Glossary — Kiosk Self-Registration (Bilreg)

Domain terms used across the kiosk self-registration enhancement. Plain-language
definitions; see the ADRs for the decisions behind each.

## Queue concepts

| Term | Definition |
| --- | --- |
| **Antrian Pendaftaran** | Queue number minted by the admission-queue ledger for the registration desk. Produced by the existing `POST /api/v1/admission-queue/intake` (existing "Ambil Antrian Pendaftaran" flow) and by the walk-in failure fallback. |
| **Antrian Poli** | Outpatient/clinic queue number returned directly by the HIS registration service in the `/direct` response (`noAntrian`). Never minted or formatted by the kiosk. |
| **Antrian Bantuan** | Queue number for the registration-assistance desk, minted by `POST /api/v1/admission-queue/booking-assistance` when a booking check-in cannot be completed. |
| **Service Point** | A registration counter/desk in the admission-queue domain (`servicePointId`, `displayName`, `queuePrefix`). A kiosk is configured with its allowed set via `deviceConfig.servicePointIds`. |
| **Queue Label** | The prefixed display string for an antrian (e.g. `AB-012`). Only ever rendered verbatim from a ledger response — never fabricated client-side. |

## Registration concepts

| Term | Definition |
| --- | --- |
| **Check-in Booking** | Kiosk flow where a patient with an existing booking registers for outpatient care. Booking code via manual entry or QR scan. |
| **Go-show / Walk-in** | Kiosk flow where a patient without a booking registers. Identity searched by keyword, then poli → dokter → jadwal selected. |
| **Booking Assistance** | Fallback desk path when booking check-in fails. The kiosk shows a failure notification, the patient picks a service point, and `booking-assistance` issues an antrian bantuan. |
| **`rajalByBooking/direct`** | HIS registration endpoint for check-in booking. Returns `{ regId, noAntrian }`. **Not idempotent** — never auto-retried. |
| **`rajalWalkIn/direct`** | HIS registration endpoint for go-show. Returns `{ regId, noAntrian }`. **Not idempotent** — never auto-retried. |
| **regId** | Registration identifier issued by HIS after a successful registration. |
| **Booking** | A pre-arranged outpatient appointment. Has `bookingId`, a doctor, a service (layanan), a date/time, and an external reference (`extAppRef`) that may include a BPJS rujukan. |

## Jaminan (guarantor) concepts

| Term | Definition |
| --- | --- |
| **Jaminan** | The patient's guarantor type (BPJS, Umum, etc.). |
| **`tipeJaminanId`** | Guarantor type id. `'00000'` means Umum (self-pay) → eligibility not needed. |
| **Polis** | An insurance policy record tied to a patient (`polis/list/{pasienId}`). Source of `noPeserta`/`tipeJaminanId` for walk-ins and of the `noPeserta` match for bookings. |
| **Group Jaminan Map** | JETLI mapping `tipeJaminanId → groupJaminanId`. Non-null ⇒ eligibility is required. |
| **Eligibility / needsEligibility** | Whether the patient's jaminan requires SEP verification before registration. Computed as `tipeJaminanId !== '00000' && currentGroupJaminan !== null`. |
| **noPeserta** | BPJS participant number. For bookings it comes from booking `coverageInfo`; for walk-ins from the first/active polis. |
| **SEP** | Surat Eligibilitas Peserta — the BPJS eligibility document created/uploaded via JETLI before a BPJS registration can complete. |
| **Rujukan** | BPJS referral number. Bookings carry it in `extAppRef.reffId`; walk-ins fetch available rujukan/SKDP via `SEP/rujukan/{noPeserta}/peserta`. |
| **SKDP** | Surat Kontrol Dokter Pembiayaan — a follow-up control letter; listed alongside rujukan for the patient to choose from. |

## Device & biometric concepts

| Term | Definition |
| --- | --- |
| **stationId / kioskId** | The kiosk's device identifier from the URL route. Sent as `kioskId` in the booking-assistance payload. |
| **`userId`** | Actor id in HIS payloads. Fixed to `"hidokkiosk"` for kiosk calls. |
| **Biometric verdict** | Outcome of `POST /biometrik`: `READY` (no capture needed), `SUCCESS` (captured), or `FAILED` / `CANCELLED` / `TIMEOUT`. Only the verdict is consumed; no biometric data is stored. |
| **Print proxy** | The machine-local service (`http://localhost:<port>/print`) used for thermal receipt printing. Reused for the new "Bukti Registrasi" layout via a distinct `doctype`. |
| **Bukti Registrasi** | New print layout (regId + noAntrian + patient/booking/service summary) for successful registration — booking and walk-in share it. |
| **Failure Code** | Internal diagnostic code (e.g. `BIOMETRIC_FAILED`, `BOOKING_NOT_FOUND`, `DUPLICATE_REGISTRATION`). **Client-side logging only** — not sent to the backend. |
