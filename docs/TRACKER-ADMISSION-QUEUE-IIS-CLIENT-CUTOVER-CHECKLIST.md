# Tracker–Admission Queue — IIS Client Cutover Checklist

> **Operational mirror** of `b09-bilreg-api/docs/contexts/pasien-tracker/TRACKER-ADMISSION-QUEUE-IIS-CLIENT-CUTOVER-CHECKLIST.md`.  
> Prefer editing the b09 canonical copy, then re-sync here for monorepo ops.

**Artifact role:** OPERATION — Kiosk + Display IIS packaging and cutover gates  
**Audience:** Engineering, integration ops, Admisi operations  
**Phase:** External clients **C4**  
**Canonical report:** [tracker-c4-integration-deployment-implementation-report.md](./tracker-c4-integration-deployment-implementation-report.md)  
**Procedures:** [TRACKER-ADMISSION-QUEUE-RUNBOOK.md](./TRACKER-ADMISSION-QUEUE-RUNBOOK.md) §§8–11  
**Architecture:** [kiosk-queue-display-web.md](./kiosk-queue-display-web.md)

Production hospital-wide cutover execution remains site-owned. Use this checklist for **integration** (and site rehearsal) of Officer + Kiosk + Display against Bilreg Admission Queue v1.

---

## Preflight (backend)

| Gate | Evidence | Done |
|------|----------|------|
| `GET /api/v1/admission-queue/rollout/status` → `allSchemaReady: true` | Archive JSend response | [ ] |
| `workstationMappingsUnique: true` and non-zero mapping count | Same response | [ ] |
| Ops-approved Service Point seed active | At least one active point for kiosk offerings | [ ] |
| `AdmissionQueueApi:Workstations` maps every officer Loket used in E2E | `appsettings` / env | [ ] |
| Edge strips/overwrites `X-Workstation-Key` / `X-Loket-Key` | Edge config note | [ ] |
| Backend rollout R1–R3 acceptable | [Rollout checklist](./TRACKER-ADMISSION-QUEUE-ROLLOUT-CHECKLIST.md) | [ ] |

---

## Build (monorepo `c013-kiosk-queue-display-web`)

| Gate | Evidence | Done |
|------|----------|------|
| `pnpm install` + `pnpm build` succeeds | CI or local log | [ ] |
| `apps/kiosk-web/dist` contains `index.html`, `version.json`, `web.config`, `devices.json`, `assets/` | Dir listing | [ ] |
| `apps/display-web/dist` contains `index.html`, `version.json`, `web.config`, `devices.json`, `assets/` | Dir listing | [ ] |
| Build-time API base / token policy documented for the target env | `.env` / release notes (no secrets in git) | [ ] |

---

## Deploy (single IIS site)

| Gate | Evidence | Done |
|------|----------|------|
| Backup previous `wwwroot/kiosk` and `wwwroot/display` (if any) | Dated folder or zip | [ ] |
| Copy kiosk dist → `wwwroot/kiosk` | IIS physical path | [ ] |
| Copy display dist → `wwwroot/display` | IIS physical path | [ ] |
| URL Rewrite available; SPA `web.config` present under each folder | IIS / file check | [ ] |
| Deep link `http://<host>/kiosk/{stationId}` loads SPA (not 404) | Browser | [ ] |
| Deep link `http://<host>/display/{screenId}` loads SPA (not 404) | Browser | [ ] |
| `index.html` and `version.json` served with `Cache-Control: no-cache` (or equivalent) | Response headers | [ ] |

Physical layout reminder:

```text
C:\inetpub\wwwroot\
├── kiosk\      ← kiosk-web dist/
└── display\    ← display-web dist/
```

---

## Device & Officer config

| Gate | Evidence | Done |
|------|----------|------|
| Every Chrome kiosk shortcut ID has a matching `devices.json` (or future device-config API) row | Config review | [ ] |
| Kiosk rows: `role: kiosk`, non-empty offerings / service-point allow-list | Config | [ ] |
| Display rows: `role: display`, non-empty `loketIds` | Config | [ ] |
| Officer `global_config.json` `admissionQueue.enabled` (and workstation keys) set for the env | `c012` config | [ ] |
| Display `loketIds` overlap officer workstation Lokets used in smoke | Mapping table | [ ] |

---

## Print proxy (kiosk PC)

| Gate | Evidence | Done |
|------|----------|------|
| Local print proxy listening on configured port (default 5050) | Health check | [ ] |
| One successful ticket print after intake (or documented deferral if printer unavailable) | Ops note | [ ] |

---

## Cross-client E2E

| Gate | Evidence | Done |
|------|----------|------|
| Full runbook §11 smoke completed (all 7 steps) | Ops log with Queue Labels / times | [ ] |
| No Sev-1 client defects open | Defect tracker | [ ] |

Procedure: [TRACKER-ADMISSION-QUEUE-RUNBOOK.md](./TRACKER-ADMISSION-QUEUE-RUNBOOK.md) §11.

---

## Explicit Go / No-Go

| Verdict | When |
|---------|------|
| **GO** (client IIS integration) | Preflight + build + deploy + device/Officer config checked; E2E §11 green (or printer step explicitly deferred with owner) |
| **NO-GO** | SPA deep-link fails, missing device rows, rollout status red, E2E step failure, or unresolved Sev-1 |

Archive: build version (`version.json`), IIS host, rollout status response, E2E log.

---

## Rollback (client folders only)

| Situation | Action |
|-----------|--------|
| Bad kiosk/display static build | Restore previous `wwwroot/kiosk` and/or `wwwroot/display` backup |
| Wrong device config | Fix `devices.json` (or device API) and soft-reload / reopen shortcut — **no** DB DROP |
| Officer flag regression | Revert `admissionQueue` flags in `global_config` / redeploy previous HIS |
| Backend defect | Follow backend runbook rollback — do **not** DROP AQ tables for client-only issues |

---

## Related

| Path | Role |
|------|------|
| [tracker-c4-integration-deployment-implementation-report.md](./tracker-c4-integration-deployment-implementation-report.md) | C4 closure |
| [TRACKER-ADMISSION-QUEUE-RUNBOOK.md](./TRACKER-ADMISSION-QUEUE-RUNBOOK.md) | Full procedures |
| [TRACKER-ADMISSION-QUEUE-ROLLOUT-CHECKLIST.md](./TRACKER-ADMISSION-QUEUE-ROLLOUT-CHECKLIST.md) | Backend R1–R5 + client R6 |
| [kiosk-queue-display-web.md](./kiosk-queue-display-web.md) | Path / IIS ADR |
