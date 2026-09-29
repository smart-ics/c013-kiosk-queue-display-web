# Kiosk Self Registration Rawat Jalan — Arsitektur & Spesifikasi Alur (Unified Search-First)

Dokumen ini mendokumentasikan spesifikasi arsitektur, alur kerja (workflow), integrasi API, dan perancangan UI/UX untuk fitur **Kiosk Self Registration Rawat Jalan** pada sistem Admission Queue.

Berbeda dengan alur pendaftaran mandiri tradisional yang memisahkan tombol masuk sejak awal, Kiosk ini menggunakan pendekatan **Unified Search-First**—menggunakan satu input pencarian tunggal di halaman utama yang secara otomatis bercabang ke alur pencarian booking maupun pencarian data pasien (walk-in) secara cerdas (cascade search).

---

## 1. Analisis Workflow & Cascade Search

Pendaftaran mandiri di Kiosk diorkestrasikan melalui satu kolom pencarian terpadu di halaman utama (`KioskHome.vue`). Alur pencarian didefinisikan sebagai berikut:

```mermaid
graph TD
    INPUT["Input Keyword dari Pasien<br/>Manual / Scan QR"] --> SEARCH_BOOK["Cari Booking dengan Tanggal Bisnis Aktif<br/>GET /api/Booking/search/:tglBerobat/:keyword"]
    
    SEARCH_BOOK -->|Ketemu| BOOK_FOUND["Booking Tunggal Ditemukan"]
    SEARCH_BOOK -->|Tidak Ketemu| SEARCH_PATIENT["Cari Konteks Pasien Walk-in<br/>POST /patient-context-search"]
    
    BOOK_FOUND --> BOOK_CONFIRM["Konfirmasi Detail Booking<br/>BOOKING_CONFIRM step"]
    
    SEARCH_PATIENT -->|Ketemu| PATIENT_FOUND["Pasien Ditemukan & Tampilkan Daftar<br/>PATIENT_CONTEXT_CONFIRM"]
    SEARCH_PATIENT -->|Tidak Ketemu| BOOK_ASSIST["Picu Booking Assistance<br/>Failure / SP Picker"]
    
    PATIENT_FOUND --> SELECT_GUARANTEE["Pilih Jaminan / Penjamin<br/>WALKIN_SELECT_GUARANTEE"]
    BOOK_ASSIST --> ASSIST_QUEUE["Ambil Antrian Bantuan<br/>ASSISTANCE_QUEUE"]
    
    BOOK_CONFIRM --> ELIGIBILITY["Verifikasi Jaminan & Biometrik BPJS<br/>Jika Diperlukan"]
    SELECT_GUARANTEE --> ELIGIBILITY
    
    ELIGIBILITY --> SELECT_SERVICE["Pilih Layanan Poli<br/>Poli -> Dr -> Jadwal"]
    SELECT_GUARANTEE -->|Umum / Non-BPJS| SELECT_SERVICE
    
    SELECT_SERVICE --> REG_DIRECT["POST Registrasi Direct ke API HIS<br/>/rajalWalkIn/direct"]
    BOOK_CONFIRM -->|Umum / Non-BPJS| REG_DIRECT_BOOK["POST Registrasi Direct ke API HIS<br/>/rajalByBooking/direct"]
    ELIGIBILITY --> REG_DIRECT_BOOK
    
    REG_DIRECT --> PRINT_RECEIPT["Cetak Bukti Registrasi Mandiri"]
    REG_DIRECT_BOOK --> PRINT_RECEIPT
```

### Detail Tahapan Cascade Search:

1. **Pencarian Booking (Prioritas Pertama)**:
   * Kiosk mengambil tanggal operasional aktif melalui `GET /api/system/business-date`.
   * Melakukan pencarian menggunakan keyword yang diinput (bisa berupa Kode Booking MJKN yang di-decode dari QR base64, nomor rujukan, NIK, atau MR).
   * Endpoint: `GET /api/Booking/search/{tglBerobat}/{keyword}`.
   * **Jika ditemukan tepat 1 booking**: Kiosk langsung mengalihkan pasien ke layar **Konfirmasi Booking** (`BOOKING_CONFIRM`).

2. **Pencarian Konteks Pasien (Prioritas Kedua / Fallback)**:
   * Jika pencarian booking mengembalikan hasil kosong (0 matches), sistem tidak langsung menampilkan error, melainkan melakukan fallback otomatis ke pencarian data pasien (untuk pendaftaran Walk-in / Go-show).
   * Endpoint: `POST /api/v1/admisi-rajal/patient-context-search` dengan payload keyword dan businessDate.
   * **Jika ditemukan pasien**: Sistem mengalihkan ke layar **Konfirmasi Pasien** (`PATIENT_CONTEXT_CONFIRM`) yang menampilkan informasi ringkas pasien beserta tombol konfirmasi untuk memulai pendaftaran langsung (Walk-in).
   * **Jika tidak ditemukan pasien**: Sistem langsung menganggap proses pencarian gagal dan masuk ke layar **Failure Step** (`FAILURE`) dengan kode error `BOOKING_NOT_FOUND`, di mana pasien ditawarkan untuk memilih Service Point loket pendaftaran manual.
   * **Pilihan Jaminan Terlebih Dahulu**: Setelah mengonfirmasi pasien, pasien diarahkan ke layar **Pilih Jaminan** (`WALKIN_SELECT_GUARANTEE`). Pasien harus memilih jenis penjamin (Umum vs BPJS) terlebih dahulu sebelum memilih poliklinik dan dokter. Hal ini memastikan kelayakan asuransi (seperti rujukan/SKDP BPJS dan verifikasi biometrik sidik jari) diverifikasi sejak dini sebelum pasien memilih jadwal praktik.

---

## 2. Diagram Alur & Sequence Diagram

### 2.1 Diagram Alur Keseluruhan (Flow Diagram)

```mermaid
graph TD
    HOME["Halaman Utama Kiosk"] -->|Input Keyword / Scan QR| SEARCH_BOOK["Cari Booking: GET /Booking/search"]
    HOME -->|Klik 'Ambil Antrian Admisi'| INTAKE_DIRECT["Pilih Service Point Admisi"]
    
    %% Booking Search Cascade
    SEARCH_BOOK -->|Ketemu Booking| BOOK_CONF["Konfirmasi Detail Booking"]
    SEARCH_BOOK -->|Tidak Ketemu| SEARCH_PATIENT["Cari Konteks Pasien: POST /patient-context-search"]
    
    %% Patient Context / Walk-in Flow
    SEARCH_PATIENT -->|Pasien Ketemu| PATIENT_CONF["Konfirmasi Detail Pasien"]
    SEARCH_PATIENT -->|Pasien Tidak Ketemu| FB_ASSIST["Tampilkan Kegagalan: BOOKING_NOT_FOUND"]
    
    PATIENT_CONF --> SELECT_GUARANTEE["Pilih Jaminan: WALKIN_SELECT_GUARANTEE"]
    SELECT_GUARANTEE --> BPJS_CHECK_GS{Jaminan BPJS?}
    
    %% Eligibility & Biometric Branch (Same for Booking and Walk-in)
    BOOK_CONF --> BPJS_CHECK_BOOK{Jaminan BPJS?}
    
    BPJS_CHECK_BOOK -->|Ya| BIOMETRIC_BOOK["Verifikasi Biometrik: POST /biometrik"]
    BPJS_CHECK_BOOK -->|Tidak / Umum| REG_BOOK["Registrasi Booking: POST /rajalByBooking/direct"]
    
    BPJS_CHECK_GS -->|Ya| BIOMETRIC_GS["Verifikasi Biometrik: POST /biometrik"]
    BPJS_CHECK_GS -->|Tidak / Umum| SELECT_SERVICE["Pilih Layanan: Poli -> Dokter -> Jadwal"]
    
    BIOMETRIC_BOOK -->|Success / READY| SEP_CREATE_BOOK["Buat SEP BPJS: POST /Sep"]
    BIOMETRIC_BOOK -->|Fail / Timeout| FB_ASSIST
    
    BIOMETRIC_GS -->|Success / READY| SELECT_SERVICE
    BIOMETRIC_GS -->|Fail / Timeout| FB_ASSIST
    
    SEP_CREATE_BOOK --> REG_BOOK
    
    SELECT_SERVICE --> GS_CONF["Konfirmasi Layanan & Pasien: WALKIN_CONFIRM"]
    GS_CONF --> BPJS_CHECK_GS_POST{Jaminan BPJS?}
    BPJS_CHECK_GS_POST -->|Ya| SEP_CREATE_GS["Buat SEP BPJS: POST /Sep"]
    BPJS_CHECK_GS_POST -->|Tidak / Umum| REG_GS["Registrasi Walk-in: POST /rajalWalkIn/direct"]
    SEP_CREATE_GS --> REG_GS
    
    %% Success/Fail Outcomes
    REG_BOOK -->|Sukses| PRINT_SUCCESS["Cetak Bukti Registrasi: PNG via Print Proxy"]
    REG_BOOK -->|Gagal| FB_ASSIST
    
    REG_GS -->|Sukses| PRINT_SUCCESS
    REG_GS -->|Gagal| FB_INTAKE
    
    %% Fallbacks
    FB_ASSIST --> ASSIST_PICK["Pilih Service Point Loket Bantuan"]
    ASSIST_PICK --> ASSIST_API["POST /booking-assistance"]
    ASSIST_API --> PRINT_ASSIST["Cetak Tiket Antrian Bantuan"] --> HOME
    
    INTAKE_DIRECT --> INTAKE_API
    FB_INTAKE --> INTAKE_PICK["Pilih Service Point Admisi"]
    INTAKE_PICK --> INTAKE_API["POST /admission-queue/intake"]
    INTAKE_API --> PRINT_INTAKE["Cetak Tiket Antrian Pendaftaran"] --> HOME
    
    PRINT_SUCCESS --> HOME
```

---

### 2.2 Sequence Diagram: Booking Non-BPJS (Umum)

```mermaid
sequenceDiagram
    autonumber
    actor Pasien
    participant Kiosk as Kiosk Web Client
    participant Bilreg as Bilreg API (Backend HIS)
    participant LocalApp as Local Biometric/Print Service

    Pasien->>Kiosk: Input / Scan Kode Booking
    Kiosk->>Bilreg: GET /api/system/business-date
    Bilreg-->>Kiosk: active business date (tglBerobat)
    Kiosk->>Bilreg: GET /api/Booking/search/:tglBerobat/:bookingCode
    Bilreg-->>Kiosk: bookingDetail
    Pasien->>Kiosk: Konfirmasi Data Booking
    
    Kiosk->>Bilreg: POST /api/Reg/rajalByBooking/direct (bookingId, ...)
    Bilreg-->>Kiosk: (regId, noAntrian)
    
    Kiosk->>LocalApp: POST /print (doctype: 'registrasi', payload)
    LocalApp-->>Kiosk: print success
    Kiosk->>Pasien: Bukti Registrasi Rawat Jalan Tercetak
```

---

### 2.3 Sequence Diagram: Booking BPJS + Biometrik

```mermaid
sequenceDiagram
    autonumber
    actor Pasien
    participant Kiosk as Kiosk Web Client
    participant LocalApp as Local Biometric/Print Service
    participant Bilreg as Bilreg API (Backend HIS)
    participant Jetli as JETLI API (BPJS/SEP VClaim)

    Pasien->>Kiosk: Input / Scan Kode Booking
    Kiosk->>Bilreg: GET /api/system/business-date
    Bilreg-->>Kiosk: active business date (tglBerobat)
    Kiosk->>Bilreg: GET /api/Booking/search/:tglBerobat/:bookingCode
    Bilreg-->>Kiosk: bookingDetail (includes noPeserta)
    
    Kiosk->>Bilreg: GET /api/polis/list/:pasienId
    Bilreg-->>Kiosk: List Polis
    Kiosk->>Kiosk: Hitung needsEligibility (BPJS Jaminan)
    
    Note over Kiosk, LocalApp: Memulai Verifikasi Biometrik (POST /biometrik)
    Kiosk->>LocalApp: POST /biometrik (noPeserta, timeout)
    alt Biometrik Belum Ready (Capture Diperlukan)
        LocalApp->>Pasien: Buka popup capture sidik jari
        Pasien->>LocalApp: Scan sidik jari
        LocalApp-->>Kiosk: (outcome: 'SUCCESS')
    else Biometrik Sudah Ready
        LocalApp-->>Kiosk: (outcome: 'READY')
    end
    
    Note over Kiosk, Jetli: Pembuatan SEP & Registrasi BPJS
    Kiosk->>Jetli: POST /api/Sep (noPeserta, rujukanId, ...)
    Jetli-->>Kiosk: (sepId, sepNo)
    
    Kiosk->>Bilreg: POST /api/Reg/rajalByBooking/direct (bookingId, sepNo, ...)
    Bilreg-->>Kiosk: (regId, noAntrian)
    
    Kiosk->>Bilreg: PATCH /api/reg/setDataEligibility (regId, sepNo)
    Bilreg-->>Kiosk: success
    Kiosk->>Jetli: PATCH /api/Sep/upload (sepId, regId)
    Jetli-->>Kiosk: success
    
    Note over Kiosk, LocalApp: Cetak Bukti Registrasi
    Kiosk->>LocalApp: POST /print (doctype: 'registrasi', payload)
    LocalApp-->>Kiosk: print success
    Kiosk->>Pasien: Tiket Registrasi Keluar
```

---

### 2.4 Sequence Diagram: Go-Show / Walk-In (Cascade Fallback)

```mermaid
sequenceDiagram
    autonumber
    actor Pasien
    participant Kiosk as Kiosk Web Client
    participant Bilreg as Bilreg API (Backend HIS)
    participant LocalApp as Local Biometric/Print Service

    Pasien->>Kiosk: Input NIK / MR / BPJS / Rujukan (Tidak Ditemukan Booking)
    Kiosk->>Bilreg: GET /api/Booking/search/:tglBerobat/:keyword
    Bilreg-->>Kiosk: [] (Kosong)
    
    Note over Kiosk, Bilreg: Fallback ke Patient Context Search
    Kiosk->>Bilreg: POST /api/v1/admisi-rajal/patient-context-search (keyword, businessDate)
    Bilreg-->>Kiosk: (patients, bestMatch)
    
    Pasien->>Kiosk: Konfirmasi / Pilih Pasien dari Hasil Pencarian
    Kiosk->>Bilreg: GET /api/polis/list/:pasienId
    Bilreg-->>Kiosk: List Polis
    
    Kiosk->>Pasien: Tampilkan Pilihan Jaminan (WALKIN_SELECT_GUARANTEE)
    Pasien->>Kiosk: Pilih Jaminan (Umum / BPJS / dll)
    
    alt Jaminan BPJS (needsEligibility)
        Kiosk->>Bilreg: GET /api/v1/jetli/rujukan-skpd/:noPeserta
        Bilreg-->>Kiosk: Rujukan/SKPD & biodata
        alt Pasien >= 17 Tahun
            Kiosk->>LocalApp: POST /biometrik (noPeserta, timeout)
            LocalApp-->>Kiosk: Verdict (SUCCESS / READY)
        end
    end
    
    Note over Kiosk, Pasien: Flow Pemilihan Poli, Dokter & Jadwal
    Kiosk->>Bilreg: GET /api/Layanan/2/list
    Bilreg-->>Kiosk: ServiceItem[] (Layanan)
    Pasien->>Kiosk: Pilih Poli
    
    Kiosk->>Bilreg: GET /api/ppa/dokter/:layananId
    Bilreg-->>Kiosk: ServiceItem[] (Dokter)
    Pasien->>Kiosk: Pilih Dokter
    
    Kiosk->>Bilreg: GET /api/Dokter/jadwal?tglBerobat=:tglBerobat&ppaId=:ppaId
    Bilreg-->>Kiosk: JadwalItem[] (Jadwal Praktek)
    Pasien->>Kiosk: Pilih Jadwal Praktek
    
    Pasien->>Kiosk: Konfirmasi Pendaftaran Walk-in (WALKIN_CONFIRM)
    
    Kiosk->>Bilreg: POST /api/Reg/rajalWalkIn/direct (pasienId, ppaId, jadwalId, tipeJaminanId, pesertaJaminanId)
    Bilreg-->>Kiosk: { regId, noAntrian }
    
    alt Jaminan BPJS (needsEligibility)
        Note over Kiosk, Bilreg: Pembuatan & Upload SEP BPJS
        Kiosk->>Bilreg: POST /api/Sep (noPeserta, rujukanId, ...)
        Bilreg-->>Kiosk: (sepId, sepNo)
        Kiosk->>Bilreg: POST /api/v1/jetli/upload-sep (sepId, regId)
        Bilreg-->>Kiosk: success
        Kiosk->>Bilreg: PATCH /api/reg/setDataEligibility (regId, sepNo)
        Bilreg-->>Kiosk: success
    end
    
    Kiosk->>LocalApp: POST /print (doctype: 'registrasi', payload)
    LocalApp-->>Kiosk: print success
    Kiosk->>Pasien: Tiket Registrasi Keluar
```

---

### 2.5 Sequence Diagram: Gagal Registrasi (Booking Assistance Fallback)

```mermaid
sequenceDiagram
    autonumber
    actor Pasien
    participant Kiosk as Kiosk Web Client
    participant Bilreg as Bilreg API (Backend HIS)
    participant LocalApp as Local Biometric/Print Service

    Note over Kiosk, Bilreg: Registrasi / Biometrik mengalami kegagalan
    Kiosk->>Kiosk: Deteksi Error (e.g. BIOMETRIC_FAILED, BACKEND_ERROR)
    Kiosk->>Pasien: Tampilkan Layar Gagal & Service Point Picker
    Pasien->>Kiosk: Pilih Loket Bantuan (Service Point)
    
    alt Kegagalan di Alur Booking
        Kiosk->>Bilreg: POST /api/v1/admission-queue/booking-assistance (bookingId, servicePointId, kioskId, userId)
        Bilreg-->>Kiosk: (queueLabel, queueNo, assistanceTicketId)
    else Kegagalan di Alur Walk-in / Go-show
        Kiosk->>Bilreg: POST /api/v1/admission-queue/intake (servicePointId)
        Bilreg-->>Kiosk: (queueLabel, queueNo, antrianId)
    end
    
    Kiosk->>LocalApp: POST /print (doctype: 'antrian', payload)
    LocalApp-->>Kiosk: print success
    Kiosk->>Pasien: Tiket Antrian Bantuan Keluar
```

---

## 3. Detail Layar & UI/UX

Kiosk berpindah layar berdasarkan perubahan state `flow` yang diatur oleh `useKioskRegistration`.

1. **`HOME` (`KioskHome.vue`)**:
   * Menampilkan area pemutaran video iklan & informasi layanan RS di sebelah kiri (dikelola oleh `useKioskMediaInfo`).
   * Input teks utama dengan autofocus di sebelah kanan, didukung komponen `VirtualKeyboard` sentuh untuk mempermudah penulisan data pasien.
   * Mendukung input manual maupun input otomatis dari pemindaian barcode/QR code (melalui simulasi pembacaan hardware).
   * Menyediakan tombol alternatif "Ambil Antrian Admisi" untuk langsung mengambil nomor antrian pendaftaran manual tanpa melalui proses verifikasi data pasien/booking.

2. **`BOOKING_SEARCH` / `PATIENT_CONTEXT_SEARCH`**:
   * Layar transisi (loading state) ketika aplikasi sedang mengirim data pencarian ke backend API dan menunggu kembalinya payload.

3. **`BOOKING_CONFIRM` (`BookingConfirmStep.vue`)**:
   * Menampilkan rincian booking yang berhasil ditemukan: Nama Pasien, Nomor Rekam Medis (MR), Dokter, Poliklinik, Tanggal & Jam Praktek, serta jenis penjamin (Jaminan).
   * Jika jaminan terdeteksi sebagai BPJS dan membutuhkan eligibility check, sistem menampilkan pesan peringatan mengenai keharusan melakukan verifikasi sidik jari di langkah berikutnya.

4. **`PATIENT_CONTEXT_CONFIRM` (`PatientContextConfirmStep.vue`)**:
   * Ditampilkan jika pencarian booking nihil namun data pasien ditemukan di database HIS.
   * Menampilkan daftar pasien yang cocok dengan keyword pencarian. Pasien diminta menekan tombol konfirmasi di baris datanya untuk menyatakan "Ya, ini saya" untuk masuk ke alur pendaftaran walk-in langsung.

5. **`WALKIN_SELECT_GUARANTEE` (`WalkinSelectGuaranteeStep.vue`)**:
   * Ditampilkan setelah konfirmasi data pasien walk-in.
   * Pasien diminta memilih jenis penjamin (Umum / Jaminan Kesehatan aktif yang terdaftar di HIS / BPJS Kesehatan fallback).
   * Menentukan `needsEligibility` untuk proses eligibility BPJS dan verifikasi biometrik selanjutnya.

6. **`BIOMETRIC_VERIFY` (`BiometricStep.vue`)**:
   * Layar tunggu verifikasi sidik jari. Sistem memanggil local service melalui `POST /biometrik` yang akan mengaktifkan hardware scanner dan menampilkan aplikasi capture bawaan BPJS di atas layar kiosk web.
   * Layar ini memblokir interaksi pengguna lain guna mencegah double-trigger.

7. **`WALKIN_SELECT_SERVICE` (`WalkinServiceStep.vue`)**:
   * Wizard pemilihan klinik dan dokter rawat jalan walk-in yang terdiri dari 3 tahapan query internal:
     1. Memilih Poliklinik tujuan.
     2. Memilih Dokter spesialis yang bertugas hari ini pada poliklinik tersebut.
     3. Memilih Jam Jadwal Praktek dokter yang tersedia.

8. **`WALKIN_CONFIRM` (`WalkinConfirmStep.vue`)**:
   * Layar rangkuman data pasien walk-in beserta poliklinik, dokter, dan jadwal yang telah dipilih pada step sebelumnya untuk konfirmasi akhir.

9. **`REGISTRATION_SUCCESS` (`RegistrationSuccessStep.vue`)**:
   * Menampilkan pesan sukses pendaftaran, nomor rekam medis, dan **Nomor Antrian Poli** yang dicetak oleh HIS.
   * Menampilkan status cetak thermal receipt dan hitung mundur otomatis untuk kembali ke menu utama.

10. **`FAILURE` (`FailureStep.vue`)**:
    * Menampilkan pesan kegagalan secara detail (misalnya: sidik jari tidak dikenali, jadwal dokter penuh, atau backend error).
    * Menyediakan daftar Service Point (Loket Pendaftaran) yang aktif di mesin Kiosk saat itu agar pasien dapat memilih salah satu loket bantuan admisi.

11. **`ASSISTANCE_QUEUE` (`AssistanceQueueStep.vue`)**:
    * Menampilkan nomor tiket bantuan admisi yang berhasil dicetak sebagai tindak lanjut atas kegagalan registrasi mandiri.

---

## 4. Spesifikasi API & Kontrak Integrasi

### 4.1 Pencarian Booking
* **HTTP Method**: `GET`
* **Path**: `/api/Booking/search/{tglBerobat}/{keyword}`
* **Response Schema**:
  ```ts
  export const bookingSearchItemSchema = z.object({
    bookingId: z.string(),
    bookingDate: z.string(),
    reg: z.object({
      regId: z.string(),
      pasienId: z.string(),
      pasienName: z.string(),
    }),
    layanan: z.object({
      layananId: z.string(),
      layananName: z.string(),
    }),
    dokter: z.object({
      ppaId: z.string(),
      ppaName: z.string(),
      isDefault: z.boolean(),
    }),
    tglBerobat: z.string(),
    jamPraktek: z.string(),
    noAntrian: z.number(),
    extAppRef: z.object({
      extAppName: z.string(),
      reffId: z.string(),
      checkInQr: z.string(),
    }),
  })
  ```

### 4.2 Pencarian Konteks Pasien (Patient Context Search)
* **HTTP Method**: `POST`
* **Path**: `/api/v1/admisi-rajal/patient-context-search`
* **Request Payload**:
  ```json
  {
    "keyword": "31710XXXXXXXXXXX",
    "businessDate": "2026-08-14"
  }
  ```
* **Response Schema**:
  ```ts
  export const patientContextSearchResponseSchema = z.object({
    businessDate: z.string(),
    bookings: z.object({
      items: z.array(z.unknown()),
      total: z.number(),
      hasMore: z.boolean(),
    }),
    registrations: z.object({
      items: z.array(z.unknown()),
      total: z.number(),
      hasMore: z.boolean(),
    }),
    patients: z.object({
      items: z.array(patientContextItemSchema),
      total: z.number(),
      hasMore: z.boolean(),
    }),
    bestMatch: patientContextItemSchema.nullable(),
    canCreatePatient: z.boolean(),
  })
  ```

### 4.3 Registrasi Direct dari Booking
* **HTTP Method**: `POST`
* **Path**: `/api/Reg/rajalByBooking/direct`
* **Request Payload**:
  ```json
  {
    "bookingId": "BK-100293",
    "pasienId": "P-092301",
    "tipeJaminanId": "00001",
    "noPeserta": "0001293849182",
    "userId": "hidokkiosk"
  }
  ```
* **Response**: `{ regId: string, noAntrian: number }`

### 4.4 Registrasi Direct Walk-In / Go-Show
* **HTTP Method**: `POST`
* **Path**: `/api/Reg/rajalWalkIn/direct`
* **Request Payload**:
  ```json
  {
    "pasienId": "P-092301",
    "poliId": "PL-002",
    "ppaId": "DR-012",
    "jadwalId": "JD-001",
    "tglBerobat": "2026-08-14",
    "tipeJaminanId": "00001",
    "noPeserta": "0001293849182",
    "userId": "hidokkiosk"
  }
  ```
* **Response**: `{ regId: string, noAntrian: number }`

### 4.5 Booking Assistance Fallback
* **HTTP Method**: `POST`
* **Path**: `/api/v1/admission-queue/booking-assistance`
* **Request Payload**:
  ```json
  {
    "bookingId": "BK-100293",
    "servicePointId": "SP-002",
    "kioskId": "kiosk-front-01",
    "userId": "hidokkiosk"
  }
  ```
* **Response**: `AdmissionQueueIntakeResponse` (berisi nomor antrian bantuan loket)

### 4.6 Daftar Poliklinik (Layanan)
* **HTTP Method**: `GET`
* **Path**: `/api/Layanan/{instalasiDkId}/list` (dengan `instalasiDkId = 2` untuk Rawat Jalan)
* **Query Parameters**: None
* **Response Schema**: `z.array(serviceItemSchema)` (hasil pemetaan dari field `layananId` ke `id`, dan `layananName` ke `name` setelah difilter `isAktif = true`)
  ```json
  [
    { "id": "PL-001", "name": "Poli Anak" },
    { "id": "PL-002", "name": "Poli Dalam" }
  ]
  ```

### 4.7 Daftar Dokter per Poliklinik
* **HTTP Method**: `GET`
* **Path**: `/api/ppa/dokter/{layananId}`
* **Query Parameters**: None (Layanan ID diekstrak dari path)
* **Response Schema**: `z.array(serviceItemSchema)`
  ```json
  [
    { "id": "DR-001", "name": "dr. Budi, Sp.A" }
  ]
  ```

### 4.8 Jadwal Praktek Dokter
* **HTTP Method**: `GET`
* **Path**: `/api/Dokter/jadwal`
* **Query Parameters**:
  * `tglBerobat`: `yyyy-mm-dd`
  * `ppaId`: ID Dokter terpilih
* **Response Schema**: `z.array(jadwalItemSchema)`
  ```json
  [
    {
      "jadwalId": "JD-001",
      "ppaId": "DR-001",
      "jamPraktek": "08:00 - 12:00",
      "sisaKuota": 15
    }
  ]
  ```

### 4.9 Praktek Dokter (PraktekDokter/dokter & PraktekDokter/groupSpesialis)

Kedua API endpoint tersebut (`PraktekDokter/dokter` dan `PraktekDokter/groupSpesialis`) digunakan untuk mendapatkan jadwal praktik dokter. Keduanya mengembalikan data dengan struktur array yang sama, yaitu array dari objek `ListPraktekDokter` yang divalidasi dan ditransformasikan oleh `jadwal.ts:171-184` di frontend.

---

#### 4.9.1 Endpoint: /PraktekDokter/dokter

Digunakan untuk mendapatkan daftar jadwal praktik dari satu dokter tertentu dalam rentang waktu yang didefinisikan.

* **HTTP Method**: `POST`
* **Content-Type**: `application/json`
* **Base API Service**: `bilregApi`

##### Request Payload (`PayloadListPraktekDokter`):

```json
{
  "tglYmdAwal": "2026-08-15",
  "tglYmdAkhir": "2026-08-15",
  "dokterId": "D001"
}
```

##### Response Payload (`Array<ListPraktekDokter>`):

```json
[
  {
    "tanggal": "2026-08-15",
    "dokter": {
      "dokterId": "D001",
      "dokterName": "dr. John Doe, Sp.A"
    },
    "layanan": {
      "layananId": "L002",
      "layananName": "Poliklinik Anak"
    },
    "jamMulaiPraktek": "08:00",
    "jamSelesaiPraktek": "12:00",
    "jumlahPasien": 5,
    "maxPasien": 30
  }
]
```

---

#### 4.9.2 Endpoint: /PraktekDokter/groupSpesialis

Digunakan untuk mendapatkan daftar jadwal praktik dari semua dokter yang tergabung dalam satu kelompok spesialisasi tertentu dalam rentang waktu yang didefinisikan.

* **HTTP Method**: `POST`
* **Content-Type**: `application/json`
* **Base API Service**: `bilregApi`

##### Request Payload (`PayloadListPraktekDokterSp`):

```json
{
  "tglYmdAwal": "2026-08-15",
  "tglYmdAkhir": "2026-08-29",
  "groupSpesialisId": "SP-001"
}
```

##### Response Payload (`Array<ListPraktekDokter>`):

```json
[
  {
    "tanggal": "2026-08-15",
    "dokter": {
      "dokterId": "D001",
      "dokterName": "dr. John Doe, Sp.A"
    },
    "layanan": {
      "layananId": "L002",
      "layananName": "Poliklinik Anak"
    },
    "jamMulaiPraktek": "08:00",
    "jamSelesaiPraktek": "12:00",
    "jumlahPasien": 5,
    "maxPasien": 30
  },
  {
    "tanggal": "2026-08-15",
    "dokter": {
      "dokterId": "D003",
      "dokterName": "dr. Alice Brown, Sp.A"
    },
    "layanan": {
      "layananId": "L002",
      "layananName": "Poliklinik Anak"
    },
    "jamMulaiPraktek": "13:00",
    "jamSelesaiPraktek": "17:00",
    "jumlahPasien": 2,
    "maxPasien": 20
  }
]
```

---

#### 4.9.3 Validasi & Skema Data (Zod & Schema)

##### 1. Skema Validasi Zod (Zod Response Schema)

Didefinisikan pada file `jadwal.ts`:

```typescript
import { z } from 'zod'
import { dokterHeaderSchema } from '../../BillingBase/types/doctor'
import { layananHeader } from '../../BillingBase/types/layanan'

// Schema Output Akhir setelah Transformasi/Adaptasi
export const listPraktekDokterOutputSchema = z.object({
  tanggal: z.string(),                 // Format: YYYY-MM-DD
  dokter: z.object({                   // Mengacu ke dokterHeaderSchema
    dokterId: z.string(),
    dokterName: z.string(),
  }),
  layanan: z.object({                  // Mengacu ke layananHeader
    layananId: z.string(),
    layananName: z.string(),
  }),
  jamMulaiPraktek: z.string(),         // Format: HH:MM
  jamSelesaiPraktek: z.string(),       // Format: HH:MM
  jumlahPasien: z.number(),            // Jumlah pasien saat ini yang terdaftar
  maxPasien: z.number(),               // Kuota maksimum pasien
})

// Schema Response Array
export const listPraktekDokterResponseSchema = z.array(listPraktekDokterOutputSchema)
```

---

## 5. State Management & State Machine

Siklus transisi layar di Kiosk diatur secara ketat oleh state machine di `flow.ts` guna mencegah kesalahan navigasi atau data yang tercampur antar sesi.

### State Layar (`KioskFlow`)
```ts
type KioskFlow =
  | 'HOME'
  | 'BOOKING_SEARCH'
  | 'BOOKING_CONFIRM'
  | 'PATIENT_CONTEXT_SEARCH'
  | 'PATIENT_CONTEXT_CONFIRM'
  | 'WALKIN_SELECT_GUARANTEE'
  | 'BIOMETRIC_VERIFY'
  | 'WALKIN_SELECT_SERVICE'
  | 'WALKIN_CONFIRM'
  | 'REGISTRATION_SUCCESS'
  | 'FAILURE'
  | 'ASSISTANCE_QUEUE'
```

### Transisi yang Valid (`FLOW_TRANSITIONS`)
```ts
export const FLOW_TRANSITIONS: Record<KioskFlow, readonly KioskFlow[]> = {
  HOME: [
    'BOOKING_SEARCH',
    'BOOKING_CONFIRM',
    'PATIENT_CONTEXT_SEARCH',
    'PATIENT_CONTEXT_CONFIRM',
    'FAILURE',
  ],
  BOOKING_SEARCH: [
    'BOOKING_CONFIRM',
    'PATIENT_CONTEXT_SEARCH',
    'PATIENT_CONTEXT_CONFIRM',
    'FAILURE',
  ],
  BOOKING_CONFIRM: ['BIOMETRIC_VERIFY', 'REGISTRATION_SUCCESS', 'FAILURE'],
  PATIENT_CONTEXT_SEARCH: ['PATIENT_CONTEXT_CONFIRM', 'FAILURE'],
  PATIENT_CONTEXT_CONFIRM: ['WALKIN_SELECT_GUARANTEE', 'FAILURE', 'HOME'],
  WALKIN_SELECT_GUARANTEE: ['WALKIN_SELECT_SERVICE', 'BIOMETRIC_VERIFY', 'FAILURE', 'HOME'],
  BIOMETRIC_VERIFY: ['REGISTRATION_SUCCESS', 'WALKIN_SELECT_SERVICE', 'FAILURE'],
  WALKIN_SELECT_SERVICE: ['WALKIN_CONFIRM', 'FAILURE'],
  WALKIN_CONFIRM: ['BIOMETRIC_VERIFY', 'REGISTRATION_SUCCESS', 'FAILURE'],
  REGISTRATION_SUCCESS: ['HOME'],
  FAILURE: ['ASSISTANCE_QUEUE'],
  ASSISTANCE_QUEUE: ['HOME'],
}
```

### Aturan Pencegahan Submit Ganda (Double-Submit Protection)
* Kiosk mempertahankan state `submitting = ref(false)`.
* Ketika data dikirimkan (registrasi, biometrik, pengambilan antrean), `submitting` diubah menjadi `true`.
* Semua tombol aksi utama (`Lanjutkan`, `Cetak`, `Coba Lagi`) di layar di-disable jika `submitting` bernilai `true`.

---

## 6. Timeout & Sesi Auto Reset

Sebagai perangkat publik, Kiosk harus dapat membersihkan informasi sensitif pasien dan kembali ke halaman utama jika ditinggal oleh pengguna:

1. **Auto Reset Idle (60 Detik)**:
   * Setiap aktivitas sentuh atau keyboard akan memperbarui parameter `lastActivity`.
   * Jika tidak ada aktivitas selama **60 detik** di luar layar `HOME`, Kiosk otomatis melakukan `goHome()`.

2. **Auto Reset Sukses (10 Detik)**:
   * Setelah tiket registrasi rawat jalan sukses dicetak di layar `REGISTRATION_SUCCESS`, sistem otomatis kembali ke `HOME` dalam waktu **10 detik**.

3. **Auto Reset Bantuan (15 Detik)**:
   * Setelah antrean bantuan berhasil dicetak di layar `ASSISTANCE_QUEUE`, sistem otomatis kembali ke `HOME` dalam waktu **15 detik**.

4. **Pembersihan Data Sensitif**:
   * Prosedur `goHome()` wajib membersihkan seluruh variabel state berikut agar tidak bocor ke pasien berikutnya:
     * `selectedBooking` & `bookingDetail`
     * `selectedPatient` & `walkinEligibility`
     * `selectedService` & `registrationResult`
     * `assistanceTicket`
     * `patientContextResult`
     * `errorContext` & `biometricVerdict`
     * Token autentikasi in-memory (`tokenAuth`) dibersihkan jika Kiosk di-reload secara menyeluruh.
