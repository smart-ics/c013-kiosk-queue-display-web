---
Title: Kiosk setDataEligibility Upload-Authoritative Identity Correction
Code: KIOSK-SETDATAELIGIBILITY-SJP
Artifact: ARCHITECTURE
Version: 1.0
LastUpdated: 2026-09-29
---

# 1. Overview

This architecture realizes the kiosk-side correction for `KIOSK-SETDATAELIGIBILITY-SJP`: the `PATCH Reg/setDataEligibility` identity (`sjpNo`/`sjpId`) must come solely from the `PATCH Sep/upload` result, never from the `POST Sep` (create) result.

Referenced originating evidence:

- BUG-INVESTIGATION: `c013-kiosk-queue-display-web/docs/analysis/KIOSK-SETDATAELIGIBILITY-SJP-BUG-INVESTIGATION.md` (v1.2, `INVESTIGATION-COMPLETE`)
- Cross-repo source ISSUE: `b09-bilreg-api/docs/issues/BILREG-SETDATAELIGIBILITY-SJP-ISSUE.md` (ID `BILREG-SETDATAELIGIBILITY-SJP-ISSUE-001`, Type BUG; c013-side ISSUE requested via OQ-03, administrative only)

Baseline capability architecture amended by this correction (read-only reference, not modified here):

- `c013-kiosk-queue-display-web/docs/architecture/KIOSK-SEP-SKDP-ARCHITECTURE.md` (v1.1, TD-006/TD-007 lifecycle and `Kiosk -> Reg/setDataEligibility` integration row)

# 2. Architectural Basis

## Business Context

No formal standalone DOMAIN or FEATURE artifact exists for this kiosk capability. Applicable business/orchestration references (unchanged):

- `c013-kiosk-queue-display-web/docs/domain-model.md`
- `c013-kiosk-queue-display-web/docs/adr/ADR-002-jaminan-eligibility-rule.md`
- `c013-kiosk-queue-display-web/docs/adr/ADR-005-kiosk-orchestration-state-machine.md`

## Analysis Input

Authoritative analysis input (consumed, not re-decided):

- `c013-kiosk-queue-display-web/docs/analysis/KIOSK-SETDATAELIGIBILITY-SJP-BUG-INVESTIGATION.md`

```text
ISSUE (BUG)
        +
        BUG-INVESTIGATION
        ↓
    ARCHITECTURE (this artifact)
```

Consumed approved investigation decisions:

- D-01 (from OQ-01 CLOSED): upload result is the sole authoritative source of the valid `sepNo`; absence of a valid upload `sepNo` (error or missing value) is a fallback condition, never a reason to use create identity.
- D-02 (from OQ-02 CLOSED): placeholder (`"-"`) is rejected as eligibility data; its occurrence routes to admisi fallback with the existing registration preserved.
- Correction direction: create-sourced eligibility (alternative b) is rejected per F-02; upload-sourced eligibility (alternative a) is selected per F-01–F-03.

# 3. Scope

## Included

- Post-registration identity handoff: `PATCH Sep/upload` result becomes the single input to `PATCH Reg/setDataEligibility` (`sjpNo`/`sjpId`) and to the kiosk `sepNo` display/print state for this flow.
- Placeholder/absence guard on the upload identity before any eligibility call, bound to the existing admisi-fallback recovery (regId preserved, no second registration, no second SEP).
- Booking and walk-in parity (both share the single `register()` path).

## Excluded

- Any `b09-bilreg-api` persistence change (explicitly out of scope per investigation Scope; truncation of `TA_REGISTRASI.fs_kd_trs_sjp` untouched).
- Any change to Jetli/Bilreg service contracts, endpoint shapes, or error response shapes.
- Any change to retry budgets (create one-time, upload max 3, eligibility max 3 — unchanged from TD-006/TD-007).
- Any change to pre-registration mapping, SEP payload policy (TD-005), or `sepDate` contract (TD-008–TD-010).
- New c013-side ISSUE issuance (OQ-03, owned by Issue Intake).

# 4. Technical Decisions

## TD-SJP-01: Upload result is the sole eligibility identity source

The orchestration captures the resolved `PATCH Sep/upload` object and uses its `sepNo`/`sepId` as the only values for:

1. the `PATCH Reg/setDataEligibility` body (`sjpNo = upload.sepNo`, `sjpId = upload.sepId`), and
2. the kiosk session `sepNo` state consumed by the registration print context.

The `POST Sep` (create) result's `sepNo`/`sepId` must not flow into eligibility after upload. The create `sepId` continues to serve only its existing role as the `Sep/upload` request input (`{ sepId, regId }`).

Current defect location (evidence, not restated as investigation): `apps/kiosk-web/src/composables/useKioskRegistration.ts` — the `withAttemptLimit('SEP upload', ...)` block discards the resolved upload object, and the subsequent `setDataEligibility` call reads `sepRes.sepNo`/`sepRes.sepId` (create identity).

## TD-SJP-02: Placeholder or absent upload identity is a fallback signal, enforced at the orchestration boundary

Before any `setDataEligibility` attempt, the orchestration validates the captured upload identity with `isValidUploadSepNo(value)`:

```text
isValidUploadSepNo(v) = typeof v === 'string'
  && v.trim().length > 0
  && v.trim() !== '-'
```

- Valid → proceed to eligibility with the upload values (existing 3-attempt budget applies to the eligibility call itself).
- Invalid (missing, blank, or `"-"`) → do not call `setDataEligibility`, do not substitute create values, throw to the existing post-registration recovery (`enterAdmisiFallback()`), preserving `regId`.

String-union upload outcomes (`typeof uploadRes === 'string'`, the existing business-error shape) continue to throw inside the upload attempt block and therefore already route to fallback; they must never be coerced into an eligibility identity.

The shared `payloadSetDataEligibilitySchema` (`sjpNo: z.string().min(1)`) is intentionally unchanged: Bilreg owns that contract and it is out of scope. Rejection lives at the kiosk orchestration boundary per the investigation's Architecture Impact (OQ-02).

## TD-SJP-03: Recovery semantics are unchanged, only the trigger set grows

`TD-007` recovery (`REGISTRATION_CREATED → … → ADMISI_FALLBACK`, `enterAdmisiFallback()`, configured default service point, special `Berhasil Registrasi regid : RGxxx` notice) is reused as-is. This architecture adds two trigger inputs to that existing state without redefining it:

- upload identity invalid per TD-SJP-02;
- upload exhaustion (existing 3-attempt behavior, unchanged).

No new retry, no second registration, no second SEP. Booking and walk-in share the path because both execute the same `register()` function.

# 5. Component Responsibilities

| Component | Responsibility |
|------------|----------------|
| `useKioskRegistration` orchestration (`register()`) | Owns the upload→eligibility handoff: capture the upload object, validate via `isValidUploadSepNo`, call eligibility only with upload values, route invalid identity to `enterAdmisiFallback()` with `regId` preserved. |
| SEP identity guard (`isValidUploadSepNo` helper, co-located with orchestration or `lib/`) | Owns the single definition of a sendable upload `sepNo` (non-blank, not `"-"`). |
| Kiosk session `sepNo` state | Owned by orchestration; set from the validated upload `sepNo` (not from create) for print context. |
| Jetli API client adapter (`uploadSep`/`createSep`) | Unchanged: calls endpoints, unwraps JSend, exposes typed `ResponseUploadSep` / `ResponseCreateSep` union results. |
| Bilreg API client adapter (`setDataEligibility`) | Unchanged: sends the body it is given; no client-side contract change. |
| Shared-types eligibility contract (`payloadSetDataEligibilitySchema`) | Unchanged and not authoritative for placeholder rejection under this architecture. |
| Retry/recovery coordinator (`withAttemptLimit`, `enterAdmisiFallback`) | Unchanged budgets and fallback behavior; receives the two new trigger inputs. |
| Bilreg admission queue / admisi operator workflow | Unchanged fallback consumer/owner. |

# 6. Integration Design

| Source | Target | Purpose |
|----------|----------|---------|
| Kiosk orchestration | Jetli `PATCH Sep/upload` | Associate created SEP with existing registration; **produce** the authoritative eligibility identity (`sepId`, `sepNo`). Retry ≤ 3 (unchanged). |
| Kiosk orchestration | Bilreg `PATCH Reg/setDataEligibility` | Record eligibility **consuming only** the validated upload identity; retry ≤ 3 (unchanged); never called when upload identity is invalid. |
| Kiosk orchestration | Bilreg admission queue intake | Existing fallback handoff with preserved `regId` when upload identity is invalid or operations exhaust. |
| Kiosk orchestration | Printer | Existing outputs; successful path prints registration receipt with the upload-sourced `sepNo`. |

This amends the `KIOSK-SEP-SKDP-ARCHITECTURE.md` §6 row `Kiosk → Reg/setDataEligibility` by constraining its input lineage to the upload result. The baseline artifact itself is not edited here.

# 7. Data Ownership

| Data | Owner |
|--------|--------|
| SEP number and SEP ID consumed by eligibility in this flow | Jetli, as observed in the `PATCH Sep/upload` result and held in kiosk session only for handoff |
| `POST Sep` result `sepNo`/`sepId` after upload | Jetli record; explicitly **not** an eligibility input in this flow (create `sepId` remains the upload request key only) |
| Registration and `RegId` | Bilreg (unchanged) |
| Retry/fallback session state | Kiosk orchestration session (unchanged) |

# 8. Database Design

## New Tables

None.

## Modified Tables

None. No kiosk, Jetli, or Bilreg schema change is authorized.

## Relationships

No new persistence relationship. Runtime lineage only:

```text
Bilreg RegId -> Jetli SEP upload association (authoritative identity) -> Bilreg eligibility record
```

## Migration Considerations

No migration, backfill, or data repair. Kiosk client is the only deployed artifact touched by this correction.

# 9. Cross-Cutting Concerns

- Logging: on invalid upload identity, log a correlation-safe warning naming the condition (`upload identity invalid: missing/placeholder`) with `regId`; do not log participant identity, credentials, or full bodies. Distinguish this guard rejection from service error text, consistent with the TD-009 observability pattern.
- Concurrency: existing `withSubmit` / duplicate-submission guard unchanged; the same upload object captured once is reused across eligibility retries (no re-read, no second upload to obtain identity).

# 10. Implementation Constraints

- Must capture the resolved upload object; must not read `sepRes.*` (create) for `sjpNo`/`sjpId` or for the session `sepNo` state on the eligibility path.
- Must not call `setDataEligibility` when the upload identity is invalid; must route to `enterAdmisiFallback()` with `regId` preserved.
- Must not substitute create values as a fallback for any upload outcome (error string, missing `sepNo`, placeholder).
- Must not change retry budgets (create one-time; upload ≤ 3; eligibility ≤ 3) or introduce a second registration/SEP.
- Must apply identically to booking and walk-in (single `register()` path; no per-mode branching of the handoff).
- Must not modify `payloadSetDataEligibilitySchema`, Jetli/Bilreg services, or any database schema.

# 11. Acceptance Conditions

- Eligibility payload for a successful upload carries the upload `sepNo`/`sepId` (create placeholder `"-"` never sent even when create returned it).
- Upload returning `"-"`/blank/missing `sepNo`, or a string business-error, results in: no `setDataEligibility` call, `postRegistrationPhase === 'ADMISI_FALLBACK'`, preserved `regId`, and the existing admisi handoff.
- Session/print `sepNo` on the success path equals the upload `sepNo`.
- Retry budgets and single-create/single-registration invariants hold; booking and walk-in behave identically.
- Repository gate `pnpm turbo run typecheck test` passes with regression coverage for the create-placeholder + upload-valid case and the invalid-upload-identity fallback cases.
