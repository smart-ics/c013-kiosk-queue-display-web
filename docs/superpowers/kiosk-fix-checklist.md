# Kiosk-Web Fix Checklist (severity utama)

Sumber analisa: audit `apps/kiosk-web/src` — marker `TODO/FIXME` nol, temuan berupa
kode mati / UI placeholder / wiring putus. Acuan verifikasi tiap item:
`pnpm --filter kiosk-web test` + `pnpm --filter kiosk-web run typecheck`.

> Catatan histori: file ini sempat tertimpa catatan `npx vitest --ui` oleh commit
> `e6a5f5a`. Isi asli checklist dipulihkan dari `4373dbb` pada commit ini, lalu
> item yang sudah terbukti selesai ditandai `[x]` beserta bukti commit-nya.

## P0 — User bisa stuck (wajib dulu)

- [x] **P0-1. `PATIENT_CONTEXT_SEARCH` tanpa jalan keluar**
  - Status: **DONE** — `364bdd3` (enter `PATIENT_CONTEXT_SEARCH` explicitly during
    patient search), `c9bd181` (cancellable patient search + stale-result guard),
    `fb69c0e` (guard booking branch against late results after cancel).
  - `src/views/KioskPage.vue:525-528` — panel statis `Mencari data pasien…`, tanpa Batal/timeout/error.
  - Root cause: tidak ada `transition('PATIENT_CONTEXT_SEARCH')` di
    `src/composables/useKioskRegistration.ts` (panel tidak pernah tampil);
    state loading hanya `submitting=true`, dan hasil async yang telat tetap
    men-transition meski user sudah `goHome()`.
  - Fix: transition ke `PATIENT_CONTEXT_SEARCH` saat search dimulai + tombol Batal
    (`registration.cancelPatientContext()`) + token invalidasi hasil telat di
    `searchPatientContextFor`/`submitBookingKeyword` + edge
    `PATIENT_CONTEXT_SEARCH → BOOKING_CONFIRM` di `src/lib/flow.ts`.
  - Test: Batal kembali ke `HOME`; hasil telat diabaikan; booking-ditemukan dari
    SEARCH → `BOOKING_CONFIRM`.
  - Branch: `fix/kiosk-p0-stuck-flows` · Plan: `docs/superpowers/plans/2026-09-24-kiosk-p0-stuck-flows.md`
- [x] **P0-2. `BiometricStep` placeholder, error tak pernah tampil**
  - Status: **DONE** — `bf82cbe` (interactive biometric pending UI with Batal),
    `5c16174` (ignore late biometric verdict after home). Routing `FAILURE`
    dipertahankan.
  - `src/views/steps/BiometricStep.vue:1-11` — hanya teks `pending`, tanpa emit
    retry/back; `KioskPage.vue:549-553` selalu `:error-message="null"`.
  - Root cause: gagal biometrik langsung `setFailure()` → `FAILURE`, step tidak
    pernah menampilkan konteks; user juga bisa `goHome()` saat `verify()` in-flight
    lalu hasil telat me-yank flow (`transition` ilegal → `BACKEND_ERROR`).
  - Fix: UI pending proper (spinner + instruksi + Batal → `onHome`) dengan
    `data-testid="biometric-pending|biometric-back"`; token guard di
    `runBiometric`/`runBiometricForWalkin`; routing FAILURE dipertahankan
    (test + auto-fallback bergantung padanya).
  - Test: Batal saat verify in-flight → tetap `HOME`, hasil telat diabaikan;
    test `BIOMETRIC_TIMEOUT → FAILURE` yang ada tetap hijau.

## P1 — Alur salah / ganda

- [ ] **P1-1. Dual print/intake hidup berdampingan — butuh keputusan**
  - Status: **OPEN** — belum ada keputusan A/B; jangan hapus sebelum diputuskan.
  - Lama: `useKioskIntake` + `useKioskPrint.printCommittedLabel`
    (`KioskPage.vue:120-145,178-182,351-385`) vs baru: `useKioskSelfPrint`.
  - Opsi A pertahankan dengan state terpisah jelas, atau opsi B migrasi grid intake
    ke `printQueueTicket` lalu hapus `useKioskPrint`. Jangan hapus sebelum diputuskan.
- [x] **P1-2. Prop `intakeAvailable` tidak di-wire (quick-win)**
  - Status: **DONE** — `e6a5f5a` (resolve P1-2 `intakeAvailable` prop, P2 stepper
    states and Zod parsing for BPJS references).
  - `src/views/KioskHome.vue:16,160-169` — tombol `Ambil Antrian Admisi` hanya
    `:disabled="pending"`, tetap bisa diklik saat `offerings` kosong.
  - Fix: `:disabled="pending || !intakeAvailable"` + update `KioskHome.spec.ts`.

## P2 — Inkonsistensi kecil

- [x] **P2-1. Stepper hilang di 2 state** — `KioskPage.vue:388-404` tidak mencakup
  `REGISTRATION_REPRINT` dan `FAILURE`.
  - Status: **DONE** — `e6a5f5a`.
- [x] **P2-2. Parsing BPJS pakai `as any`** —
  `useKioskRegistration.ts:162-171,570,586`. Fix: Zod schema di `lib/bpjsReference.ts` + test.
  - Status: **DONE** — `e6a5f5a`.

## P3 — Cleanup

- [x] **P3-1. `startBookingFlow()` dead code** - `useKioskRegistration.ts:272-277`
  tak dipanggil di `src/` (hanya di test). Hapus + migrasi spec ke flow asli.
  - Status: **DONE** - `e9cfc0e`. Fungsi dan export-nya dihapus; 60 call site di spec dibuang, test kini memakai entry point produksi (`submitBookingKeyword` langsung dari HOME).
  - Menyingkap satu test yang mengasumsikan `BOOKING_SEARCH` - state yang tidak terjangkau di produksi. Test idle-reset 60s sekarang naik ke `BOOKING_CONFIRM`; subjek yang diuji tidak berubah.
  - Verifikasi: 306 test kiosk-web hijau + typecheck bersih.

## Urutan eksekusi

`P0-1 → P0-2 → P1-2 → P1-1 (keputusan) → P2-1 + P2-2 → P3-1`

## Catatan tambahan

- @vitest/ui@3.2.7 ditambahkan sebagai devDependency di kiosk-web (commit e6a5f5a sebelumnya menimpa file ini dengan catatan ini; isi asli checklist dipulihkan dari 4373dbb).
