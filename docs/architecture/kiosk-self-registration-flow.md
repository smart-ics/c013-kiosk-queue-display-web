# Kiosk Self Registration — Alur Terkini (Search-First Cascade)

Status: CURRENT
LastUpdated: 2026-09-28

> Dokumen acuan terkini untuk alur self-registration kiosk (`apps/kiosk-web`).
> Setiap section mencantumkan penanda sumber. Kode tidak diubah oleh dokumen ini.

---

## 1. Unified search-first cascade terkini

Sumber: `apps/kiosk-web/src/composables/useKioskRegistration.ts` (`submitBookingKeyword` 404–509, `searchPatientContextFor` 511–556).

Urutan cascade dari satu keyword (`HOME` → input manual/scan QR, termasuk decode `getKodeBookingMjkn`):

1. `ensureBusinessDate()` — ambil tanggal bisnis HIS (`getBusinessDate`), dipakai untuk semua pencarian hari itu.
2. `searchBooking(tgl, keyword)` — keyword sudah dinormalisasi (`normalizeRegistrationIdKeyword`, mis. `RG1` → `RG00000001`).
3. Cabang hasil booking:
   - `matches.length === 1` → `getBookingDetail` + `listPolis` → cek polis BPJS → `BOOKING_CONFIRM`.
   - `matches.length > 1` → `FAILURE` (`UNKNOWN_ERROR`, pesan: ditemukan lebih dari satu booking, hubungi petugas).
   - `matches.length === 0` → lanjut ke langkah 4.
4. Jika keyword adalah RG-kanonis (`RG` + 8 digit, `isCanonicalRegistrationIdKeyword`) → langsung `searchPatientContextFor` (jalur reprint, lihat section 6).
5. Jika bukan RG-kanonis → `deepSearchPasien(keyword)`:
   - Ada hasil → petakan ke item `Patient` (`matchType: 'DeepSearch'`) → `PATIENT_CONTEXT_CONFIRM`.
   - Kosong → `searchPatientContextFor(keyword)` → `PATIENT_CONTEXT_CONFIRM` jika ada `bestMatch`/pasien, jika tidak ada sama sekali → `FAILURE` (`PATIENT_NOT_REGISTERED`).

Catatan koreksi atas dokumen lama: pencarian booking selalu didahulukan; patient-context hanya fallback. Deep-search hanya untuk keyword non-RG.

Catatan keyword awal: keyword bisa berupa kode booking, nomor rujukan, nomor BPJS, nomor RM, atau nama (`KioskHome.vue:118` → `submitBookingKeyword`). Nomor BPJS di sini hanya keyword pencarian, bukan input nomor peserta guarantee — tidak ada kolom input nomor peserta terpisah.

---

## 2. State machine lengkap

Sumber: `apps/kiosk-web/src/lib/flow.ts` (verbatim, 14 state).

```ts
export type KioskFlow =
  | 'HOME'
  | 'BOOKING_SEARCH'
  | 'BOOKING_CONFIRM'
  | 'PATIENT_CONTEXT_SEARCH'
  | 'PATIENT_CONTEXT_CONFIRM'
  | 'WALKIN_SELECT_GUARANTEE'
  | 'BIOMETRIC_VERIFY'
  | 'BPJS_SELECT_REFERENCE'
  | 'WALKIN_SELECT_SERVICE'
  | 'WALKIN_CONFIRM'
  | 'REGISTRATION_SUCCESS'
  | 'REGISTRATION_REPRINT'
  | 'FAILURE'
  | 'ASSISTANCE_QUEUE'

export const FLOW_TRANSITIONS: Record<KioskFlow, readonly KioskFlow[]> = {
  HOME: [
    'BOOKING_SEARCH',
    'BOOKING_CONFIRM',
    'PATIENT_CONTEXT_SEARCH',
    'PATIENT_CONTEXT_CONFIRM',
    'REGISTRATION_REPRINT',
    'FAILURE',
  ],
  BOOKING_SEARCH: [
    'BOOKING_CONFIRM',
    'PATIENT_CONTEXT_SEARCH',
    'PATIENT_CONTEXT_CONFIRM',
    'REGISTRATION_REPRINT',
    'FAILURE',
  ],
  BOOKING_CONFIRM: ['BIOMETRIC_VERIFY', 'BPJS_SELECT_REFERENCE', 'REGISTRATION_SUCCESS', 'FAILURE'],
  PATIENT_CONTEXT_SEARCH: ['BOOKING_CONFIRM', 'PATIENT_CONTEXT_CONFIRM', 'REGISTRATION_REPRINT', 'FAILURE'],
  PATIENT_CONTEXT_CONFIRM: [
    'WALKIN_SELECT_GUARANTEE',
    'BOOKING_CONFIRM',
    'REGISTRATION_REPRINT',
    'FAILURE',
    'HOME',
  ],
  WALKIN_SELECT_GUARANTEE: [
    'WALKIN_SELECT_SERVICE',
    'BIOMETRIC_VERIFY',
    'BPJS_SELECT_REFERENCE',
    'FAILURE',
    'HOME',
  ],
  BIOMETRIC_VERIFY: [
    'BPJS_SELECT_REFERENCE',
    'REGISTRATION_SUCCESS',
    'WALKIN_SELECT_SERVICE',
    'FAILURE',
  ],
  BPJS_SELECT_REFERENCE: ['REGISTRATION_SUCCESS', 'WALKIN_SELECT_SERVICE', 'FAILURE', 'HOME'],
  WALKIN_SELECT_SERVICE: ['WALKIN_CONFIRM', 'FAILURE'],
  WALKIN_CONFIRM: ['BIOMETRIC_VERIFY', 'REGISTRATION_SUCCESS', 'FAILURE'],
  REGISTRATION_SUCCESS: ['HOME'],
  REGISTRATION_REPRINT: ['HOME'],
  FAILURE: ['ASSISTANCE_QUEUE'],
  ASSISTANCE_QUEUE: ['HOME'],
}
```

Navigasi dijaga `canTransition`; transisi ilegal melempar error. Proteksi submit ganda via flag `submitting` (`withSubmit`).

---

## 3. Happy-path booking & walk-in

Sumber: `useKioskRegistration.ts` (`confirmBooking`, `handleBpjsVerification*` 755–877, `selectBpjsReference`, `selectWalkinGuarantee`, `register` 897–985, `prepareBilregRegistrationData` 997–1013).

Urutan lifecycle yang benar: **register → SEP → upload → eligibility**.

**Booking (BPJS):** `BOOKING_CONFIRM` → verifikasi BPJS (`getRujukanSkpd`) → jika usia ≥ 17 tahun `BIOMETRIC_VERIFY` (verdict `SUCCESS`/`READY` lanjut), jika < 17 tahun lewati biometrik → `BPJS_SELECT_REFERENCE` → `register('booking')` → `registerBookingCommit` (karcis via `listKarcis` + mapping app-config, mapping rujukan lokal via `prepareBilregRegistrationData`) → `POST Reg/rajalByBooking/direct` → `POST Sep` (satu kali) → `PATCH Sep/upload` (maks 3x) → `PATCH Reg/setDataEligibility` (maks 3x) → `REGISTRATION_SUCCESS` → cetak registrasi + label.

**Booking (non-BPJS):** `BOOKING_CONFIRM` → langsung `register('booking')` → `REGISTRATION_SUCCESS` → cetak.

**Walk-in:** `PATIENT_CONTEXT_CONFIRM` → `confirmPatientContext` → `WALKIN_SELECT_GUARANTEE` → jika `needsEligibility` (BPJS): verifikasi rujukan/SKDP → biometrik (usia ≥ 17) → `WALKIN_SELECT_SERVICE` (poli → dokter → jadwal) → `WALKIN_CONFIRM` → `register('walkin')` (`POST Reg/rajalWalkIn/direct` + lifecycle SEP yang sama) → `REGISTRATION_SUCCESS` → cetak. Jika non-BPJS: langsung `WALKIN_SELECT_SERVICE` tanpa verifikasi BPJS/biometrik.

Aturan usia: < 17 tahun tidak menjalani biometrik (langsung ke referensi/layanan); ≥ 17 tahun wajib biometrik sebelum lanjut.

Sumber `noPeserta` (tidak ada input ketik nomor peserta). Booking: `noPeserta` dari `detail.coverageInfo.noPeserta` dicocokkan ke `listPolis` (`lib/eligibility.ts:24-33`, `useKioskRegistration.ts:491,582`); tanpa polis BPJS/JKN → `BPJS_VALIDATION_FAILED` (483–489, 574–580). Walk-in: `noPeserta` dari polis yang diklik (`WalkinSelectGuaranteeStep.vue:48-54` → `walkinNoPeserta:687`); opsi `BPJS_FALLBACK` (`noPeserta` null, :40-46) → failure langsung (:669-674). `setWalkinNoPeserta` di-export tapi tidak dipakai UI mana pun. Layar khusus jaminan hanya `WalkinSelectGuaranteeStep` (Pilih Penjamin/Jaminan) + `BpjsSelectReferenceStep` (pilih rujukan/SKDP bila > 1); booking tidak lewat `WalkinSelectGuaranteeStep` (tetap bisa lewat `BpjsSelectReferenceStep`).

Catatan kode: guard SEP di `register` (`useKioskRegistration.ts:906`) memakai literal `'00000'`, bukan konstanta `UMAT_TIPE_JAMINAN_ID` (`lib/eligibility.ts:3`); nilai identik tetapi duplikasi literal — selaraskan ke konstanta saat menyentuh kode itu.

---

## 4. Edge-case

Sumber: `useKioskRegistration.ts` (404–509, 600–659), `apps/kiosk-web/src/lib/failureCode.ts` (9 codes + pesan ID), `FailureStep.vue:40-45`.

**Dua lapis pesan — jangan disamakan.** Pesan yang benar-benar tampil di layar berasal dari string inline yang diteruskan ke `setFailure` di call-site (`useKioskRegistration.ts:484-487, 574-578, 669-674, 794-796, 870-872`); `FailureStep.vue:40-45` (`getDisplayMessage`) memprioritaskan pesan inline itu (hanya normalisasi pesan HTTP generik, fallback ke `getFailureMessage` bila inline kosong). `FAILURE_MESSAGES_ID` (`failureCode.ts:21-31`) adalah pesan-kanonis per kode yang hanya dipakai bila inline kosong / via `getFailureMessage` (mis. `PATIENT_NOT_REGISTERED` di `searchPatientContextFor`). Tabel di bawah mengutip pesan-aktual-inline, bukan pesan-kanonis.

| Kasus                                                                           | Perilaku kini (pesan aktual inline)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Multi-booking (`matches.length > 1`)                                            | `FAILURE` `UNKNOWN_ERROR` — "Ditemukan lebih dari satu booking. Hubungi petugas."                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Multi-registrasi RG-kanonis (`exactMatches > 1`)                                | `FAILURE` `UNKNOWN_ERROR` — "Ditemukan lebih dari satu registrasi. Hubungi petugas." (`searchPatientContextFor` 539–542). Beda dengan kasus `todayRegistrations.length > 1` di `confirmPatientContext` (lihat catatan di bawah) — kandidat perbaikan kode agar konsisten.                                                                                                                                                                                                                                                |
| BPJS tanpa polis (`coverageInfo.noPeserta` ada tapi `listPolis` tanpa BPJS/JKN) | `FAILURE` `BPJS_VALIDATION_FAILED` — "Data kartu BPJS Anda belum terdaftar di rumah sakit ini. Silakan menuju Loket Pendaftaran untuk pendaftaran pertama kali." (`submitBookingKeyword` 484–487, `proceedToBookingConfirm` 574–578). Berlaku juga untuk `BPJS_FALLBACK` di walk-in (`selectWalkinGuarantee` 669–674, pesan inline sama). Catatan: pesan-kanonis `failureCode.ts:24` untuk kode ini berbeda ("Validasi BPJS gagal. Nomor kepesertaan tidak valid atau tidak aktif.") dan TIDAK yang tampil di jalur ini. |
| Referensi kosong (BPJS tapi tidak ada rujukan/SKDP aktif)                       | Error "Rujukan atau SKDP BPJS tidak aktif/tidak ditemukan. Silakan ambil antrian pendaftaran manual." → `FAILURE`.                                                                                                                                                                                                                                                                                                                                                                                                       |
| Diagnosa referensi hilang                                                       | `buildSepPayloadPolicy` melempar — "Diagnosa rujukan/SKDP BPJS tidak ditemukan. Hubungi petugas." Tidak ada fallback `Z00.0`.                                                                                                                                                                                                                                                                                                                                                                                            |
| Nomor peserta hilang                                                            | Error "Nomor kartu BPJS tidak ditemukan." → `FAILURE`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Jadwal penuh                                                                    | `SCHEDULE_FULL` — "Jadwal sudah penuh untuk hari ini. Silakan pilih tanggal lain atau hubungi petugas." (via `isSequenceExhausted`).                                                                                                                                                                                                                                                                                                                                                                                     |
| Duplikat registrasi                                                             | `DUPLICATE_REGISTRATION` — "Anda sudah terdaftar untuk antrian hari ini. Silakan cek status pendaftaran."                                                                                                                                                                                                                                                                                                                                                                                                                |
| Registrasi hari ini sudah ada (`todayRegistrations.length === 1`)               | Bukan pendaftaran baru — masuk `REGISTRATION_REPRINT` (lihat section 6). **Catatan:** bila `todayRegistrations.length > 1` di `confirmPatientContext` (647–654), kode TIDAK set FAILURE — jatuh terus ke `WALKIN_SELECT_GUARANTEE`. Ini beda dengan aturan RG-kanonis `> 1 → FAILURE` (539–542); tandai kandidat perbaikan kode (seharusnya FAILURE multi-registrasi).                                                                                                                                                   |
| Biometrik gagal/timeout                                                         | Pesan-aktual-inline: "Verifikasi biometrik gagal." (`BIOMETRIC_FAILED`, 796/872) / "Verifikasi biometrik melewati batas waktu." (`BIOMETRIC_TIMEOUT`, 794/870) → `FAILURE` → assistance. (Pesan-kanonis `failureCode.ts:22-23` berbeda dan tidak tampil di jalur ini.)                                                                                                                                                                                                                                                   |
| Backend tidak terjangkau                                                        | `BACKEND_ERROR` — "Terjadi kesalahan pada sistem. Silakan coba lagi dalam beberapa saat."                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Pasien belum terdaftar                                                          | `PATIENT_NOT_REGISTERED` — pesan-kanonis "Pasien yang dicari belum terdata di rumah sakit. Silakan ambil antrian pendaftaran atau hubungi petugas." (satu-satunya jalur yang memakai `getFailureMessage`).                                                                                                                                                                                                                                                                                                               |

Catatan: `BOOKING_NOT_FOUND` ada di enum (`failureCode.ts:7`) tetapi tidak pernah di-emit via `setFailure` di kode kini — hanya dipakai sebagai pengecualian di `confirmAssistance` (1140–1142) untuk memaksa jalur `intake` alih-alih `bookingAssistance`.

Sumber `noPeserta` jalur failure di atas: booking selalu dari `coverageInfo.noPeserta` → cocok ke `listPolis`; walk-in selalu dari `policy.noPolis` yang diklik → `walkinNoPeserta`; `BPJS_FALLBACK` (`noPeserta` null) langsung failure; tidak ada kolom ketik nomor peserta di UI mana pun.

Semua pesan user berbahasa Indonesia.

---

## 5. BPJS/SEP-SKDP ringkas

Sumber detail: `docs/architecture/KIOSK-SEP-SKDP-ARCHITECTURE.md` (TD-001–TD-010). Di bawah ini hanya ringkasan; jangan menduplikasi arsitektur itu.

| Aspek                                  | Rujukan                                                                                                                                                                                                                         | SKDP (kontrol/kunjungan ulang)                      |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Nomor ke Jetli `NoRujukan`             | `Rujukan.NoRujukan`                                                                                                                                                                                                             | `NoSkdp` terpilih                                   |
| Bilreg lokal `rujukanId`               | hasil mapping `GET Rujukan/ppk/{ppkId}`                                                                                                                                                                                         | string kosong                                       |
| Bilreg `caraMasukDkId`                 | hasil mapping Bilreg                                                                                                                                                                                                            | `8` (`DATANG SENDIRI`)                              |
| `tujuanKunjunganId`                    | `0` (rawat jalan normal)                                                                                                                                                                                                        | `2`                                                 |
| `assesmentPelayananId`                 | kosong                                                                                                                                                                                                                          | `5`                                                 |
| `faskesPerujukId` (payload SEP)        | `undefined` / dihilangkan (rujukan) — `buildSepPayloadPolicy` 229 mengeset `faskesPerujukId: isSkdp ? '' : undefined`                                                                                                           | `''` (string kosong)                                |
| `FaskesId` Jetli sebagai kunci mapping | Ya — `FaskesPerujuk.FaskesId` disimpan di `BpjsReference.faskesPerujukId` lalu dipakai sebagai `ppkId` untuk lookup `GET Rujukan/ppk/{ppkId}` → `rujukanId` + `caraMasukDkId` lokal (`prepareBilregRegistrationData` 1002–1007) | Tidak dipakai — SKDP melewati lookup PPK sepenuhnya |
| Diagnosa                               | dari rujukan Jetli                                                                                                                                                                                                              | dari SKDP Jetli (wajib, tanpa fallback)             |

Pointer TD: TD-001 otoritas kontrak = sumber Jetli; TD-002 diskriminator `type`; TD-003 resolusi Bilreg sebelum registrasi; TD-004 pisahkan referensi Jetli vs lokal; TD-005 payload SEP per-referensi; TD-006 SEP dibuat satu kali (tanpa retry otomatis); TD-007 recovery pasca-registrasi (`REGISTRATION_CREATED` → `SEP_CREATE_ATTEMPTED` → `SEP_CREATED` → `SEP_UPLOADED` → `ELIGIBILITY_RECORDED`, gagal → `ADMISI_FALLBACK`); TD-008 komposisi `sepDate` (`yyyy-MM-dd HH:mm:ss`, tanggal = business date, jam = clock kiosk); TD-009 validasi `sepDate` di batas kontrak client; TD-010 cakupan uji konformansi arah-request.

---

## 6. Reprint flow

Sumber: `useKioskRegistration.ts` (`searchPatientContextFor` 511–556, `confirmPatientContext` 600–659, `reprintExistingRegistration`).

Dua pemicu masuk `REGISTRATION_REPRINT`:

1. **Keyword RG-kanonis:** input cocok `^RG\d{8}$` → `searchPatientContextFor` memfilter `registrations.items` dengan `registrationId === keyword` (termasuk `bestMatch` kind `Registration`) → tepat 1 → `getRegistrationPrintData(keyword)` → `REGISTRATION_REPRINT`. Nol → lanjut konfirmasi pasien; > 1 → `FAILURE`.
2. **Registrasi hari ini sudah ada:** `confirmPatientContext` memfilter `registrations.items` dengan `patientId` + `visitDate === businessDate` (plus re-query via `normalizePasienIdKeyword` bila item berjenis `Registration`) → `todayRegistrations.length === 1` → `getRegistrationPrintData(registrationId)` → `REGISTRATION_REPRINT`.

Di layar reprint, `reprintExistingRegistration()` mencetak ulang bukti registrasi (+ label bila tersedia) dari `registrationReprintData`. Dari `REGISTRATION_REPRINT` hanya bisa kembali ke `HOME`.

Catatan: `todayRegistrations.length > 1` di `confirmPatientContext` (647–654) tidak masuk reprint maupun FAILURE — jatuh ke `WALKIN_SELECT_GUARANTEE`; beda dengan aturan RG-kanonis `> 1 → FAILURE` (539–542). Tandai kandidat perbaikan kode (lihat section 4).

---

## 7. Assistance/intake fallback + enterAdmisiFallback

Sumber: `useKioskRegistration.ts` (`confirmAssistance` 1136–1168, `enterAdmisiFallback` 337–346), `KioskPage.vue` (285–322, 530–543, 607, 616, 643), `FailureStep.vue:196-209`.

- Jalur utama: `FAILURE` → `ASSISTANCE_QUEUE` via `confirmAssistance(servicePointId)`.
- Jalur manual: `FAILURE` → `HOME` via tombol "Kembali ke Beranda" (`FailureStep.vue:196-209` emit `back` → `onHome` → `registration.goHome()` 348–378). Jalur ini mem-bypass guard `canTransition` (`flow.ts`) karena `goHome()` mengeset `flow.value = 'HOME'` langsung — sah menurut kode kini, tetapi catat bahwa `FLOW_TRANSITIONS.FAILURE` hanya mencantumkan `ASSISTANCE_QUEUE`.
- Jika `mode === 'booking'` dan kode error bukan `BOOKING_NOT_FOUND`/`PATIENT_NOT_REGISTERED` → `POST v1/admission-queue/booking-assistance` (`bookingId`, `servicePointId`, `kioskId`, `userId`). Selain itu → `POST v1/admission-queue/intake` (`servicePointId`).
- Hasil tiket dicetak (`printQueueTicket` + nama service point + notice opsional) lalu tampil di `ASSISTANCE_QUEUE`.

### Automatic booking-failure fallback (sekali per FAILURE)

Sumber: `KioskPage.vue:285-322` (watcher), teks status `:619-623`.

- Syarat: `mode === 'booking'` (atau recovery pasca-registrasi `ADMISI_FALLBACK`) + ada `recommendedFallbackServicePointId` + belum dicoba pada FAILURE ini + tidak `submitting` + kode BUKAN `BOOKING_NOT_FOUND`/`PATIENT_NOT_REGISTERED`.
- Aksi: otomatis memanggil `confirmAssistance(fallbackServicePointId)` tepat sekali per FAILURE (`automaticFallbackAttempted` guard); selama berjalan tampil "Mengambil nomor antrian admisi…" (`KioskPage.vue:619-623`). Bila gagal (tetap di `FAILURE`), tandai `automaticFallbackFailed` agar pengguna memilih loket manual; flag di-reset tiap keluar dari `FAILURE`.
- Varian tampilan: bila tiket berasal dari fallback otomatis, `AssistanceQueueStep` memakai varian `admisiRedirect` ("Registrasi di Kiosk belum berhasil" + "Nomor Antrian Admisi").

### Batal saat pencarian pasien

Sumber: `KioskPage.vue:530-543`, `useKioskRegistration.ts:803-808`.

- Tombol "Batal" di layar `PATIENT_CONTEXT_SEARCH` (`patient-search-cancel`) → `onCancelPatientContext` → `cancelPatientContext()` (bersihkan `patientContextResult`/`selectedContextPatient`) → `goHome()`.

- **Post-registration recovery:** bila `register()` gagal setelah `registrationResult` terisi (SEP/upload/eligibility gagal termasuk pelanggaran kontrak `sepDate`), `enterAdmisiFallback()` mempertahankan `regId`, set `postRegistrationPhase = 'ADMISI_FALLBACK'`, dan menampilkan pesan: "Pendaftaran berhasil (`regId`), namun pemrosesan SEP belum selesai. Silakan menuju Loket Admisi untuk penyelesaian berkas." Tidak pernah membuat registrasi atau SEP kedua. Bila assistance diambil dari fase ini, tiket antrean membawa notice admisi (`buildAdmisiFallbackNotice(regId)`).

---

## 8. Timeout & goHome purge

Sumber: `apps/kiosk-web/src/lib/constants.ts:2`, `useKioskRegistration.ts` (`goHome` 348–378, `startIdleReset` 1211–1223), `KioskPage.vue:607,616,643`, `KioskHome.vue:227`.

Satu-satunya timer reset yang aktif adalah idle-reset 60 detik (`IDLE_RESET_MS`, `constants.ts:2`): tanpa aktivitas (`click`/`touchstart`/`keydown`) di luar `HOME` → `goHome()` (dicek tiap 1 detik, `useKioskRegistration.ts:1218-1223`).

Layar sukses/bantuan kembali manual — tidak ada auto-reset: `REGISTRATION_SUCCESS` via tombol "Selesai" (`RegistrationSuccessStep` → `finish` → `onHome`, `KioskPage.vue:616`), `REGISTRATION_REPRINT` via tombol selesai (`KioskPage.vue:607`), `ASSISTANCE_QUEUE` via tombol "Selesai" (`KioskPage.vue:643`).

Konstanta mati + kontradiksi (TODO selaraskan): `SUCCESS_RESET_MS` (10 detik) dan `ASSISTANCE_RESET_MS` (15 detik) di `constants.ts:3-4` tidak diimpor/dipakai di mana pun (hanya `IDLE_RESET_MS` yang diimpor); footer `KioskHome.vue:227` menulis "Layar bersih otomatis 30 detik" yang tidak cocok dengan 60 detik aktual. TODO: hapus/selaraskan konstanta mati dan teks footer ke perilaku kini (60 detik idle-reset, tanpa auto-reset sukses/bantuan).

`goHome()` membersihkan seluruh state sesi (tanpa terkecuali untuk pasien berikutnya): `flow → HOME`, `mode`, `businessDate`, `bookingKeyword`, `selectedBooking`, `bookingDetail`, `bookingEligibility`, `selectedPatient`, `walkinEligibility`, `walkinNoPeserta`, `selectedService`, `registrationResult`, `sepNo`, `assistanceTicket`, `assistanceServicePointId`, `assistanceNotice`, `errorContext`, `patientContextResult`, `selectedContextPatient`, `registrationReprintData`, `patientPolicies`, `biometricVerdict`, `bpjsReferences`, `selectedBpjsReference`, `postRegistrationPhase`, `submitting`. Sequence counter pencarian/biometrik dinaikkan untuk membatalkan respons basi.

---

## 9. Kontrak API esensial

Sumber: `KioskRegistrationDeps` (`useKioskRegistration.ts` 63–97), implementasi di `packages/api-client/src/his.ts`, skema di `packages/shared-types/src/index.ts`, detail skema di `docs/architecture/registrasi-langsung.md` §5. Catatan: `register` (`useKioskRegistration.ts:906`) membandingkan `eligibility?.tipeJaminanId !== '00000'` dengan literal, bukan konstanta `UMAT_TIPE_JAMINAN_ID` (`lib/eligibility.ts:3`); nilai sama, selaraskan saat menyentuh kode itu.

| Dep (`deps.*`)             | Endpoint                                                                                | Deskripsi                                                                                                                                                                    |
| -------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getBusinessDate`          | `GET system/business-date`                                                              | Tanggal bisnis HIS (dasar semua pencarian)                                                                                                                                   |
| `searchBooking`            | `GET Booking/search/{tglBerobat}/{keyword}`                                             | Pencarian booking prioritas pertama                                                                                                                                          |
| `getBookingDetail`         | `GET Booking/{bookingId}`                                                               | Detail booking untuk konfirmasi                                                                                                                                              |
| `searchPatientContext`     | `POST v1/admisi-rajal/patient-context-search`                                           | Pencarian terpadu pasien/booking/registrasi (`{keyword, businessDate}`)                                                                                                      |
| `deepSearchPasien`         | deep-search pasien (internal)                                                           | Fallback keyword non-RG                                                                                                                                                      |
| `listPolis`                | `GET polis/list/{pasienId}`                                                             | Daftar polis/jaminan pasien                                                                                                                                                  |
| `getGroupJaminanMap`       | `GET grupJaminan/map?tipeJaminanId=`                                                    | Penentu `needsEligibility`                                                                                                                                                   |
| `listKarcis`               | `GET Karcis/{layananId}/list`                                                           | Karcis retribusi per layanan (dipilih via mapping app-config)                                                                                                                |
| `getRujukanSkpd`           | `GET Sep/rujukan/{noPeserta}/peserta` (Jetli)                                           | Rujukan + SKDP aktif peserta                                                                                                                                                 |
| `getRujukanByPpk`          | `GET Rujukan/ppk/{ppkId}`                                                               | Mapping PPK → `rujukanId` + `caraMasukDkId` lokal                                                                                                                            |
| `verifyBiometric`          | layanan biometrik lokal (`http://localhost:{port}/biometric`)                           | Verdict `SUCCESS`/`READY`/`TIMEOUT`/gagal                                                                                                                                    |
| layanan/dokter/jadwal      | `GET Layanan/2/list`, `GET JadwalPraktek/layanan/{poliId}`, `POST PraktekDokter/dokter` | Katalog walk-in (poli → dokter → jadwal)                                                                                                                                     |
| `registerBooking`          | `POST Reg/rajalByBooking/direct`                                                        | Registrasi by-booking (`{bookingId, userId, karcisId, caraMasukDkId, rujukanId, tipeJaminanId, pesertaJaminanId}`) → `{regId, noAntrian}`                                    |
| `registerWalkin`           | `POST Reg/rajalWalkIn/direct`                                                           | Registrasi walk-in (`{pasienId, userId, tipeJaminanId, caraMasukDkId, rujukanId, dokterId, layananId, jamPraktek HH:MM, karcisId, pesertaJaminanId}`) → `{regId, noAntrian}` |
| `createSep`                | `POST Sep` (Jetli)                                                                      | Buat SEP satu kali (`sepDate: yyyy-MM-dd HH:mm:ss`) → `{sepId, sepNo}`                                                                                                       |
| `uploadSep`                | `PATCH Sep/upload` (Jetli)                                                              | Kaitkan `{sepId, regId}` (maks 3x)                                                                                                                                           |
| `setDataEligibility`       | `PATCH Reg/setDataEligibility`                                                          | Simpan `{regId, sjpNo, pesertaJaminanId, sjpId}` (maks 3x)                                                                                                                   |
| `getRegistrationPrintData` | lookup data cetak registrasi                                                            | Data reprint (`{regId, noAntrian, ...}`)                                                                                                                                     |
| `bookingAssistance`        | `POST v1/admission-queue/booking-assistance`                                            | Tiket bantuan booking                                                                                                                                                        |
| `intake`                   | `POST v1/admission-queue/intake`                                                        | Tiket antrean admisi                                                                                                                                                         |
| cetak                      | `printRegistration` / `printLabel` / `printQueueTicket` (print proxy lokal)             | Cetak bukti registrasi, label, tiket antrean                                                                                                                                 |

Skema Zod penuh: `registrasi-langsung.md` §5 (patient-context, walk-in, by-booking, SEP, eligibility).

---

## 10. Status dokumen & histori

Sumber: folder `docs/architecture/`, `docs/archive/`.

- Dokumen ini adalah **acuan CURRENT** untuk alur kiosk self-registration. Bila bertentangan dengan dokumen lama, dokumen ini yang berlaku.
- `gap-analysis-self-registration.md` → **tertutup/dihapus**: payload booking & walk-in kini sudah lengkap (`karcisId`, `caraMasukDkId`, `rujukanId`, `jamPraktek` otomatis di `registerBookingCommit`/`registerWalkinCommit`); tidak ada gap terbuka yang tersisa dari matriksnya.
- `2026-08-03-kiosk-self-registration.md` → **arsip** (`docs/archive/architecture/`): kerangka cascade/diagramnya masih berguna sebagai konteks, tetapi state machine (§5), urutan SEP (§2.3–2.4: SEP sebelum registrasi), dan payload (§4.3–4.4) di dokumen itu sudah basi dan digantikan section 2/3/9 di sini.
- `post-deploy-config-pattern.md` → **dihapus** (duplikat dari `post-deploy-config-pattern-monorepo.md` yang tetap ada).
- Detail integrasi BPJS/SEP-SKDP tinggal di `docs/architecture/KIOSK-SEP-SKDP-ARCHITECTURE.md` (TD-001–TD-010); dokumen ini hanya merujuk, tidak menyalin.
- Kontrak registrasi-langsung (officer) tetap di `docs/architecture/registrasi-langsung.md` sebagai skema rujukan section 9.
