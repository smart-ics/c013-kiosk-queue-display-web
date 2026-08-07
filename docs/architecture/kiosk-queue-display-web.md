# Kiosk Web & Queue Display Web — Deployment & Repository Strategy

> **Operational mirror** of `b09-bilreg-api/docs/contexts/pasien-tracker/kiosk-queue-display-web.md`.  
> Prefer editing the b09 canonical copy, then re-sync here for monorepo ops.

Status: Draft v1  
Scope: Frontend only (kiosk-web, display-web). Backend, print proxy lokal, dan WinForm/WPF dianggap out of scope / sudah ada.

**Consumed by:** [TRACKER-ADMISSION-QUEUE-EXTERNAL-CLIENTS-IMPLEMENTATION-PLAN.md](../plans/TRACKER-ADMISSION-QUEUE-EXTERNAL-CLIENTS-IMPLEMENTATION-PLAN.md) (C2+ revision). That plan is authoritative for remaining Kiosk/Display implementation phases; this document remains the deployment/repo architecture decision record.

---

## 1. Routing model — path-based, single IIS site, tanpa SSL

Karena berjalan on-premise di jaringan lokal lewat IIS tanpa SSL, **subdomain per device tidak dipakai**. Semua device diarahkan ke satu site IIS dengan path prefix yang membedakan aplikasi dan device.

```
http://<host-or-ip>/kiosk/loket-03
http://<host-or-ip>/kiosk/loket-07
http://<host-or-ip>/display/lobby-poli-1
http://<host-or-ip>/display/lobby-igd
```

Segmen setelah `/kiosk/` atau `/display/` adalah **station/screen ID**, dibaca oleh SPA lewat `window.location.pathname`, bukan query string — supaya URL tetap bersih dan mudah dibuatkan shortcut kiosk mode.

### Struktur folder fisik di server IIS

```
C:\inetpub\wwwroot\
├── kiosk\           ← hasil build kiosk-web (dist/)
│   ├── index.html
│   ├── assets\
│   └── web.config
└── display\         ← hasil build display-web (dist/)
    ├── index.html
    ├── assets\
    └── web.config
```

Dua folder = dua aplikasi terpisah di bawah satu site IIS (bisa sebagai virtual application, bukan subdomain, bukan site terpisah).

### `web.config` — SPA fallback + station ID sebagai path segment

Karena `loket-03` bukan file/folder fisik, IIS harus rewrite semua path di bawah `/kiosk/*` dan `/display/*` ke `index.html` masing-masing (khas SPA), lalu router di sisi client (Vue Router) yang membaca `:stationId` dari path.

```xml
<!-- C:\inetpub\wwwroot\kiosk\web.config -->
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="KioskSPAFallback" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
          </conditions>
          <action type="Rewrite" url="/kiosk/index.html" />
        </rule>
      </rules>
    </rewrite>
    <staticContent>
      <remove fileExtension=".json" />
      <mimeMap fileExtension=".json" mimeType="application/json" />
    </staticContent>
  </system.webServer>
</configuration>
```

Vue Router (contoh):

```js
// kiosk-web/src/router.js
const routes = [
  { path: '/kiosk/:stationId', component: KioskView },
]
```

Buat `web.config` yang sama (disesuaikan path rewrite target) di folder `display/`.

### Shortcut kiosk mode

```
chrome.exe --kiosk --edge-kiosk-type=fullscreen --no-first-run --clear-token-caches http://192.168.10.5/kiosk/loket-03
```

Tersedia skrip pembantu interaktif [create-kiosk-shortcut.bat](file:///E:/PROJECT/ICS/FE/c013-kiosk-queue-display-web/scripts/create-kiosk-shortcut.bat) untuk mengotomatiskan pembuatan shortcut ini.


Menambah kiosk atau display baru = menambah shortcut baru dengan path ID baru. Tidak ada rebuild, tidak ada deployment ulang.

### Catatan IIS tanpa SSL

- Karena tanpa TLS, pastikan jaringan ini benar-benar tersegmentasi (VLAN terpisah/tidak routable ke internet) — SignalR dan JWT REST call akan lewat plain HTTP.
- Set header `Cache-Control` untuk `index.html` = `no-cache` (selalu fetch terbaru untuk cek versi), tapi asset hashed (`*.js`, `*.css` dari Vite) boleh `max-age` panjang karena sudah content-hashed oleh build.

---

## 2. Repository management — kiosk-web & display-web saling terkait

### 2.1 Keputusan: Monorepo, bukan polyrepo

Kedua aplikasi berbagi: kontrak API yang sama (loket, antrean), pola SignalR reconnect yang sama, model auth JWT yang sama, dan kemungkinan design token/komponen UI yang sama. Memisahkan jadi dua repo akan membuat kontrak ini gampang divergen diam-diam (satu app update tipe data, yang lain telat sinkron). Monorepo dengan workspace adalah best practice standar untuk kasus ini.

### 2.2 Struktur folder

```
myhospitalweb-frontend/
├── apps/
│   ├── kiosk-web/
│   │   ├── src/
│   │   ├── web.config
│   │   └── vite.config.ts
│   └── display-web/
│       ├── src/
│       ├── web.config
│       └── vite.config.ts
├── packages/
│   ├── api-client/        ← fetch wrapper + tipe request/response REST (JWT REST)
│   ├── signalr-client/    ← wrapper koneksi SignalR (reconnect, backoff, RefreshHint handler)
│   ├── shared-types/      ← tipe data domain: Loket, Antrean, AnnouncementVersion, DeviceConfig
│   ├── ui-kit/             ← komponen Vue yang dipakai bersama (opsional, hanya jika ada UI yang genuinely shared)
│   └── device-config/     ← util baca station/screen ID dari path + fetch config device
├── package.json            ← workspace root
├── pnpm-workspace.yaml
└── turbo.json               ← (opsional) orchestrator build/test
```

### 2.3 Tooling workspace

Rekomendasi: **pnpm workspaces**, dikombinasi **Turborepo** untuk build caching (karena Anda dua apps + beberapa shared packages, cache antar build penting begitu jumlah packages bertambah).

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
```

```json
// package.json (root)
{
  "scripts": {
    "build": "turbo run build",
    "dev:kiosk": "pnpm --filter kiosk-web dev",
    "dev:display": "pnpm --filter display-web dev",
    "lint": "turbo run lint",
    "test": "turbo run test"
  }
}
```

### 2.4 Kontrak bersama = satu sumber kebenaran

`packages/shared-types` adalah satu-satunya tempat definisi tipe seperti:

```ts
export interface AnnouncementVersion {
  version: number
  loketId: string
  ticketNumber: string
}

export interface DeviceConfig {
  deviceId: string
  role: 'kiosk' | 'display'
  loketIds: string[]
  printerProxyPort?: number
}
```

Kiosk-web dan display-web sama-sama import dari sini. Kalau backend mengubah shape data, cukup update `shared-types` sekali, TypeScript akan langsung menunjukkan semua pemakaian yang perlu disesuaikan di kedua app.

`packages/signalr-client` membungkus logic reconnect + snapshot recovery supaya **tidak diimplementasi dua kali secara berbeda** di kiosk dan display:

```ts
// packages/signalr-client/src/index.ts
export function createQueueConnection(hubUrl: string, onRefreshHint: (v: AnnouncementVersion) => void) {
  // reconnect policy, exponential backoff, snapshot-first-on-reconnect
}
```

### 2.5 Versioning & release

- Gunakan **Changesets** (`@changesets/cli`) untuk versi `packages/*` — memastikan perubahan breaking di `shared-types` atau `signalr-client` tercatat dan memaksa bump versi yang konsisten dikonsumsi kedua app.
- Setiap `apps/*` build menghasilkan `version.json` sendiri (embed commit hash + waktu build), independen dari versi package — dipakai untuk mekanisme auto-refresh yang sudah didiskusikan sebelumnya (cek versi, reload halus saat idle).
- Tag rilis di git per app: `kiosk-web@1.4.0`, `display-web@2.1.0` — supaya rollback satu app tidak menyeret app lain.

### 2.6 Branching & CI

- Trunk-based development: `main` selalu deployable, fitur lewat short-lived branch + PR.
- CI pipeline split per app path (pakai path filter di CI, misal GitHub Actions `paths:` filter) — perubahan di `apps/kiosk-web/**` tidak perlu trigger build/deploy `display-web`, tapi perubahan di `packages/**` **wajib** trigger build+test kedua app (karena keduanya konsumen).
- Lint/test config root-level dibagi lewat root `eslint.config.js` / `vitest.config.ts` yang di-extend tiap app, supaya style dan kualitas kode konsisten.

### 2.7 Kenapa bukan git submodule / polyrepo dengan published npm package

Untuk skala tim kecil–menengah dan siklus rilis yang saling terkait erat (loket & display berubah bareng saat backend contract berubah), monorepo workspace jauh lebih murah secara operasional dibanding maintain repo terpisah + publish package internal ke registry npm privat. Pertimbangkan polyrepo hanya kalau nanti tim kiosk dan tim display benar-benar terpisah dengan rilis independen sepenuhnya.

---

## 3. Print proxy

Di luar scope dokumen ini — kiosk-web hanya perlu diasumsikan bisa memanggil proxy lokal di `localhost:5050` / `localhost:5800` seperti kontrak yang sudah ada di `kiosk_wpf`/`c012`. Tidak ada perubahan yang diminta di sisi ini.

---

## 4. Syarat/kontrak yang harus dipenuhi backend (bukan implementasi, hanya requirement)

Dokumen ini tidak membahas cara backend diimplementasikan, tapi frontend **butuh** kontrak berikut disediakan agar arsitektur di atas valid:

### 4.1 Device config resolution

```
GET /api/devices/{deviceId}/config
```
- `deviceId` = segmen path (`loket-03`, `lobby-poli-1`) yang dibaca dari URL.
- Response minimal: `role`, `loketIds`, konfigurasi tampilan/print yang relevan.
- Dipanggil sekali saat boot SPA, sebelum render UI utama.

### 4.2 Snapshot recovery (authority model)

```
GET /api/displays/{screenId}/snapshot
```
- Harus selalu tersedia dan jadi **satu-satunya sumber kebenaran** saat client reconnect atau reload.
- SignalR event (`RefreshHint`) **hanya boleh memicu client memanggil snapshot ini lagi** — SignalR sendiri tidak boleh membawa full state sebagai source of truth.

### 4.3 SignalR hub

```
/hubs/queue
```
Event minimal yang harus dipublikasikan:
- `RefreshHint` — sinyal "ada perubahan, silakan re-fetch snapshot". Tidak membawa payload state penuh.
- `AnnouncementVersion` — nomor versi naik setiap ada antrean baru yang harus diumumkan; dipakai client untuk memutuskan kapan audio boleh diputar (mencegah re-play saat reconnect biasa).

Reconnect policy yang harus didukung server: client boleh reconnect kapan saja tanpa kehilangan event penting, karena client akan selalu menyusul lewat snapshot GET, bukan mengandalkan buffer event yang terlewat.

### 4.4 Auth

```
POST /api/auth/token
```
- JWT REST, dipakai kiosk untuk aksi (ambil nomor, submit transaksi).
- Display umumnya read-only, bisa pakai token dengan scope terbatas atau public read endpoint tanpa auth (tergantung kebijakan keamanan jaringan internal — perlu diputuskan terpisah).

### 4.5 Heartbeat (opsional, untuk monitoring nanti)

```
POST /api/devices/{deviceId}/heartbeat
```
- Tidak wajib untuk V1, tapi kontrak ini sebaiknya sudah disiapkan di backend agar sisi frontend tinggal panggil saat monitoring diaktifkan.

### 4.6 Versi aset statis (untuk auto-refresh, bukan kontrak backend API tapi kontrak file statis)

```
GET /kiosk/version.json
GET /display/version.json
```
- Digenerate saat build, bukan oleh backend — tapi perlu disepakati formatnya sama untuk kedua app:
```json
{ "version": "2026.07.23-abc1234", "builtAt": "2026-07-23T10:00:00Z" }
```

---

## Ringkasan keputusan

| Area | Keputusan |
|---|---|
| Routing | Path-based (`/kiosk/{id}`, `/display/{id}`), satu IIS site, SPA fallback via `web.config` rewrite |
| Repo | Monorepo (pnpm workspaces + Turborepo), `apps/*` + `packages/*` |
| Kontrak bersama | `shared-types` dan `signalr-client` sebagai single source of truth |
| Versioning | Changesets untuk packages, `version.json` per app untuk auto-refresh |
| Print proxy | Tidak berubah, di luar scope |
| Backend | Hanya syarat kontrak (snapshot GET, SignalR RefreshHint/AnnouncementVersion, device config, auth) — implementasi di luar scope |
