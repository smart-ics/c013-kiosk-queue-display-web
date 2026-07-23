# c013-kiosk-queue-display-web

Monorepo for **Admission Queue Kiosk** and **Queue Display** web clients (Bilreg Admission Queue v1).

Officer Client remains in `c012_myhospital_web`.

## Apps

| App | IIS path | Status |
|-----|----------|--------|
| `kiosk-web` | `/kiosk/{stationId}` | **C2 complete** — path boot, intake, local print/reprint |
| `display-web` | `/display/{screenId}` | Stub (C3) |

## Setup

```bash
pnpm install
cp apps/kiosk-web/.env.example apps/kiosk-web/.env.local
# Set VITE_BILREG_API_BASE and VITE_BILREG_TOKEN
pnpm dev:kiosk
```

Open `http://localhost:5173/kiosk/loket-03` (mock station IDs: `loket-03`, `loket-07`).

## Environment

| Variable | Purpose |
|----------|---------|
| `VITE_BILREG_API_BASE` | Bilreg API root including `/api` (e.g. `http://localhost:5000/api`) |
| `VITE_BILREG_TOKEN` | JWT for authenticated AQ calls (env-driven; no device login in C2) |

## Device config (C2)

Boot uses `IDeviceConfigurationProvider` with a local JSON mock (`public/devices.json`). Unknown `stationId` fails closed. Optional `printerProxyPort` (default **5050**) selects the local print proxy. When `GET /api/devices/{id}/config` lands, only the provider implementation changes.

## Print (C2.1)

| Rule | Behavior |
|------|----------|
| Auto-print | After successful intake, print Queue Label ticket once via local proxy |
| Reprint | “Cetak ulang” reprints the **same** committed label; never re-intakes |
| Uncertain intake | Network/`status === 0` failures warn about possible duplicates; retry is deliberate only |
| Proxy contract | `POST http://localhost:{port}/print/?type=image&doctype=antrian&printCopies=1` with PNG body |

Requires the thermal print proxy process on the kiosk PC.

## Build / IIS

```bash
pnpm build
```

Copy `apps/kiosk-web/dist` → `wwwroot/kiosk`, `apps/display-web/dist` → `wwwroot/display`. Each dist includes `web.config` (SPA rewrite) and `version.json`.

## Docs

See [docs/C2-implementation-summary.md](docs/C2-implementation-summary.md) (points to the Bilreg C2 report).
