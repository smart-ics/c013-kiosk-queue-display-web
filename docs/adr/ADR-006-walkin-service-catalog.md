# ADR-006: Walk-In Service Catalog (Poli → Dokter → Jadwal)

- **Status:** Accepted
- **Date:** 2026-08-03
- **Branch:** feature/kiosk-self-registration
- **Relates:** ADR-002 (walk-in eligibility), ADR-005 (WALKIN_SELECT_SERVICE)

## Context

The go-show walk-in flow requires a poli → dokter → jadwal picker before
registration. The existing kiosk only knows **service points** (registration
counters from `deviceConfig.servicePointIds`), which are a queue concept — not a
clinical catalog. This ADR defines how the kiosk sources the clinical picker.

## Decision (confirmed Q16/Q17)

- The walk-in service catalog comes from **an already-existing HIS endpoint**
  (no new backend to build).
- The picker is **three separate calls** (poli list → dokter per poli → jadwal
  per dokter), not one nested payload.
- Availability is scoped to the **active business date**
  (`GET /api/system/business-date`), same as booking — the kiosk only shows
  today's slots.
- The selected **dokter (ppaId) and jadwal map into the `rajalWalkIn/direct`
  payload**.
- **No service point is involved in the walk-in success path.** The service
  point only appears in the failure fallback (walk-in failure → `/intake`,
  which needs a `servicePointId` picker per ADR-004).

## Consequences

- `WALKIN_SELECT_SERVICE` holds a 3-level wizard backed by three queries, all
  keyed on the active business date.
- Service point selection is **purely a queue/fallback concern** — it never
  gates the walk-in registration itself.
- Exact endpoint paths and response schemas for the three calls are **open
  integration items** (flagged; frontend state design proceeds against a typed
  seam).
