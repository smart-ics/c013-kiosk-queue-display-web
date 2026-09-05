# ADR: LoketName di Display Dari LoketKey (client-only)

- **Status**: Accepted
- **Date**: 2026-09-05
- **Deciders**: via /grill-with-docs session
- **Scope**: `c013-kiosk-queue-display-web/apps/display-web` (C3) — no backend change

## Context

`GET /api/v1/admission-queue/devices/displays/{displayId}/snapshot` mengembalikan
`CurrentLoketDisplayItem` yang **hanya punya `loketKey`**, tidak ada `loketName`.
Di domain ini `LoketKey` adalah **key sekaligus nama loket** (mis. `L1`, `L3`, `L101`, `ADM`, `CS`),
dan tidak ada tabel master loket (nama) yang valid.

Akibatnya `display-web` memformat `loketKey` secara "tebak-tebakan":
- `formatLoketTitle('L3')` → `"Loket 3"` (memotong `L`) — DisplayPage.vue
- `buildAnnouncementUtterance` → `"Nomor A0012, loket L1"`
- `buildAudioQueue` untuk `L1` men-strip `L` → `counters/loket-1.wav` (terdengar "loket satu")

Hal ini **salah**: yang benar adalah `"Loket L3"` (visual) dan `"loket el tiga"` (suara),
karena label fisik loket adalah `L3`, bukan `3`.

## Decision

**Pendekatan B — client-only.** Tidak ada perubahan API/backend. `display-web` memperlakukan
`loketKey` sebagai **nama loket yang otoritatif** dan menampilkannya apa adanya:

1. **`formatLoketTitle`** (DisplayPage.vue) → `Loket ${loketKey}` (tanpa regex strip `L`).
   - `L3` → `"Loket L3"`, `L101` → `"Loket L101"`, `ADM` → `"Loket ADM"`.
2. **`buildAnnouncementUtterance`** (announcementGate.ts) → `Nomor ${label}, menuju Loket ${loketKey}`.
3. **`buildAudioQueue`** (announcementGate.ts) →
   - Pure number 1-10: tetap gunakan `counters/loket-N.wav` (backward compat).
   - Semua lainnya: `phrases/loket.wav` + eja per-chunk (huruf → `letters/<ch>.wav`, angka → `decomposeNumber`).
     - `L1` → `letters/l.wav` + `numbers/1.wav` ("loket el satu")
     - `L101` → `letters/l.wav` + `numbers/100.wav` + `numbers/1.wav`
     - `ADM` → `letters/a.wav` + `letters/d.wav` + `letters/m.wav`
   - `loketKey` **tidak pernah dipotong**.

## Consequences

- Visual hero + kartu "DAFTAR LOKET AKTIF" sekarang menunjukkan nama yang valid.
- Audio sekarang sejajar dengan label visual (dibaca "loket el tiga" bukan "loket satu").
- `LoketKey` yang berupa angka murni 1-10 tetap memakai recording gabungan yang ada
  (tidak perlu asset baru).
- Tidak ada perubahan kontrak API, migration, atau data. Scope terbatas pada `display-web`.

## Alternatives Rejected

- **A. API + client (tambahkan `loketName` field)** — ditolak: `LoketKey` sudah adalah nama;
  field baru redundan tanpa master nama sungguhan.
- **C. Master loket (`BILRG_AdmLoket`) + API + client** — ditolak: scope besar,
  tidak diperlukan oleh kebutuhan saat ini.

## Follow-ups

- Jika di masa depan ada master nama loket sungguhan (mis. "Loket Pendaftaran"),
  `loketName` dapat ditambahkan ke `CurrentLoketDisplayItem` tanpa memecahkan kontrak
  (field nullable, client fallback ke `loketKey`).