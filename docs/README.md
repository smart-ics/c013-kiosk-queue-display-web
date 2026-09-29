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
| [IIS_INSTALL_GUIDE.id.md](./IIS_INSTALL_GUIDE.id.md) | IIS install steps (Bahasa Indonesia) |
| [TRACKER-ADMISSION-QUEUE-DEVICE-CONFIGURATION-IMPLEMENTATION-PLAN.md](./archive/plans/TRACKER-ADMISSION-QUEUE-DEVICE-CONFIGURATION-IMPLEMENTATION-PLAN.md) | Workstation, Queue Display, segmentation, and third-app implementation plan |

## Domain & decisions

| Doc | Contents |
|-----|----------|
| [kiosk-canonical.md](./kiosk-canonical.md) | Kiosk intake contract, flow states, related docs index |
| [domain-model.md](./domain-model.md) | Entities, aggregates, value objects |
| [glossary.md](./glossary.md) | Domain terms (`PATIENT_NOT_REGISTERED`, Patient Context, Deep Search) |
| [adr/](./adr/) | ADR-001 queue ledger · ADR-002 jaminan eligibility · ADR-003 biometric · ADR-004 booking assistance · ADR-005 orchestration state machine · ADR-006 walk-in catalog · ADR-007 seamless login · ADR-008 patient-not-registered failure · ADR-009 re-query/booking continuation · ADR-010 Bahasa Indonesia error messages |

## Active specs & plans

| Doc | Slice |
|-----|-------|
| [superpowers/specs/2026-09-16-patient-search-flow-design.md](./superpowers/specs/2026-09-16-patient-search-flow-design.md) | Patient search cascade (Cases 1–2) |
| [superpowers/specs/2026-09-11-reprint-any-identifier-design.md](./superpowers/specs/2026-09-11-reprint-any-identifier-design.md) + [plan](./superpowers/plans/2026-09-11-reprint-any-identifier-plan.md) | Reprint by any identifier |
| [superpowers/specs/2026-09-05-display-loket-name-authoritative.md](./superpowers/specs/2026-09-05-display-loket-name-authoritative.md) | Display loket name authority |
| [superpowers/specs/2026-09-02-kiosk-regid-reprint-design.md](./superpowers/specs/2026-09-02-kiosk-regid-reprint-design.md) + [plan](./superpowers/plans/2026-09-02-kiosk-regid-reprint.md) | Kiosk reg-ID reprint |
| [superpowers/plans/2026-09-07-service-point-fallback.md](./superpowers/plans/2026-09-07-service-point-fallback.md) | Service-point fallback |
| [superpowers/plans/2026-09-07-kiosk-label-version-release.md](./superpowers/plans/2026-09-07-kiosk-label-version-release.md) | Kiosk label version release |

## App context

- [context/kiosk-web/README.md](./context/kiosk-web/README.md) — kiosk intake notes
- [context/display-web/announcement-audio.md](./context/display-web/announcement-audio.md) — announcement audio
- [architecture/](./architecture/) — acuan: [kiosk-self-registration-flow.md](./architecture/kiosk-self-registration-flow.md) (CURRENT); arsip: [archive/architecture/](./archive/architecture/); lain: registrasi-langsung, post-deploy config pattern (monorepo)

## Phase reports (historical)

Closed C0–C4 material lives under [archive/](./archive/):

| Doc | Phase |
|-----|-------|
| [tracker-c2-kiosk-implementation-report.md](./archive/reports/tracker-c2-kiosk-implementation-report.md) | C2 Kiosk |
| [tracker-c3-queue-display-implementation-report.md](./archive/reports/tracker-c3-queue-display-implementation-report.md) | C3 Display |
| [tracker-c4-integration-deployment-implementation-report.md](./archive/reports/tracker-c4-integration-deployment-implementation-report.md) | C4 Integration & Deployment |
| [tracker-d0-d7-device-configuration-implementation-report.md](./archive/reports/tracker-d0-d7-device-configuration-implementation-report.md) | D0–D7 Device Configuration |
| [TRACKER-ADMISSION-QUEUE-EXTERNAL-CLIENTS-IMPLEMENTATION-PLAN.md](./archive/plans/TRACKER-ADMISSION-QUEUE-EXTERNAL-CLIENTS-IMPLEMENTATION-PLAN.md) | Part 2 plan (C0–C4 closed) |

Local one-line pointers (historical): [C2](./archive/reports/C2-implementation-summary.md) · [C3](./archive/reports/C3-implementation-summary.md) · [C4](./archive/reports/C4-implementation-summary.md)

## Backend-only paths

SQL migration manifest, seed scripts, and Bilreg.Api `appsettings` live only in **b09-bilreg-api**. Runbook / rollout links to those files point at the sibling repo under `MyHospitalWeb/`.
