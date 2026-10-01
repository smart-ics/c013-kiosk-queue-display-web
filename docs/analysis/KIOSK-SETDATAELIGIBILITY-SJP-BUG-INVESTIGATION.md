---
Title: Kiosk setDataEligibility uses SEP-create identity instead of SEP-upload identity
Code: KIOSK-SETDATAELIGIBILITY-SJP
Artifact: BUG-INVESTIGATION
Version: 1.2
LastUpdated: 2026-09-29
Status: INVESTIGATION-COMPLETE
Issue: BILREG-SETDATAELIGIBILITY-SJP-ISSUE-001 (cross-repo source; c013-side ISSUE requested from Issue Intake)
NextStage: ARCHITECTURE
---

# BUG-INVESTIGATION

## Context

Issue: `b09-bilreg-api/docs/issues/BILREG-SETDATAELIGIBILITY-SJP-ISSUE.md` (ID: BILREG-SETDATAELIGIBILITY-SJP-ISSUE-001, Type: BUG) — used as cross-repo source. No c013-side ISSUE exists yet; its creation has been requested from Issue Intake (see OQ-03).

Problem Summary: Pada alur kiosk BPJS, `PATCH Reg/setDataEligibility` terkirim dengan `sjpNo: "-"` untuk `regId` `RG01378150`, padahal langkah `upload` tepat sebelumnya mengembalikan nomor SEP sebenarnya (`0301R0010323V378150`). Identitas yang dikirim ke eligibility bersumber dari hasil create (yang dapat membawa placeholder), bukan dari hasil upload (yang membawa nomor sebenarnya dan nilainya dibuang).

Scope: investigasi ini hanya mencakup masalah 1 (sumber identitas eligibility di sisi kiosk). Truncation `TA_REGISTRASI.fs_kd_trs_sjp` dan seluruh masalah persistensi di `b09-bilreg-api` secara eksplisit di luar scope atas keputusan pemilik.

## Current State

Perilaku teramati pada orkestrasi kiosk saat ini:

- Urutan post-registration adalah create SEP → upload SEP → `setDataEligibility`, dan langkah eligibility memakai identitas dari **hasil create**, sedangkan nilai balik upload tidak dipakai untuk eligibility.
- Kontrak respons create secara eksplisit mengizinkan `sepNo: "-"` (placeholder); kontrak respons upload membawa nomor SEP sebenarnya beserta `sepId` dan `regId`.
- Contoh yang dilaporkan: create menghasilkan identifier `01KG9ANDMD21M21PA07V4ZA3SJ` dengan nomor placeholder `"-"`; upload untuk pasangan identifier–registrasi yang sama mengembalikan `sepNo: "0301R0010323V378150"`; namun payload eligibility yang terkirim membawa `sjpNo: "-"` dengan `sjpId` dari hasil create.
- Validasi kontrak klien untuk payload eligibility mengizinkan `sjpNo` sepanjang minimal 1 karakter, sehingga `"-"` lolos dan terkirim ke Bilreg.
- Mekanisme retry post-registration mengulang pemanggilan dengan nilai yang sama hingga tiga kali, sehingga pengulangan tidak dapat memperbaiki nilai yang salah sumber.

## Problem Analysis

- F-01 — Salah sumber identitas. Bukti: payload eligibility (`sjpNo: "-"`, `sjpId` = identifier hasil create) vs hasil upload (`sepNo` sebenarnya) untuk `regId` yang sama; nilai balik upload tidak mengalir ke langkah eligibility. Ini kegagalan handoff antar-langkah dalam orkestrasi kiosk, bukan kegagalan layanan hilir.
- F-02 — Placeholder create adalah perilaku kontrak yang valid, bukan anomali provider. Bukti: skema kontrak create menerima pasangan identifier–`sepNo: "-"` sebagai respons sah. Selama eligibility memakai sumber create, setiap create ber-placeholder akan menghasilkan payload `"-"` meskipun upload kemudian berhasil.
- F-03 — Hasil upload dibuang. Bukti: langkah upload dieksekusi dan hasilnya hanya dipakai untuk menentukan lanjut/tidaknya alur (sukses vs string error), bukan sebagai sumber identitas eligibility. Nomor SEP sebenarnya yang sudah ada di tangan kiosk tidak pernah dipakai.
- F-04 — Retry tidak dapat menyembuhkan. Bukti: batas tiga percobaan memakai ulang identitas dari hasil create yang sama; tidak ada percobaan yang membaca ulang atau memakai hasil upload, sehingga ketiga percobaan mengulang nilai yang sama salahnya.
- F-05 — Validasi klien tidak mencegah. Bukti: skema payload eligibility mensyaratkan `sjpNo` minimal 1 karakter tanpa menolak placeholder, sehingga tidak ada penghalang sebelum request terkirim.

## Affected Components

- Orkestrasi registrasi kiosk (siklus post-registration: create → upload → eligibility dan pilihan sumber identitasnya).
- Langkah upload SEP sebagai produsen identitas yang keluarannya tidak dipakai.
- Langkah perekaman eligibility sebagai konsumen sumber yang salah.
- Kontrak klien bersama untuk respons create vs respons upload dan untuk payload eligibility.

## Impact Assessment

- Dampak bisnis: nomor SEP yang sudah diterbitkan dan di-upload tidak tercatat pada registrasi; data eligibility mengandung placeholder `"-"` sehingga berkas penjaminan tidak lengkap di sisi kiosk.
- Dampak operasional: pasien terdaftar tetapi pemrosesan SEP dianggap belum selesai; admisi harus menyelesaikan berkas secara manual; setiap pengulangan alur dengan perilaku yang sama menghasilkan placeholder yang sama.
- Dampak teknis: request eligibility terkirim dan dapat diterima hilir tanpa error validasi (karena `"-"` lolos skema), sehingga kegagalan bersifat diam-diam (silent wrong value) dan tidak memicu jalur fallback yang dirancang untuk kegagalan eksplisit.

## Assumptions

- ASM-01: Payload, hasil upload, dan identifier yang dikutip di ISSUE sumber adalah salinan akurat dari kejadian operasional yang dilaporkan.
- ASM-02: Respons create dengan `sepNo: "-"` adalah perilaku provider yang sah (didukung skema kontrak), bukan data rusak.
- ASM-03: Belum ada c013-side ISSUE; ISSUE `b09` dipakai sebagai sumber lintas-repo dan pembuatan ISSUE sisi kiosk dimintakan ke Issue Intake.
- ASM-04: Scope dibatasi pada masalah 1 atas keputusan pemilik; tidak ada temuan atau keputusan dalam artefak ini yang mencakup persistensi `b09`.
- ASM-05: Kode `c013` yang diperiksa diasumsikan mewakili deploy yang berjalan saat kejadian `RG01378150`; konfirmasi runtime yang sebenarnya diserahkan ke tahap pengujian/deployment, bukan investigasi ini.

## Open Questions

- OQ-01: CLOSED — Hasil upload adalah sumber otoritatif `sepNo` yang valid. Jika upload error atau tidak mengembalikan `sepNo`, alur masuk fallback antrian admisi (registrasi yang sudah ada dipertahankan, tanpa registrasi/SEP kedua).
  - Decision: identitas eligibility hanya diambil dari hasil upload yang valid; ketiadaan `sepNo` valid adalah kondisi fallback, bukan kondisi untuk memakai identitas create.
  - Rationale: dikonfirmasi pemilik bahwa nomor valid hanya tersedia pada hasil upload; memakai identitas create saat upload gagal akan mengulang cacat yang sama (placeholder atau identitas tak terikat registrasi).
  - Impact: aturan pemilihan sumber menjadi deterministik; kasus upload-gagal memiliki perilaku baku (admisi fallback) yang konsisten dengan kebijakan pemulihan post-registration yang sudah ada.
  - Architecture Impact: arsitektur perlu meresmikan cabang upload-tanpa-`sepNo` sebagai pemicu fallback, tanpa meredefinisi mekanisme fallback yang sudah ada.
  - Resolved By: pemilik bisnis (konfirmasi 2026-09-29). Resolved Date: 2026-09-29.
- OQ-02: CLOSED — Placeholder (`"-"`) ditolak sebagai data eligibility; perilakunya adalah fallback admisi.
  - Decision: nilai placeholder tidak dikirim ke eligibility; kemunculannya mengarahkan alur ke fallback admisi dengan registrasi yang sudah ada.
  - Rationale: dikonfirmasi pemilik; placeholder bukan nomor SEP dan pengirimannya menghasilkan data salah yang diam-diam (silent wrong value) yang justru menghindari jalur pemulihan yang dirancang untuk kegagalan eksplisit.
  - Impact: tidak ada lagi eligibility ber-placeholder yang tercatat dari kiosk; kasus placeholder tertangani sebagai kegagalan eksplisit yang terlihat operator.
  - Architecture Impact: arsitektur perlu menempatkan penolakan placeholder di batas kontrak/orkestrasi dan mengikatnya ke perilaku fallback yang sudah ada.
  - Resolved By: pemilik bisnis (konfirmasi 2026-09-29). Resolved Date: 2026-09-29.
- OQ-03: PERMINTAAN ADMINISTRATIF, bukan pertanyaan investigasi — (Untuk Issue Intake) Mohon terbitkan c013-side ISSUE untuk masalah ini dan tentukan relasinya terhadap ISSUE `b09` sumber (tetap terpisah, karena scope persistensi `b09` dikeluarkan). Dicatat di sini agar tidak hilang; tidak memblokir arsitektur.
- OQ-04: INFORMASI, bukan pertanyaan — lingkungan, versi deploy kiosk, dan waktu kejadian `RG01378150` berguna sebagai konteks keyakinan, tetapi tidak mengubah temuan atau keputusan (mekanisme cacat terbukti dari kode dan kontrak). Dilipat menjadi ASM-05; verifikasi runtime diserahkan ke pengujian/deployment. Tidak memblokir arsitektur.

## Recommended Decision

- Identitas yang direkam ke eligibility harus bersumber dari hasil upload, bukan dari hasil create.
- Nilai placeholder dari hasil create tidak boleh diterima sebagai data eligibility yang valid.
- Alternatif yang dipertimbangkan: (a) memakai hasil upload sebagai sumber; (b) mempertahankan sumber create. Alternatif (b) ditolak karena bukti menunjukkan sumber create dapat membawa placeholder sementara nomor sebenarnya sudah tersedia dari upload dan dibuang.

## Decision

Arah koreksi yang dipilih: jadikan identitas hasil upload sebagai satu-satunya sumber otoritatif untuk perekaman eligibility, dan perlakukan nilai placeholder hasil create sebagai nilai yang tidak layak kirim ke eligibility. Jika upload error atau tidak mengembalikan `sepNo` yang valid — termasuk kemunculan placeholder — alur masuk fallback antrian admisi dengan registrasi yang sudah ada dipertahankan.

## Decision Rationale

- Temuan F-01–F-03 menunjukkan nomor SEP yang benar sudah ada di tangan kiosk (dari upload) tetapi tidak dipakai; memperbaiki sumber menutup cacat tanpa bergantung pada perubahan layanan mana pun.
- Alternatif mempertahankan sumber create (b) ditolak karena F-02 membuktikan placeholder adalah keluaran kontrak yang sah, sehingga cacat akan berulang setiap kali provider mengembalikan placeholder — retry (F-04) dan validasi saat ini (F-05) tidak dapat mencegahnya.
- Keputusan ini tidak menyentuh persistensi `b09`, tidak mengubah kontrak layanan Jetli/Bilreg, dan tidak menambah langkah alur; ia hanya menetapkan asal data yang benar di dalam orkestrasi yang sudah ada.
- Penolakan placeholder diikat ke fallback admisi (bukan blokir lokal diam-diam) agar kegagalan menjadi eksplisit, terlihat operator, dan konsisten dengan kebijakan pemulihan post-registration yang sudah berlaku (registrasi dipertahankan, tanpa duplikasi).
- Detail realisasi (batas validasi, klasifikasi error, status orkestrasi) milik ARCHITECTURE; investigasi ini hanya menetapkan arah WHAT.

## Architecture Applicability

### Decision

ARCHITECTURE-REQUIRED

### Rationale

Koreksi mengubah aliran data orkestrasi (keluaran langkah mana yang menjadi masukan eligibility) dan batas kontrak (placeholder create vs otoritas upload) yang saat ini diresmikan dalam desain integrasi arsitektur SEP kiosk; tanpa pembaruan arsitektur, desain dan implementasi akan menyimpang. Tidak ada perubahan skema database atau layanan hilir yang diputuskan di sini.
