# Docs — Kiosk & Queue Display

Operational mirrors and local pointers for deploying and maintaining `kiosk-web`, `display-web`, and
the planned `config-web`.

**Canonical source of truth** for these Tracker / Admission Queue artifacts is:

`b09-bilreg-api/docs/contexts/pasien-tracker/`

Re-copy from that folder when backend/ops docs change. Client-facing procedures below are intended to work **inside this monorepo** without opening b09 for day-to-day IIS cutover.

## Deploy & maintenance (start here)

| Doc | Use when |
|-----|----------|
| [TRACKER-ADMISSION-QUEUE-IIS-CLIENT-CUTOVER-CHECKLIST.md](./ops/TRACKER-ADMISSION-QUEUE-IIS-CLIENT-CUTOVER-CHECKLIST.md) | IIS Go / No-Go for kiosk + display |
| [TRACKER-ADMISSION-QUEUE-RUNBOOK.md](./ops/TRACKER-ADMISSION-QUEUE-RUNBOOK.md) | Full migrate/config/smoke + §§8–11 client E2E |
| [TRACKER-ADMISSION-QUEUE-ROLLOUT-CHECKLIST.md](./ops/TRACKER-ADMISSION-QUEUE-ROLLOUT-CHECKLIST.md) | Backend R1–R5 + client **R6** |
| [kiosk-queue-display-web.md](./architecture/kiosk-queue-display-web.md) | Path-based IIS + monorepo ADR |
| [TRACKER-ADMISSION-QUEUE-API-V1.md](./api/TRACKER-ADMISSION-QUEUE-API-V1.md) | REST / SignalR / error contract |
| [TRACKER-ADMISSION-QUEUE-DEVICE-CONFIGURATION-IMPLEMENTATION-PLAN.md](./plans/TRACKER-ADMISSION-QUEUE-DEVICE-CONFIGURATION-IMPLEMENTATION-PLAN.md) | Workstation, Queue Display, segmentation, and third-app implementation plan |

## Phase reports

| Doc | Phase |
|-----|-------|
| [tracker-c2-kiosk-implementation-report.md](./reports/tracker-c2-kiosk-implementation-report.md) | C2 Kiosk |
| [tracker-c3-queue-display-implementation-report.md](./reports/tracker-c3-queue-display-implementation-report.md) | C3 Display |
| [tracker-c4-integration-deployment-implementation-report.md](./reports/tracker-c4-integration-deployment-implementation-report.md) | C4 Integration & Deployment |
| [TRACKER-ADMISSION-QUEUE-EXTERNAL-CLIENTS-IMPLEMENTATION-PLAN.md](./plans/TRACKER-ADMISSION-QUEUE-EXTERNAL-CLIENTS-IMPLEMENTATION-PLAN.md) | Part 2 plan (C0–C4 closed) |

Local one-line pointers (historical): [C2](./reports/C2-implementation-summary.md) · [C3](./reports/C3-implementation-summary.md) · [C4](./reports/C4-implementation-summary.md)

## Backend-only paths

SQL migration manifest, seed scripts, and Bilreg.Api `appsettings` live only in **b09-bilreg-api**. Runbook / rollout links to those files point at the sibling repo under `MyHospitalWeb/`.
