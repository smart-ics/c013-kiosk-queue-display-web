# c013-kiosk-queue-display-web

Monorepo for **Admission Queue Kiosk** and **Queue Display** web clients (Bilreg Admission Queue v1).

Officer Client remains in `c012_myhospital_web`.

## Apps

| App | IIS path | Status |
|-----|----------|--------|
| `kiosk-web` | `/kiosk/{stationId}` | **C2 complete** — path boot, intake, local print/reprint |
| `display-web` | `/display/{screenId}` | **C3 complete** — snapshot-first, SignalR hint, TTS, version reload |

**C4 (ops):** Cross-client E2E + IIS cutover procedures live in `b09-bilreg-api` docs — see [docs/C4-implementation-summary.md](docs/C4-implementation-summary.md).

## Setup

```bash
pnpm install
cp apps/kiosk-web/.env.example apps/kiosk-web/.env.local
cp apps/display-web/.env.example apps/display-web/.env.local
# Set VITE_BILREG_API_BASE and VITE_BILREG_TOKEN
pnpm dev:kiosk
# or
pnpm dev:display
```

Kiosk: `http://localhost:5173/kiosk/loket-03` (mock: `loket-03`, `loket-07`).  
Display: `http://localhost:5174/display/lobby-poli-1` (mock: `lobby-poli-1`, `lobby-igd`).

## Environment

| Variable | Purpose |
|----------|---------|
| `VITE_BILREG_API_BASE` | Bilreg API root including `/api` (e.g. `http://localhost:5000/api`) |
| `VITE_BILREG_TOKEN` | JWT for authenticated AQ REST + SignalR (env-driven; no device login yet) |

## Device config

Boot uses `IDeviceConfigurationProvider` with a local JSON mock (`public/devices.json` per app). Unknown path IDs fail closed. When `GET /api/devices/{id}/config` lands, only the provider implementation changes.

## Print (C2.1 — kiosk only)

| Rule | Behavior |
|------|----------|
| Auto-print | After successful intake, print Queue Label ticket once via local proxy |
| Reprint | “Cetak ulang” reprints the **same** committed label; never re-intakes |
| Uncertain intake | Network/`status === 0` failures warn about possible duplicates; retry is deliberate only |
| Proxy contract | `POST http://localhost:{port}/print/?type=image&doctype=antrian&printCopies=1` with PNG body |

Requires the thermal print proxy process on the kiosk PC.

## Display (C3)

| Rule | Behavior |
|------|----------|
| Snapshot authority | `GET .../displays/current` only |
| SignalR | `RefreshHint` triggers refetch; never carries display truth |
| Audio | TTS only when snapshot `announcementVersion` increases (seed on cold start) |
| Auto-refresh | Idle soft reload when `version.json` changes |

## Build / IIS

```bash
pnpm build
```

Copy `apps/kiosk-web/dist` → `wwwroot/kiosk`, `apps/display-web/dist` → `wwwroot/display`. Each dist includes `web.config` (SPA rewrite) and `version.json`.

## Docs

- [docs/C2-implementation-summary.md](docs/C2-implementation-summary.md)
- [docs/C3-implementation-summary.md](docs/C3-implementation-summary.md)
- [docs/C4-implementation-summary.md](docs/C4-implementation-summary.md) — E2E + IIS cutover (canonical report in b09)
