# display-web

Admission Queue Display client (Phase **C3** complete).

Path: `/display/{screenId}`

## Features

- Device-config boot from `public/devices.json` (`role: display`, `loketIds`)
- Snapshot authority via `GET /api/v1/admission-queue/displays/current` + poll
- SignalR `RefreshHint` → snapshot refetch (never authoritative state)
- AnnouncementVersion-gated Web Speech TTS
- Idle soft reload when `version.json` changes

## Dev

```bash
pnpm --filter display-web dev
# http://localhost:5174/display/lobby-poli-1
```

Requires `VITE_BILREG_API_BASE` and `VITE_BILREG_TOKEN` (see `.env.example`).
