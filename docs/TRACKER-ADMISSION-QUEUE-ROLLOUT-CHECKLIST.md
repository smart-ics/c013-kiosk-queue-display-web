# Tracker–Admission Queue — Rollout Go / No-Go Checklist

> **Operational mirror** of `b09-bilreg-api/docs/contexts/pasien-tracker/TRACKER-ADMISSION-QUEUE-ROLLOUT-CHECKLIST.md`.  
> Prefer editing the b09 canonical copy, then re-sync here for monorepo ops.

**Artifact role:** OPERATION — integration rollout gates  
**Audience:** Engineering, DBA, Admisi operations  
**Plan:** [TRACKER-ADMISSION-QUEUE-IMPLEMENTATION-PLAN.md](../../b09-bilreg-api/docs/contexts/pasien-tracker/TRACKER-ADMISSION-QUEUE-IMPLEMENTATION-PLAN.md) Phase 5 (sibling repo)  
**Runbook:** [TRACKER-ADMISSION-QUEUE-RUNBOOK.md](./TRACKER-ADMISSION-QUEUE-RUNBOOK.md)

Production cutover is **out of scope** of this checklist. Use it for integration environment readiness and compatibility closure.

---

## Pre-requisites (Phases 1–4)

| Gate | Evidence | Done |
|------|----------|------|
| Phase 1 real-SQL race / rollback / volume gate | [phase1 verification report](./tracker-admission-queue-phase1-slice1-verification-report.md) | [ ] |
| Phase 2 officer contracts + Admisi enrichment | [phase2 report](./tracker-admission-queue-phase2-officer-contracts-implementation-report.md) | [ ] |
| Phase 3 booking-assistance receive-side | [phase3 report](./tracker-admission-queue-phase3-booking-assistance-implementation-report.md) | [ ] |
| Phase 4 SignalR refresh adapter | [phase4 report](./tracker-admission-queue-phase4-signalr-refresh-implementation-report.md) | [ ] |
| No unresolved severity-one concurrency/data defect | Phase 1 exit + no open Sev-1 after re-run | [ ] |

---

## R1 — Database

| Engineering | Operations | Done |
|-------------|------------|------|
| Apply scripts in [manifest](../../b09-bilreg-api/src/bilreg/Bilreg.SqlDb/AdmisiContext/BILRG_AdmissionQueue_MigrationManifest.md) order | Confirm tables/indexes via SQL or rollout status | [ ] |
| Apply Ops-approved Service Point seed | Active prefixes unique; at least one active point | [ ] |
| Rollback script available (`BILRG_AdmissionQueue_Rollback.sql`) | Backup taken before first write on shared integration DB | [ ] |
| Re-run Phase 1 real-SQL filter on target SQL (if available) | Archive test log | [ ] |

---

## R2 — Application / workstation / edge

| Engineering | Operations | Done |
|-------------|------------|------|
| Deploy Bilreg.Api with Phase 5 build | JWT auth unchanged | [ ] |
| `AdmissionQueueApi:Workstations` unique mappings configured | Each officer Loket has one workstation key | [ ] |
| Edge strips/overwrites `X-Workstation-Key` / `X-Loket-Key` | Spoofing path documented and blocked | [ ] |
| `GET /api/v1/admission-queue/rollout/status` → `allSchemaReady: true`, `workstationMappingsUnique: true` | Archive response | [ ] |
| `SignalRRefreshEnabled` set per env policy | Display team knows polling recovery path | [ ] |

---

## R3 — API smoke / recovery / load

| Check | Done |
|-------|------|
| Intake → worklist → Call → `displays/current` happy path | [ ] |
| Header mismatch / unmapped workstation rejected (400) | [ ] |
| App recycle; `displays/current` recovers persisted snapshot | [ ] |
| Load smoke acceptable (Phase 1 volume evidence or re-run) | [ ] |
| Focused AQ unit/contract suite green | [ ] |

---

## R4 — Legacy compatibility disposition

| Route / path | Observation | Disposition decision | Done |
|--------------|-------------|----------------------|------|
| `POST /api/Antrian/anonymous-intake` | `LegacyEndpointsEnabled` + warning log | Keep enabled / disable after consumer verify | [ ] |
| `POST /api/Antrian/start` | Same gate | Keep enabled / disable after consumer verify | [ ] |
| `PATCH .../mulaiPeriksa` / `selesaiPeriksa` | Ungated physician/compat; warning log | Remain (physician); not officer AQ v1 | [ ] |
| Registration create-on-queue (no prior intake) | Compatibility path | Inventory consumers; document go/no-go | [ ] |

No deprecation date is invented here. Product ownership supplies dates after verified consumer migration.

**Go criteria for legacy:** either (a) no known consumers and gate may be disabled in this env, or (b) known consumers remain and gate stays enabled with observation.

---

## R5 — Explicit Go / No-Go (backend)

| Verdict | When |
|---------|------|
| **GO** (integration backend) | All R1–R3 checked; R4 disposition recorded; no open Sev-1; rollout status green |
| **NO-GO** | Missing schema/seed, duplicate workstation keys, failing race gate, unresolved Sev-1, or unknown critical legacy consumers without observation plan |

Signed evidence (ops log + rollout status response + test filter output) should be archived with the environment name and date.

---

## R6 — External clients (Phase C4)

Officer + Kiosk + Display constellation. Detailed gates: [TRACKER-ADMISSION-QUEUE-IIS-CLIENT-CUTOVER-CHECKLIST.md](./TRACKER-ADMISSION-QUEUE-IIS-CLIENT-CUTOVER-CHECKLIST.md). Evidence: [tracker-c4-integration-deployment-implementation-report.md](./tracker-c4-integration-deployment-implementation-report.md).

| Gate | Evidence | Done |
|------|----------|------|
| Officer `admissionQueue` enabled; workstation headers work | `c012` smoke (runbook §8) | [ ] |
| Kiosk + Display built and copied to `wwwroot/kiosk` / `wwwroot/display` | Dist listing + IIS paths | [ ] |
| SPA deep links `/kiosk/{stationId}` and `/display/{screenId}` load | Browser | [ ] |
| Device config row per shortcut ID | `devices.json` (or device API) review | [ ] |
| Cross-client E2E runbook §11 (all 7 steps) | Ops log | [ ] |
| IIS cutover checklist Go | Signed checklist | [ ] |

**Go criteria for clients:** R5 backend GO (or equivalent green backend) **and** R6 gates checked. Client-only No-Go does not require AQ table DROP — restore previous static folders.

---

## Rollback (if No-Go after deploy)

| Situation | Action |
|-----------|--------|
| Application defect | Previous binary |
| Config only | Fix `AdmissionQueueApi` + recycle |
| Disposable schema | `BILRG_AdmissionQueue_Rollback.sql` after backup |
| Quiet SignalR / legacy | Feature flags only |
| Bad kiosk/display static | Restore `wwwroot/kiosk` / `wwwroot/display` backup (see IIS client cutover checklist) |

---

## Related

| Path | Role |
|------|------|
| [TRACKER-ADMISSION-QUEUE-RUNBOOK.md](./TRACKER-ADMISSION-QUEUE-RUNBOOK.md) | Procedures |
| [TRACKER-ADMISSION-QUEUE-IIS-CLIENT-CUTOVER-CHECKLIST.md](./TRACKER-ADMISSION-QUEUE-IIS-CLIENT-CUTOVER-CHECKLIST.md) | Client IIS cutover |
| [TRACKER-ADMISSION-QUEUE-API-V1.md](./TRACKER-ADMISSION-QUEUE-API-V1.md) | Contracts |
| [tracker-admission-queue-phase5-rollout-implementation-report.md](./tracker-admission-queue-phase5-rollout-implementation-report.md) | Phase 5 delivery evidence |
| [tracker-c4-integration-deployment-implementation-report.md](./tracker-c4-integration-deployment-implementation-report.md) | C4 client integration closure |
