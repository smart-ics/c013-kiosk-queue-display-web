# ADR-003: Biometric Local-Service Contract (Kiosk `/biometrik`)

- **Status:** Accepted (contract shape) / **Endpoint payload+response JSON TBD** (placeholder)
- **Date:** 2026-08-03
- **Branch:** feature/kiosk-self-registration
- **Relates:** ADR-002

## Context

A BPJS booking/walk-in requires biometric verification before SEP creation and
registration. Per AGENTS.md the kiosk must reuse the **existing local
proxy/service pattern** (the same machine-local service that handles printing),
not build a new backend. The PRD documents this as `POST /biometrik`.

The legacy JETLI chain has a *status query*
(`GET {jetliApi}/SEP/finger/peserta/{noPeserta}`) and the PRD describes a
*hardware capture* popup. ADR-002 Q5 resolved that both exist. This ADR pins
down the kiosk-side interaction with the local service.

## Decision

The kiosk makes a **single blocking call** to the local biometric service.
Readiness probing and hardware capture are both encapsulated inside that one
call — the frontend does not separately call JETLI for fingerprint status.

### Flow (confirmed 2026-08-03)

```
POST /biometrik            (from kiosk web → local service)
  │
  ├─ biometric NOT ready ──► local service opens finger-screen animation
  │                            └─ capture SUCCESS ──► close popup → return success
  │                            └─ FAILED / CANCELLED / TIMEOUT → return failure
  │
  └─ biometric ready from the start (rare / ~impossible)
       └─ no animation triggered ──► return success immediately
```

- **Not ready** → service auto-invokes the finger screen; on successful capture
  it closes itself and control returns to the kiosk flow.
- **Ready from the beginning** (nearly impossible) → redirects to the next step
  without ever showing the capture UI.

### Frontend responsibilities

1. Call `POST /biometrik` once, blocking, with a defined timeout.
2. Read the **response status silently** and branch:
   - success/ready → continue to SEP chain (`POST {jetliApi}/Sep` …).
   - failed / cancelled / timeout → route to `booking-assistance`
     (failure code `BIOMETRIC_FAILED` / `BIOMETRIC_TIMEOUT`).
3. Guard against double-call (no re-entry while the capture popup is open).

### Placeholder scope

Exact local-service **request payload and response JSON shape** are not yet
defined (the local service itself is a placeholder). The frontend contract is
fixed now so the orchestrator can be built against a typed seam:

```ts
type BiometricVerdict =
  | { outcome: 'READY' }            // no capture needed
  | { outcome: 'SUCCESS' }          // captured just now
  | { outcome: 'FAILED' | 'CANCELLED' | 'TIMEOUT' }
```

## Consequences

- **One round trip, one failure branch.** No premature JETLI `SEP/finger` probe
  on the kiosk; readiness is the local service's concern.
- **Kiosk never stores biometric data.** Only the verdict is consumed.
- The timeout value, retry policy, and whether the local service derives
  `noPeserta` from the kiosk context or receives it in the payload are
  **open items** pending the local-service spec.
