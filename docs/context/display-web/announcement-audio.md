# Konsep & Domain: Penggunaan Sound Pemanggilan (display-web)

Dokumen ini mencatat konteks bisnis, arsitektur, dan keputusan desain yang disepakati melalui sesi `/grill-me` untuk pengerjaan suara pemanggilan pada Queue Display Client (C3).

## 1. Metadata Pekerjaan
* **Judul Pekerjaan**: Implementasi Sound Pemanggilan berbasis File Rekaman Audio (.wav)
* **Branch Pengerjaan**: `feat/display-announcement-sound`
* **Target Aplikasi**: `apps/display-web` (Queue Display Client)

---

## 2. Aturan Domain & Logika Pelafalan

Sistem pemanggilan diubah dari Text-to-Speech (TTS) bawaan browser (*SpeechSynthesis*) menjadi pemutaran rangkaian file audio rekaman (`.wav`) yang disimpan secara statis pada direktori public.

### A. Alur Rangkaian Pemanggilan (Audio Queue Sequence)
Setiap kali ada pemanggilan nomor antrean baru, sistem akan memutar rangkaian file audio dengan urutan berikut:

1. **Suara Bel / Chime** (`soundrs.m4a`) sebagai nada pembuka.
2. **Frasa Pembuka** (`phrases/nomor-antrian.wav`).
3. **Ejaan Huruf Awalan** (jika ada, misal: `letters/a.wav` untuk awalan "A").
4. **Ejaan Bilangan Nomor Antrean** (hasil dekomposisi angka dalam Bahasa Indonesia, misal: `numbers/15.wav`).
5. **Frasa Penghubung** (`phrases/silakan-menuju.wav`).
6. **Loket / Counter**:
   * Jika `loketKey` bernilai angka 1-10 $\rightarrow$ Putar file gabungan `counters/loket-${loketKey}.wav` jika tersedia (misal: `counters/loket-1.wav`).
   * Jika di luar angka 1-10 $\rightarrow$ Putar frasa loket (`phrases/loket.wav`) diikuti dengan ejaan karakter/angka dari `loketKey` tersebut secara terpisah.

---

### B. Aturan Ejaan Bilangan (Indonesian Number Decomposition)
Angka desimal dari 1 hingga 9999 didekomposisi berdasarkan tingkatan nilai tempatnya untuk dicocokkan dengan asset audio rekaman yang tersedia:

* **Ribuan**:
  * `1000` $\rightarrow$ `numbers/1000.wav` ("seribu")
  * `2000` s.d. `5000` $\rightarrow$ `numbers/${thousands}.wav` ("dua ribu" s.d. "lima ribu")
  * Di atas `5999` $\rightarrow$ Fallback mengeja angka per digit karena keterbatasan asset suara ribuan.
* **Ratusan**:
  * `100` $\rightarrow$ `numbers/100.wav` ("seratus")
  * `200` s.d. `900` $\rightarrow$ `numbers/${hundreds}.wav` ("dua ratus" s.d. "sembilan ratus")
* **Puluhan & Belasan**:
  * `20` s.d. `90` $\rightarrow$ `numbers/${tens}.wav` ("dua puluh" s.d. "sembilan puluh")
  * `11` s.d. `19` $\rightarrow$ `numbers/${remaining}.wav` ("sebelas" s.d. "sembilan belas")
  * `10` $\rightarrow$ `numbers/10.wav` ("sepuluh")
* **Satuan**:
  * `1` s.d. `9` $\rightarrow$ `numbers/${remaining}.wav`
  * `0` $\rightarrow$ `numbers/0.wav` ("nol", hanya diputar jika angka antrean tunggal bernilai 0).

---

### C. Penanganan Edge Cases & Pengejaan Prefiks
1. **Nol di Depan (Leading Zeros)**:
   * Angka nol di depan diabaikan dan dilafalkan sebagai nilai bilangan biasa.
   * Contoh: `"015"` dibaca sebagai *"lima belas"* (`numbers/15.wav`), bukan *"nol satu lima"*.
2. **Prefiks Multi-Huruf**:
   * Jika awalan terdiri dari lebih dari satu huruf (misal: `"CS15"`), huruf-huruf tersebut akan dieja satu demi satu secara sekuensial.
   * Contoh: `"CS15"` $\rightarrow$ `letters/c.wav` + `letters/s.wav` + `numbers/15.wav`.
3. **Keterbatasan/Gagal Muat Audio (Silent Fallback)**:
   * Jika salah satu berkas `.wav` gagal dimuat atau diputar di browser (misalnya karena gangguan jaringan atau file hilang), sistem akan melewati (*skip*) file tersebut dan langsung melanjutkan ke file berikutnya dalam antrean (tidak menyebabkan antrean suara macet atau memblokir render UI).

---

## 3. Implementasi Arsitektur & Teknologi

* **Penyimpanan Assets**: Disimpan di `apps/display-web/public/audio/`.
* **Pathing**: Menggunakan base URL dinamis melalui `import.meta.env.BASE_URL` (secara default disajikan di `/display/audio/...` oleh Vite).
* **Placeholder Assets**: Untuk kebutuhan testing dan *local development*, sistem dilengkapi skrip generator yang membuat file WAV mini bernoda gelombang sinus (*sine wave beeps*) untuk mencegah error 404 pada local server/CI.

---

## 4. Penyelarasan RS Identity / Branding Configuration

Sebagai bagian dari standarisasi konfigurasi monorepo, format konfigurasi identitas rumah sakit (`branding`) pada `global_config.json` diselaraskan secara penuh antara `display-web` dan `kiosk-web`:
* Struktur `branding` diubah dari yang sebelumnya menggunakan `subTag` menjadi:
  * `name`: Nama rumah sakit (default: `'RS Sehat Sejahtera'`).
  * `taglineId`: Tagline bahasa Indonesia / teks subtitle (default: `'Melayani dengan hati, sehat untuk negeri'`).
  * `taglineEn`: Tagline bahasa Inggris (default: `'Serving with heart, healthy for the nation'`).
  * `timeZoneLabel`: Zona waktu (default: `'WIB'`).
* Pada UI `DisplayPage.vue`, rendering subtitle diubah dari `branding.subTag` menjadi `branding.taglineId`.
* Unit test pada `branding.spec.ts` diperbarui untuk mencerminkan skema Zod baru yang tersinkronisasi.

---

## 5. Penanganan Browser Autoplay Block (NotAllowedError)

Karena kebijakan keamanan browser modern yang memblokir pemutaran audio otomatis tanpa interaksi pengguna pertama kali pada halaman (*NotAllowedError*), sistem dilengkapi mekanisme **Autoplay Audio Unblocker**:
* **Deteksi Otomatis**: Jika pemutaran sekuensial audio gagal di browser karena *NotAllowedError*, status `isAudioLocked` diset menjadi `true`.
* **Banner Interaktif UI**: Muncul spanduk melayang oranye di bagian bawah layar Display (`.audio-blocked-banner`) bertuliskan *"Browser memblokir suara otomatis. Klik untuk mengaktifkan suara pemanggilan."*.
* **Unlock Alur Audio**: Ketika pengguna/petugas mengeklik spanduk tersebut, method `unlockAudio()` dipicu. Fungsi ini memutar audio sunyi mini (menggunakan buffer base64 WAV inline 44-byte) untuk membuka kunci konteks audio pada browser tersebut secara instan tanpa membebani memori, lalu menyembunyikan spanduk. Pemanggilan berikutnya akan berbunyi secara otomatis.

---

## 6. Antrean Pemutaran Berurutan (Sequential Queue Player)

Untuk mencegah bentrokan suara saat beberapa loket melakukan pemanggilan secara beruntun dalam waktu bersamaan/hampir bersamaan, sistem menggunakan mekanisme **Task Queue**:
* Setiap request pemanggilan baru akan dimasukkan ke dalam antrean array memori (`announcementQueue`).
* Fungsi pemutar (`processQueue()`) akan mengeksekusi antrean tersebut satu per satu secara sekuensial (FIFO - First In First Out).
* Panggilan baru tidak akan menimpa atau menabrak panggilan aktif, melainkan menunggu hingga panggilan sebelumnya selesai dibacakan seutuhnya.
* Jika terjadi pembatasan autoplay saat antrean berjalan, antrean dibersihkan dan panggilan terakhir disimpan di `lastCandidates` agar dapat diputar ulang secara otomatis begitu pengguna mengeklik tombol unblock.


