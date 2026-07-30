# c013-kiosk-queue-display-web

Monorepo for **Admission Queue Kiosk**, **Queue Display**, and **Device Configuration** web clients
(Bilreg Admission Queue v1).

Officer Client remains in `c012_myhospital_web`.

## Apps

| App | IIS path | Status |
|-----|----------|--------|
| `kiosk-web` | `/kiosk/{stationId}` | **C2 complete** - path boot, intake, local print/reprint |
| `display-web` | `/display/{screenId}` | **C3 complete** - snapshot-first, SignalR hint, TTS, version reload |
| `config-web` | `/queue-config/` | **D0–D7** - workstation/display configuration (interactive login) |

**C4 (ops):** Cross-client E2E + IIS cutover - start at [docs/README.md](docs/README.md) (local mirrors of b09 ops artifacts).

Device configuration plan/report:
[docs/TRACKER-ADMISSION-QUEUE-DEVICE-CONFIGURATION-IMPLEMENTATION-PLAN.md](docs/TRACKER-ADMISSION-QUEUE-DEVICE-CONFIGURATION-IMPLEMENTATION-PLAN.md),
[docs/tracker-d0-d7-device-configuration-implementation-report.md](docs/tracker-d0-d7-device-configuration-implementation-report.md).

## Setup

```bash
pnpm install
# Set up global runtime config (used in production and dev)
cp apps/kiosk-web/public/global_config.example.json apps/kiosk-web/public/global_config.json
cp apps/display-web/public/global_config.example.json apps/display-web/public/global_config.json
cp apps/config-web/public/global_config.example.json apps/config-web/public/global_config.json
# Edit global_config.json in each app to set your bilregApiBase

# Set up local dev server config (for Vite proxy and tokens)
cp apps/kiosk-web/.env.example apps/kiosk-web/.env.local
cp apps/display-web/.env.example apps/display-web/.env.local
cp apps/config-web/.env.example apps/config-web/.env.local
# Display: set VITE_BILREG_API_BASE in .env.local (used by Vite proxy)
pnpm dev:kiosk
# or
pnpm dev:display
# or
pnpm dev:config
```

Kiosk: `http://localhost:5173/kiosk/loket-03` (mock: `loket-03`, `loket-07`).  
Display: `http://localhost:5174/display/lobby-poli-1` (mock: `lobby-poli-1`, `lobby-igd`).  
Config: `http://localhost:5175/queue-config/`.

## Environment & Configuration

Applications are configured post-deployment via `public/global_config.json`.
Local development uses `.env.local` for Vite proxy configuration and tokens.

| Variable/Config | Purpose |
|----------|---------|
| `global_config.json -> bilregApiBase` | Bilreg API root including `/api` (e.g. `http://localhost:5000/api`) |
| `VITE_BILREG_API_BASE` | Local dev only: Vite proxy target |
| `VITE_BILREG_TOKEN` | Local dev only: JWT for testing display REST + SignalR |
| `VITE_DEVICE_CONFIG_PROVIDER` | Display: `api` (default) or `json` emergency/tests |
| `VITE_PUBLIC_ORIGIN` | Config app: public origin for canonical `/display/{id}` URLs |

## Device config

Display boot uses `IDeviceConfigurationProvider`. Production default is `ApiDeviceConfigurationProvider`
(`GET /api/v1/admission-queue/devices/displays/{displayId}`). JSON `devices.json` remains available when
`VITE_DEVICE_CONFIG_PROVIDER=json` is set explicitly (no silent fallback on API failure).
