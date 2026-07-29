# Tracker–Admission Queue Runbook

> **Operational mirror** of `b09-bilreg-api/docs/contexts/pasien-tracker/TRACKER-ADMISSION-QUEUE-RUNBOOK.md`.  
> Prefer editing the b09 canonical copy, then re-sync here for monorepo ops.

**Audience:** Engineering, DBA, integration ops  
**Scope:** Backend V1 Admission Queue deploy to an **integration** environment, plus Officer / Kiosk / Display client packaging and cross-client E2E (Phase **C4**)  
**Not covered:** Full production hospital cutover execution ownership, SignalR multi-node scale-out, device JWT productization (R-02)

**Related**

| Artifact | Role |
|----------|------|
| [BILRG_AdmissionQueue_MigrationManifest.md](../../b09-bilreg-api/src/bilreg/Bilreg.SqlDb/AdmisiContext/BILRG_AdmissionQueue_MigrationManifest.md) | Script order, guards, indexes, rollback boundary (sibling repo) |
| [TRACKER-ADMISSION-QUEUE-ROLLOUT-CHECKLIST.md](./TRACKER-ADMISSION-QUEUE-ROLLOUT-CHECKLIST.md) | Go / No-Go gates (backend + R6 clients) |
| [TRACKER-ADMISSION-QUEUE-IIS-CLIENT-CUTOVER-CHECKLIST.md](./TRACKER-ADMISSION-QUEUE-IIS-CLIENT-CUTOVER-CHECKLIST.md) | Kiosk/Display IIS cutover gates |
| [TRACKER-ADMISSION-QUEUE-API-V1.md](../api/TRACKER-ADMISSION-QUEUE-API-V1.md) | Versioned API / security boundary |
| [kiosk-queue-display-web.md](../architecture/kiosk-queue-display-web.md) | Path-based IIS + monorepo ADR |
| [tracker-c4-integration-deployment-implementation-report.md](../reports/tracker-c4-integration-deployment-implementation-report.md) | C4 closure evidence |
| Phase 1 verification report | Concurrency / migration proof of record (b09 only) |

---

## 1. Prerequisites

- Disposable or installation-managed **integration** SQL Server (never production for first apply rehearsal)
- Bilreg.Api build that includes Phases 1–4 backend exits
- JWT auth unchanged (no new queue roles; R-02 deferred)
- Approved Service Point seed values (do not use example IDs in production)

---

## 2. Database migrate

Scripts root: `src/bilreg/Bilreg.SqlDb/AdmisiContext/`

Apply in the order documented in the migration manifest (same as `AdmissionQueueMigrationManifest.Scripts`). Greenfield `CREATE TABLE` scripts are not `IF NOT EXISTS`; prefer a fresh empty database for first apply. Guarded scripts may be skipped when the guard table already exists (fixture behavior).

After migrate, confirm critical indexes:

- `UX_BILRG_Antrian_SequenceTag`
- `UX_BILRG_AdmLoketCurrentCall_ActiveEntry`
- `IX_BILRG_AdmLoketCurrentCall_ActiveDisplay`
- `IX_BILRG_AntrianEntry_OperationalWorklist`

Or call authenticated `GET /api/v1/admission-queue/rollout/status` and require `allSchemaReady: true`.

### Seed Service Points

Apply an Ops-approved seed derived from:

`AntrianFeature/BILRG_AdmissionQueue_Seed_ServicePoints.example.sql`

Active `QueuePrefix` values must be unique. Seed at least one active Service Point before Kiosk intake smoke.

---

## 3. Application configuration

`appsettings` section `AdmissionQueueApi`:

```json
{
  "AdmissionQueueApi": {
    "LegacyEndpointsEnabled": true,
    "SignalRRefreshEnabled": true,
    "Workstations": [
      { "WorkstationKey": "ADM-01", "LoketKey": "L1" },
      { "WorkstationKey": "ADM-02", "LoketKey": "L2" }
    ]
  }
}
```

| Setting | Notes |
|---------|--------|
| `Workstations` | Unique `WorkstationKey` and unique `LoketKey` required at startup (`ValidateOnStart`) |
| `LegacyEndpointsEnabled` | Default `true`; set `false` only after consumer inventory go decision |
| `SignalRRefreshEnabled` | Default `true`; `false` binds no-op publisher; queue write truth unchanged |

### Trusted edge (required for Call accountability)

Reverse proxy / API edge **must** strip or overwrite client-supplied `X-Workstation-Key` and `X-Loket-Key`. The API validates mapping consistency but cannot alone prevent spoofing from an untrusted network path.

Officer Loket mutations require both headers; payload `loketKey` must match `X-Loket-Key`; workstation must map to that Loket.

---

## 4. Preflight health

```http
GET /api/v1/admission-queue/rollout/status
Authorization: Bearer <token>
```

Response (JSend `data`) includes:

- `allSchemaReady`, `tables[]`, `indexes[]` — schema preflight
- `legacyEndpointsEnabled`, `signalRRefreshEnabled` — feature flags
- `workstationMappingsUnique`, `workstationMappingCount` — **no keys leaked**

Integration go requires `allSchemaReady: true` and `workstationMappingsUnique: true` with a non-zero mapping count when officers will Call.

---

## 5. Smoke tests

### Focused regression (always)

```powershell
dotnet test src/bilreg/Bilreg.Test/Bilreg.Test.csproj `
  --filter "FullyQualifiedName~AdmissionQueueApiContractTest|FullyQualifiedName~AdmissionQueueGetRolloutStatusHandlerTest|FullyQualifiedName~AdmissionQueueMigrationManifestTest|FullyQualifiedName~AdmissionQueueOperationalCommandsTest|FullyQualifiedName~RegistrationOutcomeTest|FullyQualifiedName~BookingAssistanceIntakeTest|FullyQualifiedName~SignalRAdmissionQueueRefreshPublisherTest"
```

### Real-SQL gate (integration SQL configured)

```powershell
$env:BILREG_AQ_IT_SERVER="(local)"
$env:BILREG_AQ_IT_DATABASE="bilreg_aq_it"
dotnet test src/bilreg/Bilreg.Test/Bilreg.Test.csproj `
  --filter "FullyQualifiedName~AdmissionQueue|FullyQualifiedName~QueAnonymous|FullyQualifiedName~BookingAssistance|FullyQualifiedName~RegistrationOutcome|FullyQualifiedName~SequencerAdmission"
```

Fail-closed when env unset. Refuse database names containing `prod` / `production` / `hospital_hpl`.

### API smoke (authenticated, migrated DB)

1. `GET .../service-points?activeOnly=true` — seeded points present  
2. `POST .../intake` — returns QueueLabel  
3. `GET .../worklist?businessDate=yyyy-MM-dd` — includes entry  
4. `POST .../entries/{q}/{n}/call` with valid workstation headers — Outstanding  
5. `GET .../displays/current` — persisted snapshot matches claim  
6. Optional: connect SignalR `/hubs/admission-queue`, confirm non-authoritative `RefreshHint`

### Security-edge smoke

| Case | Expect |
|------|--------|
| Missing `X-Workstation-Key` / `X-Loket-Key` | 400 |
| Payload Loket ≠ header | 400 |
| Unmapped workstation | 400 |
| Workstation mapped to another Loket | 400 |
| Duplicate workstation/Loket in config | App fails `ValidateOnStart` |

### Restart / recovery

1. Call an entry; note `AnnouncementVersion` from `GET displays/current`  
2. Recycle Bilreg.Api  
3. Re-read `GET displays/current` — snapshot must match pre-restart persisted claim (SignalR not required)

### Load smoke

Phase 1 volume evidence (400 entries + 20 Loket claims; worklist page 100 and current-display under 5s) remains the proof of record. Re-run `AdmissionQueueRealSqlGateTest` volume scenario on the target integration SQL before promoting.

---

## 6. Rollback

| Situation | Action |
|-----------|--------|
| App defect / bad binary | Redeploy previous Bilreg.Api |
| Need to quiet legacy AQ routes | `LegacyEndpointsEnabled: false` + recycle |
| Need to quiet SignalR | `SignalRRefreshEnabled: false` + recycle (writes unchanged) |
| Disposable DB full removal | Backup → `BILRG_AdmissionQueue_Rollback.sql` |
| Production with retained data | **Never** DROP TABLE; disable flags + previous binary |

Rollback SQL does **not** drop `ta_*` physician maps or `BILRG_PasienTracker*`.

---

## 7. Legacy observation

Warning logs exist on legacy `POST /api/Antrian/anonymous-intake`, `POST /api/Antrian/start`, and physician `mulaiPeriksa` / `selesaiPeriksa`. Inventory disposition is decided on the go/no-go checklist — Phase 5 does not invent a deprecation date.

---

## 8. Officer Client (`c012_myhospital_web`)

Officer remains in HIS Admisi. Do not move it into the kiosk/display monorepo.

### Config

- Runtime `global_config.json` block `admissionQueue` (enable flag, workstation keys / Loket mapping as used by the Officer UI).
- Loket mutations send `X-Loket-Key` + `X-Workstation-Key` (edge must strip/overwrite — §3).
- Feature flag: `admissionQueue.enabled`; legacy sidebar fallback only when product requires it.

### Smoke (Officer alone)

1. Open Admisi Registrasi Rajal with AQ sidebar enabled.  
2. Confirm officer worklist loads (`GET /api/v1/admisi-rajal/officer-worklist` or composed path used by C1).  
3. Call → Recall → Start Service on a seeded entry with valid workstation headers.  
4. Force a second Call on the same Loket while Outstanding → expect **409** and UI reload.

Full constellation proof is §11.

---

## 9. Kiosk + Display Clients (`c013-kiosk-queue-display-web`)

### Build

```bash
cd c013-kiosk-queue-display-web
pnpm install
# Configure env for the target Bilreg API (do not commit secrets):
#   VITE_BILREG_API_BASE, VITE_BILREG_TOKEN
pnpm build
```

| Output | Copy to IIS |
|--------|-------------|
| `apps/kiosk-web/dist/` | `wwwroot/kiosk/` |
| `apps/display-web/dist/` | `wwwroot/display/` |

Each dist must include `index.html`, `assets/`, `version.json`, and `web.config`. Display-web also currently includes `devices.json`; kiosk-web resolves its managed configuration from `GET /api/v1/admission-queue/devices/kiosks/{stationId}`.

### Device config

- Path ID = URL segment: `/kiosk/{stationId}`, `/display/{screenId}`.  
- Every Chrome shortcut ID needs a matching device row (`role`, offerings / `loketIds`, optional `printerProxyPort`, poll/audio flags).  
- Unknown ID or wrong role → boot fails closed (no silent fallback).

### Auth (V1)

Env-baked JWT (`VITE_BILREG_TOKEN`) for REST + SignalR. Device login / R-02 roles are deferred.

### Print (kiosk PC only)

- Local thermal print proxy on `localhost:{printerProxyPort||5050}`.  
- After intake: print committed Queue Label once; reprint uses the **same** label only (never re-intake for reprint).

### Dev URLs (optional)

| App | Local |
|-----|--------|
| Kiosk | `http://localhost:5173/kiosk/loket-03` |
| Display | `http://localhost:5174/display/lobby-poli-1` |

---

## 10. IIS packaging (single site)

Physical layout:

```text
C:\inetpub\wwwroot\
├── kiosk\           ← kiosk-web dist/
│   ├── index.html
│   ├── version.json
│   ├── devices.json
│   ├── assets\
│   └── web.config   ← SPA rewrite → /kiosk/index.html
└── display\         ← display-web dist/
    ├── index.html
    ├── version.json
    ├── devices.json
    ├── assets\
    └── web.config
```

Examples:

```text
http://<host-or-ip>/kiosk/loket-03
http://<host-or-ip>/display/lobby-poli-1
```

Chrome kiosk shortcut:

```text
chrome.exe --kiosk --edge-kiosk-type=fullscreen http://192.168.10.5/kiosk/loket-03
```

| Concern | Guidance |
|---------|----------|
| SPA deep links | URL Rewrite + `web.config` so non-file paths rewrite to each app’s `index.html` |
| Cache | `index.html` and `version.json` → `Cache-Control: no-cache`; hashed Vite assets may use long `max-age` |
| TLS | On-prem HTTP LAN must be segmented; JWT/SignalR travel in cleartext without TLS |
| New device | New shortcut + device-config row — **no** rebuild if config already allows the ID |
| Cutover gates | [TRACKER-ADMISSION-QUEUE-IIS-CLIENT-CUTOVER-CHECKLIST.md](./TRACKER-ADMISSION-QUEUE-IIS-CLIENT-CUTOVER-CHECKLIST.md) |

---

## 11. Cross-client E2E smoke (Phase C4)

Prerequisites: §§1–5 backend green; §§8–10 Officer + Kiosk + Display deployed; device rows and workstation maps aligned on the same Lokets.

| Step | Action | Expect |
|------|--------|--------|
| 1 | Open `/kiosk/{stationId}`; select Service Point; intake | Queue Label shown; Officer worklist includes the entry |
| 2 | Officer **Call** that entry | Display snapshot shows label; `AnnouncementVersion` increases; TTS plays once (if audio enabled) |
| 3 | Officer **Start Service** | Display updates via SignalR `RefreshHint` and/or poll (snapshot still authority) |
| 4 | Complete **Established** registration outcome | Entry leaves officer worklist |
| 5 | Stop / break SignalR (hub recycle or `SignalRRefreshEnabled: false` temporarily) | Display keeps updating via poll; no blank authority from hints |
| 6 | Call an entry; attempt second Call on same Loket while Outstanding | **409**; Officer reloads worklist/snapshot |
| 7 | Deploy new build with changed `version.json`; leave kiosk/display idle | Soft reload when idle (no manual browser visit) |

Archive Queue Labels, timestamps, and `version.json` values with the environment name.

Client folder rollback (no DB DROP): restore previous `wwwroot/kiosk` / `wwwroot/display` backups — see IIS cutover checklist.
