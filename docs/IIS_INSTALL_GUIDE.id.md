# Panduan Instalasi IIS untuk **c013‑kiosk‑queue‑display‑web**

> Dokumen ini ditujukan bagi **end‑user** yang telah meng‑download artifact dari TeamCity dan ingin menjalankan tiga aplikasi web pada server IIS.

## Prasyarat

1. **Windows Server** (atau Windows 10/11) dengan **IIS** ter‑install.
2. Aktifkan fitur‑fitur IIS berikut (via *Turn Windows features on or off* atau `Add‑WindowsFeature`):
   - **Web Server (IIS)**
   - **Web Server → Application Development → Static Content**
   - **Web Server → Common HTTP Features → Default Document**
   - **Web Server → Common HTTP Features → HTTP Errors**
   - **Web Server → Security → Request Filtering**
   - **Web Server → Application Development → URL Rewrite** (penting untuk `web.config` yang disertakan)
3. Akun **IIS_IUSRS** memiliki hak **Read/Execute** pada folder aplikasi.
4. Jika menggunakan **HTTPS**, pastikan sertifikat sudah di‑binding pada port yang di‑gunakan.

## Langkah‑Langkah Instalasi di IIS

### 1. Unduh dan ekstrak artifact

- Buka **TeamCity** dan pilih build terakhir yang berhasil.
- Unduh file zip **`c013‑kiosk‑queue‑display‑web.zip`** (atau nama yang diberikan pada pipeline).
- Ekstrak isi zip ke folder fisik yang akan dijadikan root IIS, misalnya:
```
C:\\inetpub\\wwwroot\\queue‑apps
```
  Setelah ekstraksi, struktur folder akan tampak seperti:
```
queue‑apps\\
  ├─ kiosk‑web\\dist\\
  ├─ display‑web\\dist\\
  └─ config‑web\\dist\\
```
  **Catatan:** Folder `dist` berisi file hasil `vite build` termasuk **`web.config`** yang sudah dikopi otomatis oleh plugin pada `vite.config.ts`.

### 2. Buat *Site* atau gunakan *Site* yang sudah ada

Jika belum ada site khusus, buat baru:
1. Buka **IIS Manager** (`inetmgr`).
2. Klik kanan **Sites** → **Add Website…**
   - **Site name**: `QueueApps`
   - **Physical path**: `C:\\inetpub\\wwwroot\\queue‑apps`
   - **Binding**: Pilih **IP address** (`<ip>`), **Port** (`<port>`), dan **Host name** (biarkan kosong bila tidak diperlukan).
   - **Application pool**: Pilih atau buat baru **`QueueAppsPool`** → **.NET CLR version** = **No Managed Code** → **Pipeline mode** = Integrated.
3. Klik **OK**.

### 3. Tambahkan *Applications* untuk tiap modul

#### a. `kiosk‑web`
1. Klik kanan site **QueueApps** → **Add Application…**
   - **Alias**: `kiosk‑web`
   - **Physical Path**: `C:\\inetpub\\wwwroot\\queue‑apps\\kiosk‑web\\dist`
   - **Application pool**: `QueueAppsPool`
2. OK.

#### b. `display‑web`
1. **Add Application…**
   - **Alias**: `display‑web`
   - **Physical Path**: `C:\\inetpub\\wwwroot\\queue‑apps\\display‑web\\dist`
2. OK.

#### c. `config‑web`
1. **Add Application…**
   - **Alias**: `config‑web`
   - **Physical Path**: `C:\\inetpub\\wwwroot\\queue‑apps\\config‑web\\dist`
2. OK.

### 4. Verifikasi `web.config`

Setiap `dist` folder sudah menyertakan file **`web.config`** yang di‑copy oleh proses build (lihat skrip `vite.config.ts`). Pastikan file ini berada di dalam folder `dist`. Jika tidak, jalankan kembali `pnpm build`.

### 5. Set izin folder

Pastikan akun **IIS_IUSRS** (atau aplikasi pool identity) memiliki hak **Read** pada seluruh folder `queue‑apps` dan sub‑foldernya.
```powershell
icacls "C:\\inetpub\\wwwroot\\queue‑apps" /grant "IIS_IUSRS:(OI)(CI)RX"
```

### 6. Uji akses aplikasi

Buka browser dan akses URL berikut (ganti `<ip>` dan `<port>` sesuai server Anda):
- **Kiosk**: `http://<ip>:<port>/kiosk/`
- **Display**: `http://<ip>:<port>/display/`
- **Config**: `http://<ip>:<port>/queue-config/`

Jika semua aplikasi menampilkan halaman utama (biasanya `index.html`) maka instalasi berhasil.

## Konten & Media Display

Aplikasi **display‑web** menampilkan media iklan/edukasi (video atau gambar) yang disimpan pada folder `ads/` di dalam artifact `display‑web`.

### 1. Menyimpan aset iklan

Letakkan file media pada folder:

```
C:\inetpub\wwwroot\queue‑apps\display‑web\dist\ads\
```

Format yang didukung:

- **Video**: `.mp4`, `.webm`, `.ogg`, `.mov`
- **Gambar**: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`

Pastikan akun **IIS_IUSRS** memiliki hak **Read** pada folder `ads/`.

### 2. Mendaftarkan iklan pada konfigurasi

Daftarkan setiap file pada blok `ads` di `display-web\dist\global_config.json`:

```json
"ads": [
  { "src": "track-1.mp4" },
  { "src": "banner.png" }
]
```

**Catatan keamanan:**
- Hanya file di dalam folder `ads/` yang dapat ditampilkan. Nama file lain, URL eksternal (`http`, `https`, `data:`, dll.), path absolut, dan path traversal (`..`) otomatis **ditolak**.
- Tipe media ditentukan dari ekstensi file; format yang tidak didukung akan diabaikan.

### 3. Mengatur tata letak display

Blok `displayLayout` pada `global_config.json` mengatur orientasi dan konten panel iklan:

```json
"displayLayout": {
  "orientation": "landscape",
  "showWellnessTips": true
}
```

- **`orientation`**: `landscape` (rasio iklan **16:9**) atau `portrait` (rasio iklan **9:16**). Nilai default `landscape`.
- **`showWellnessTips`**: menampilkan kartu kiat kesehatan (carousel) pada kolom menu kesehatan. Jika kolom ini dikosongkan, kartu otomatis tampil pada mode `landscape` dan tersembunyi pada mode `portrait`.

## Catatan Tambahan

- **Cache Control**: `web.config` meng‑set header `Cache‑Control: no‑cache` untuk memastikan versi terbaru selalu di‑load.
- **Reload Otomatis**: Ketika file `version.json` berubah (setiap build), aplikasi akan melakukan reload otomatis.
- **Proxy API**: `display‑web` menggunakan **SignalR**; pastikan variabel lingkungan `VITE_BILREG_API_BASE` telah di‑set pada *appsettings* atau di‑hardcode dalam `global_config.json`.
- **Rollback**: Simpan versi zip sebelumnya; cukup ganti folder `dist` dengan versi lama untuk rollback cepat.

---
*Dokumen ini dibuat secara otomatis oleh pipeline build dan akan disertakan dalam artifact sehingga end‑user dapat menemukan panduan ini bersama paket aplikasi.*
