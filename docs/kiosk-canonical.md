# Kiosk Display (C2) — Canonical Documentation

This document is the **canonical reference** for the KIOSK display app at
`apps/kiosk-web/` (Bilreg Admission Queue v1, intake client C2). It captures the
feature surface, runtime flow, error-handling contract, and Bahasa Indonesia
user-facing messages that the kiosk presents.

> **Related apps**
> - `apps/display-web/` — Queue Display client C3 (see [docs/display-canonical.md](display-canonical.md))
> - `apps/config-web/` — Device Configuration D0–D7 (see [docs/config-canonical.md](config-canonical.md))

---

## 1. Purpose

The KIOSK is a self-service intake station placed at the hospital entrance. It
issues queue numbers, accepts walk-in patients, and prints admission tickets
before routing the patient to the relevant loket. The kiosk never handles
officer workflows — those live in `c012_myhospital_web`.

## 2. Runtime Path

| | |
|---|---|
| **URL** | `/kiosk/{stationId}` |
| **Dev** | `pnpm dev:kiosk` → `http://localhost:5173/kiosk/{stationId}` |
| **Device config endpoint** | `GET {bilregApiBase}/v1/admission-queue/devices/kiosks/{stationId}` |
| **Auth** | `POST {bilregApiBase}/User/login` (kiosk account) → JWT injected by `IAuthTokenProvider` |

The kiosk uses **snapshot-first** boot: device config is fetched at startup
from the public `/devices/kiosks/{id}` endpoint, then live data follows.

## 3. Endpoints Consumed

| # | Endpoint | Method | Purpose | Auth |
|---|---|---|---|---|
| 1 | `/User/login` | POST | Bootstraps JWT for kiosk | — |
| 2 | `/v1/admission-queue/configuration/kiosks` | GET | List all kiosks (for station picker) | public |
| 3 | `/v1/admission-queue/devices/kiosks/{stationId}` | GET | Boot config (service points, branding) | public |
| 4 | `/v1/admission-queue/service-points?activeOnly=true` | GET | List active service points | bearer |
| 5 | `/v1/admission-queue/intake` | POST | Direct walk-in intake | bearer |
| 6 | `/v1/admission-queue/booking-assistance` | POST | Booking-based intake assistance | bearer |
| 7 | `/system/business-date` | GET | Hospital business date | public |
| 8 | `/Booking/search/{tgl}/{keyword}` | GET | Search booking by keyword | bearer |
| 9 | `/Booking/{bookingId}` | GET | Get booking detail | bearer |
| 10 | `/polis/list/{pasienId}` | GET | List patient policies | bearer |
| 11 | `/Layanan/2/list` | GET | List polis (walk-in flow) | bearer |
| 12 | `/JadwalPraktek/layanan/{poliId}` | GET | List doctors in poli | bearer |
| 13 | `/PraktekDokter/dokter` | POST | List doctor schedules | bearer |
| 14 | `/Karcis/{layananId}/list` | GET | List karcis types | bearer |
| 15 | `/v1/admisi-rajal/patient-context-search` | POST | Patient context lookup | bearer |
| 16 | `/pasien/search/{keyword}` | GET | Deep patient search | bearer |
| 17 | `/Reg/rajalByBooking/direct` | POST | Register by booking | bearer |
| 18 | `/Reg/rajalWalkIn/direct` | POST | Register walk-in | bearer |
| 19 | `/Reg/setDataEligibility` | PATCH | Set eligibility (SEP upload) | bearer |
| 20 | `/grupJaminan/map` (jetli) | GET | Map jaminan group | bearer |
| 21 | `/Sep/rujukan/{noPeserta}/peserta` (jetli) | GET | BPJS rujukan + SKDP | bearer |
| 22 | `/Sep` (jetli) | POST | Create SEP | bearer |
| 23 | `/Sep/upload` (jetli) | PATCH | Upload SEP file | bearer |

## 4. Error-Handling Architecture

All KIOSK errors flow through **two layers** that produce Bahasa Indonesia
user-facing messages. Technical codes (e.g. `AQ_RESOURCE_NOT_FOUND`) are
**logged only** and never shown to users.

### 4.1 Layer 1 — Backend API codes (`@aq/api-client`)

`packages/api-client/src/errors.ts` exposes:

- `AQ_ERROR_CODES` — all 19 backend error codes as a const enum
- `AQ_ERROR_MESSAGES_ID` — Bahasa Indonesia user-facing string per code
- `mapBackendErrorToUserMessage(error)` — primary mapper; takes any error
  (including raw `Error`) and returns a localized, actionable message
- `mapIntakeErrorMessage(error)` — intake-specific mapper with retry guidance
- `isUncertainIntakeError`, `isSequenceExhausted`, `isOperationNotAllowed` — predicates
- `ApiClientError` — wraps `fetch` failures, includes `status`, `code`, `body`

#### Fallback ladder in `mapBackendErrorToUserMessage`:

1. AQ code → `AQ_ERROR_MESSAGES_ID[code]`
2. HTTP status → `HTTP_STATUS_MESSAGES_ID[status]`
3. `error.message` from `ApiClientError`
4. `error.message` from generic `Error`
5. Generic fallback: `"Terjadi kesalahan. Silakan coba lagi."`

### 4.2 Layer 2 — App failure codes (`apps/kiosk-web/src/lib/failureCode.ts`)

`FAILURE_CODES` maps higher-level app failure codes (e.g. `BOOKING_NOT_FOUND`,
`SCHEDULE_FULL`) shown in the full-screen `FailureStep` component:

- `FAILURE_MESSAGES_ID` — Bahasa Indonesia user-facing string per code
- `getFailureMessage(code)` — returns localized message
- `mapErrorToFailureCode(error)` — best-effort mapping from raw error to code

### 4.3 Per-endpoint mapper callers

| Endpoint | Mapper |
|---|---|
| `service-points` (TanStack Query) | `mapBackendErrorToUserMessage` (KioskPage.vue) |
| WalkinServiceStep (poli/dokter/jadwal) | `mapBackendErrorToUserMessage` |
| `intake` (direct) | `mapIntakeErrorMessage` + retry button |
| `booking-assistance` | `mapErrorToFailureCode` + `messageFromError` → FailureStep |
| HIS registration flow | `messageFromError` → `mapBackendErrorToUserMessage` |
| JETLI SEP flow | `messageFromError` → `mapBackendErrorToUserMessage` |
| Device boot | `DeviceConfigNotFoundError` / `DeviceConfigInvalidError` (Bahasa) |
| Login | retry loop; on exhaustion → boot-failure red screen |

## 5. Bahasa Indonesia Message Catalog

### 5.1 Admission Queue codes (`AQ_ERROR_MESSAGES_ID`)

| Code | User message (Bahasa Indonesia) |
|---|---|
| `AQ_INVALID_REQUEST` | Permintaan tidak valid. Periksa data yang diinput dan coba lagi. |
| `AQ_OPERATION_NOT_ALLOWED` | Operasi tidak diizinkan. Service Point mungkin tidak aktif atau sudah dinonaktifkan. |
| `AQ_UNAUTHENTICATED` | Sesi kiosk habis. Silakan mulai ulang aplikasi kiosk. |
| `AQ_FORBIDDEN` | Anda tidak memiliki izin untuk operasi ini. Hubungi administrator. |
| `AQ_RESOURCE_NOT_FOUND` | Data yang dicari tidak ditemukan. Silakan hubungi petugas. |
| `AQ_CONCURRENCY_CONFLICT` | Data telah diubah oleh pengguna lain. Silakan muat ulang dan coba lagi. |
| `AQ_SEQUENCE_EXHAUSTED` | Nomor antrian untuk Service Point ini sudah habis hari ini. Silakan hubungi petugas. |
| `AQ_CONFIG_INVALID` | Konfigurasi tidak valid. Silakan hubungi administrator. |
| `AQ_WORKSTATION_NOT_FOUND` | Workstation tidak ditemukan. Silakan hubungi administrator. |
| `AQ_WORKSTATION_INACTIVE` | Workstation tidak aktif. Silakan hubungi administrator. |
| `AQ_WORKSTATION_LOKET_CONFLICT` | Loket ini sudah dipetakan ke workstation lain. Silakan hubungi administrator. |
| `AQ_DISPLAY_NOT_FOUND` | Display tidak ditemukan. Silakan hubungi administrator. |
| `AQ_DISPLAY_INACTIVE` | Display tidak aktif. Silakan hubungi administrator. |
| `AQ_DISPLAY_MAPPING_REQUIRED` | Display belum dipetakan ke Loket. Silakan hubungi administrator. |
| `AQ_KIOSK_NOT_FOUND` | Kiosk tidak ditemukan. Silakan hubungi administrator. |
| `AQ_KIOSK_INACTIVE` | Kiosk tidak aktif. Silakan hubungi administrator. |
| `AQ_KIOSK_MAPPING_REQUIRED` | Kiosk belum dipetakan ke Service Point. Silakan hubungi administrator. |
| `AQ_CONFIG_CONCURRENCY` | Konfigurasi telah diubah oleh pengguna lain. Silakan muat ulang. |
| `AQ_CONFIG_FORBIDDEN` | Anda tidak memiliki izin mengubah konfigurasi. Hubungi administrator. |

### 5.2 HTTP status fallbacks

| Status | User message |
|---|---|
| 0 (network) | Koneksi ke server terputus. Periksa jaringan dan coba lagi. |
| 401 | Sesi habis. Silakan mulai ulang aplikasi kiosk. |
| 403 | Anda tidak memiliki izin untuk aksi ini. Hubungi administrator. |
| 404 | Data yang dicari tidak ditemukan. Silakan hubungi petugas. |
| 409 | Data telah diubah oleh pengguna lain. Silakan muat ulang dan coba lagi. |
| 422 | Data yang diinput tidak valid. Periksa kembali dan coba lagi. |
| 500 | Terjadi kesalahan pada server. Silakan coba lagi. |
| 503 | Layanan sementara tidak tersedia. Coba lagi dalam waktu yang singkat. |

### 5.3 App failure codes

| Code | User message |
|---|---|
| `BIOMETRIC_FAILED` | Verifikasi biometrik gagal. Silakan coba lagi atau hubungi petugas. |
| `BIOMETRIC_TIMEOUT` | Verifikasi biometrik timeout. Periksa jaringan dan coba lagi. |
| `BPJS_VALIDATION_FAILED` | Validasi BPJS gagal. Nomor kepesertaan tidak valid atau tidak aktif. |
| `BOOKING_NOT_FOUND` | Data booking tidak ditemukan. Silakan cari dengan nomor booking yang benar. |
| `SCHEDULE_FULL` | Jadwal sudah penuh untuk hari ini. Silakan pilih tanggal lain atau hubungi petugas. |
| `DUPLICATE_REGISTRATION` | Anda sudah terdaftar untuk antrian hari ini. Silakan cek status pendaftaran. |
| `BACKEND_ERROR` | Terjadi kesalahan pada sistem. Silakan coba lagi dalam beberapa saat. |
| `UNKNOWN_ERROR` | Terjadi kesalahan yang tidak diketahui. Silakan hubungi administrator. |

## 6. UI Surfaces for Errors

| Component | When shown | What it displays |
|---|---|---|
| `BootErrorPage` | Startup failure (config / device) | `bootError` string from KioskPage |
| `loadingMessage` (KioskPage) | Service-points query failed | `mapBackendErrorToUserMessage(error)` |
| `useKioskIntake` retry panel | Direct intake failed | `mapIntakeErrorMessage(error)` + Retry button |
| `FailureStep` (full screen) | Booking / walk-in / assistance failure | `getFailureMessage(failureCode)` |
| `WalkinServiceStep` inline error | Poli/dokter/jadwal load failed | `mapBackendErrorToUserMessage(error)` |
| `kioskLogin` red screen | Login retry exhausted | Raw red HTML with console hint |

## 7. Conventions & Boundaries

- Vue 3 + `<script setup lang="ts">` + Composition API only
- No Options API, no `watchEffect` (use `watch`)
- No client-side Queue Label allocation; the backend is the only source of truth
- TanStack Query used only for `service-points` and `business-date` (retry: false)
- All runtime config is loaded from `public/global_config.json` (not build-time)
- No static JWT embedded; all auth via `IAuthTokenProvider`
- Fullscreen must be launched at OS/browser level (`chrome.exe --kiosk …`)

## 8. Verification Gate

```bash
pnpm turbo run typecheck test
```

- Typecheck: `vue-tsc -p tsconfig.app.json --noEmit`
- Tests: `vitest run` (jsdom, glob `src/**/*.spec.ts`)

## 9. Deployment

Kiosk apps are launched on Windows via Chrome kiosk mode. Helper scripts
auto-generate desktop shortcuts:

- `scripts/create-kiosk-shortcut.bat`

## 10. Related Documents

- [Domain Model](domain-model.md) — entities, aggregates, value objects
- [Glossary](glossary.md) — domain terms
- [API contracts](api/) — V1 endpoint specifications
- [ADR-001: Bahasa Indonesia error messages](adr/ADR-001-bahasa-indonesia-error-messages.md)
