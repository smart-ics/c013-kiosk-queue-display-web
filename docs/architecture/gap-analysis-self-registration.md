# Analisis Gap: Kiosk Self Registration vs Registrasi Langsung HIS (Battle-Tested)

Dokumen ini menganalisis perbedaan (gap) antara implementasi **Kiosk Self Registration** (`kiosk-web`) dengan spesifikasi API **Registrasi Langsung Tanpa Antrean** (`registrasi-langsung.md`) yang sudah teruji operasional (*battle-tested*) pada sistem SIMRS. 

Analisis ini bertujuan untuk mengidentifikasi kolom data (fields) yang kurang, perbedaan perilaku sistem, serta strategi otomatisasi agar Kiosk dapat mendaftarkan pasien secara sukses tanpa intervensi manual petugas.

---

## 1. Perbedaan Peran & Filosofi Input (Actor Perspective)

| Aspek | Registrasi Langsung HIS (Officer Client) | Kiosk Self Registration (Patient Client) |
| :--- | :--- | :--- |
| **Aktor** | Petugas Admisi Profesional (Officer). | Pasien / Keluarga Pasien secara Mandiri. |
| **Toleransi Input**| Tinggi. Petugas dapat memilih kode klinis, retribusi, dan klasifikasi BPJS secara manual. | Sangat Rendah. Semua input administratif dan klinis harus diotomatiskan (zero-typing). |
| **Verifikasi** | Petugas memvalidasi fisik kartu BPJS/KTP dan rujukan kertas. | Verifikasi digital via scan barcode/QR code dan verifikasi sidik jari local service (`/biometrik`). |

---

## 2. Gap Payload API & Strategi Otomatisasi (Payload Mapping Gap)

### Gap A: Registrasi dari Booking (`/reg/rajalByBooking/direct`)

API Registrasi Langsung membutuhkan 7 parameter wajib, sedangkan Kiosk saat ini hanya mengirimkan 5 parameter.

#### Perbandingan Payload:

```typescript
// SPESIFIKASI BATTLE-TESTED (registrasi-langsung.md)
const payloadDirectRegisterRajalByBookingSchema = z.object({
  bookingId: z.string(),
  userId: z.string(),
  karcisId: z.string(),
  caraMasukDkId: z.string(),
  rujukanId: z.string(),
  tipeJaminanId: z.string(),
  pesertaJaminanId: z.string(),
})

// IMPLEMENTASI KIOSK SAAT INI (useKioskRegistration.ts)
type BookingRegContext = {
  bookingId: string
  pasienId: string
  tipeJaminanId: string
  noPeserta: string | null
  userId: string
}
```

#### Analisis Gap & Mitigasi Kiosk:
1. **`karcisId` (Hilang di Kiosk)**: 
   * *Masalah*: Kiosk tidak memuat karcis retribusi.
   * *Solusi/Otomatisasi*: Kiosk harus memanggil `GET /Karcis/{layananId}/list` di latar belakang setelah detail booking dimuat, lalu memilih karcis pertama yang aktif (atau default karcis pendaftaran booking rawat jalan).
2. **`caraMasukDkId` (Hilang di Kiosk)**:
   * *Masalah*: Cara masuk menentukan statistik pelaporan rumah sakit.
   * *Solusi/Otomatisasi*: Jika penjamin adalah BPJS, set otomatis ke `'00002'` (Rujukan). Jika penjamin adalah Non-BPJS/Umum, set otomatis ke `'00001'` (Datang Sendiri).
3. **`rujukanId` (Hilang di Kiosk)**:
   * *Masalah*: Diperlukan untuk mengaitkan berkas rujukan jika penjamin BPJS.
   * *Solusi/Otomatisasi*: Ambil nilai dari field `detailBooking.extAppRef.reffId` atau data rujukan BPJS yang cocok dari Jetli API.
4. **`pesertaJaminanId`**:
   * *Solusi*: Map field `noPeserta` dari Kiosk ke `pesertaJaminanId` di API HIS.

---

### Gap B: Registrasi Walk-In / Go-Show (`/reg/rajalWalkIn/direct`)

API Registrasi Langsung Walk-In membutuhkan parameter retribusi dan cara masuk yang tidak dimiliki oleh Kiosk.

#### Perbandingan Payload:

```typescript
// SPESIFIKASI BATTLE-TESTED (registrasi-langsung.md)
const payloadDirectRegisterRajalWalkInSchema = z.object({
  pasienId: z.string(),
  userId: z.string(),
  tipeJaminanId: z.string(),
  caraMasukDkId: z.string(),
  rujukanId: z.string(),
  dokterId: z.string(),
  layananId: z.string(),
  jamPraktek: z.string(), // Format HH:MM
  karcisId: z.string(),
  pesertaJaminanId: z.string(),
})

// IMPLEMENTASI KIOSK SAAT INI (useKioskRegistration.ts)
type WalkinRegContext = {
  pasienId: string
  poliId: string
  ppaId: string
  jadwalId: string
  tglBerobat: string
  tipeJaminanId: string
  noPeserta: string | null
  userId: string
}
```

#### Analisis Gap & Mitigasi Kiosk:
1. **`layananId` & `dokterId`**:
   * *Solusi*: Map `poliId` dari Kiosk ke `layananId`, dan `ppaId` ke `dokterId`.
2. **`jamPraktek` (Hilang di Kiosk)**:
   * *Masalah*: API membutuhkan string jam praktek berformat `HH:MM`, sedangkan Kiosk hanya menyimpan `jadwalId`.
   * *Solusi/Otomatisasi*: Kiosk harus memetakan `jamPraktek` yang diperoleh dari response endpoint katalog `GET /api/Dokter/jadwal` yang dipilih oleh pasien saat wizard layanan.
3. **`karcisId` (Hilang di Kiosk)**:
   * *Solusi/Otomatisasi*: Kiosk mengambil data karcis secara otomatis via `GET /Karcis/{layananId}/list` dan memilih karcis pertama yang terdaftar untuk layanan poliklinik terpilih.
4. **`caraMasukDkId` & `rujukanId` (Hilang di Kiosk)**:
   * *Solusi/Otomatisasi*:
     * Untuk **BPJS Walk-In**: `caraMasukDkId` diset `'00002'` (Rujukan), dan `rujukanId` diisi dengan nomor rujukan BPJS yang dipilih pasien pada layar picker rujukan/SKDP.
     * Untuk **Umum / Non-BPJS Walk-In**: `caraMasukDkId` diset `'00001'` (Datang Sendiri), dan `rujukanId` dikosongkan (`""`).

---

## 3. Gap Penerbitan SEP BPJS (`/Sep`)

Penerbitan SEP di SIMRS melibatkan form eligibilitas yang sangat rumit. Di Kiosk, proses ini harus berjalan 100% di latar belakang (background process) saat pasien mengonfirmasi data.

### Perbandingan Kebutuhan Data SEP:

| Field SEP (`payloadCreateSepSchema`) | Sumber Pengisian Otomatis oleh Kiosk |
| :--- | :--- |
| `noPeserta` | Diambil dari data polis aktif (`GET /polis/list/{pasienId}`). |
| `noRujukan` | Diambil dari rujukan BPJS terpilih (`GET /SEP/rujukan/{noPeserta}/peserta`). |
| `sepDate` | Menggunakan tanggal bisnis aktif (`GET /api/system/business-date`). |
| `pasienId` | Diambil dari data identitas terkonfirmasi (`selectedPatient.pasienId`). |
| `kelasRawatId` | Diekstrak secara otomatis dari field kelas hak peserta pada data rujukan BPJS. |
| `diagnosaId` | Diekstrak dari kode diagnosa utama (ICD-10) rujukan BPJS terpilih. |
| `tujuanKunjunganId` | Diset default `'0'` (Rujukan Normal Rawat Jalan). |
| `flagProcedureId` | Diset default `""` (Kosong). |
| `assesmentPelayananId` | Diset default `""` (Kosong). |
| `penunjangId` | Diset default `""` (Kosong). |
| `katarak` | Diset default `'0'` (Tidak). |
| `kll` | Diset default `'0'` (Bukan Kasus Kecelakaan Lalu Lintas). |
| `catatan` | Diset otomatis `'Cetak Mandiri Kiosk'` untuk mempermudah audit klaim. |
| `userId` | Menggunakan konstanta `'hidokkiosk'`. |

---

## 4. Matriks Tindak Lanjut Sinkronisasi Kode Kiosk

Untuk menutup seluruh celah (gap) integrasi di atas, perubahan berikut perlu diimplementasikan pada client `kiosk-web`:

```diff
// Ilustrasi penyesuaian payload registrasi di apps/kiosk-web/src/composables/useKioskRegistration.ts

  async function registerBookingCommit(): Promise<ReturnCreateWalkIn> {
    const detail = bookingDetail.value
    if (!detail) throw new Error('Booking detail missing')
+
+   // 1. Ambil daftar karcis rawat jalan untuk poliklinik terkait
+   const karcisList = await deps.listKarcis(detail.layanan.layananId)
+   const defaultKarcisId = karcisList[0]?.id ?? ""
+
+   // 2. Tentukan cara masuk berdasarkan tipe jaminan
+   const isBpjs = bookingEligibility.value?.tipeJaminanId !== '00000'
+   const caraMasukId = isBpjs ? '00002' : '00001' // 00002 = Rujukan, 00001 = Datang Sendiri

    return deps.registerBooking({
      bookingId: detail.bookingId,
      pasienId: detail.reg.pasienId,
      tipeJaminanId: bookingEligibility.value?.tipeJaminanId ?? '00000',
      noPeserta: bookingEligibility.value?.noPeserta ?? null,
      userId: KIOSK_USER_ID,
+     // Bridging parameter gap ke API HIS Battle-Tested
+     karcisId: defaultKarcisId,
+     caraMasukDkId: caraMasukId,
+     rujukanId: detail.extAppRef?.reffId ?? "",
+     pesertaJaminanId: bookingEligibility.value?.noPeserta ?? ""
    })
  }
```

### Kesimpulan:
Meskipun Kiosk menyederhanakan antarmuka pengguna agar ramah bagi pasien awam, di sisi integrasi API, Kiosk **tetap wajib mematuhi kontrak parameter Registrasi Langsung HIS secara penuh**. Otomatisasi pengisian parameter administratif (`karcisId`, `caraMasukDkId`, `diagnosaId`, dll.) di tingkat *composable client* (`useKioskRegistration.ts`) adalah kunci utama agar transaksi Kiosk tidak ditolak oleh server HIS.
