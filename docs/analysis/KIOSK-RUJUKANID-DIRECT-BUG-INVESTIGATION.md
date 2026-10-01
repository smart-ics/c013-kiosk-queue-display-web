# BUG-INVESTIGATION

## Context

Issue: `c013-kiosk-queue-display-web/docs/issues/KIOSK-RUJUKANID-DIRECT-ISSUE.md` (ISSUE, Type BUG, ID KIOSK-RUJUKANID-DIRECT-ISSUE-001, reported 2026-09-29)

Problem Summary:

On the booking-direct registration path, the request body sent to `POST {BILREGAPI}/api/Reg/rajalByBooking/direct` is reported to fill the `rujukanId` field with the referral letter number (`rujukan.noRujukan`) from `GET {JETLIAPI}/api/Sep/rujukan/{noPeserta}/peserta`. The reported expectation is that `rujukanId` carries the perujuk identifier — the `rujukanId` value returned by `GET {BilregApi}/api/Rujukan/ppk/{faskesPerujuk.faskesId}` — and not the referral letter number.

Referenced artifacts (evidence only, not modified):

- ARCHITECTURE: `c013-kiosk-queue-display-web/docs/architecture/KIOSK-SEP-SKDP-ARCHITECTURE.md` v1.1 (TD-003, TD-004)
- FEASIBILITY-ASSESSMENT: `c013-kiosk-queue-display-web/docs/analysis/KIOSK-SEP-SKDP-FEASIBILITY-ASSESSMENT.md` (GAP-010, OQ-005)
- Flow reference: `c013-kiosk-queue-display-web/docs/architecture/kiosk-self-registration-flow.md`
- Bilreg contracts: `b09-bilreg-api/src/bilreg/Bilreg.Application/AdmisiContext/RujukanFeature/RjkGetByPpkIdQuery.cs`, `b09-bilreg-api/src/bilreg/Bilreg.Application/AdmisiContext/RegFeature/UseCases/RegJalanByBookingCmd.cs`
- Kiosk implementation (read as evidence): `c013-kiosk-queue-display-web/apps/kiosk-web/src/composables/useKioskRegistration.ts`, `c013-kiosk-queue-display-web/packages/api-client/src/his.ts`

No formal standalone DOMAIN or FEATURE artifact for this capability was found; business references are `docs/domain-model.md`, `docs/adr/ADR-002-jaminan-eligibility-rule.md`, and `docs/adr/ADR-005-kiosk-orchestration-state-machine.md`.

## Current State

The booking-direct registration is a queue-less Bilreg admission that creates the single rawat jalan registration with resolved local admission data, before the kiosk SEP lifecycle (`POST Sep`, `PATCH Sep/upload`, `PATCH Reg/setDataEligibility`).

The two identifier spaces named in the report are confirmed as distinct by their owning contracts:

- Jetli SEP rujukan space: the referral letter number (`noRujukan`), the per-visit referral document number, with the referring facility carried alongside as `faskesPerujuk.faskesId`.
- Bilreg local admission space: `RujukanId` (the local referral-master key) with its admission channel `CaraMasukDkId`, resolved from the referring facility through `GET /api/Rujukan/ppk/{ppkId}`, whose response carries `RujukanId`, `RujukanName`, `PpkId`, and `CaraMasukDkId`.

The approved architecture already separates these spaces: for a selected Rujukan the kiosk must resolve local `RujukanId` + `CaraMasukDkId` through the PPK mapping before registration (TD-003), and a BPJS number must never be copied into Bilreg `rujukanId` (TD-004, TD-010-equivalent rule in the implementation plan). The kiosk implementation read in this workspace follows that rule on inspection: the Rujukan branch resolves through the PPK lookup and uses the returned local `RujukanId`/`CaraMasukDkId`, the SKDP branch registers with empty `rujukanId` and `caraMasukDkId 8`, and the non-BPJS branch falls back to the booking `extAppRef.reffId`. Existing repository tests assert the same separation, including an explicit assertion that the BPJS rujukan number is never copied into the local `rujukanId`.

No captured request body, response body, log, screenshot, or TEST-EXECUTION FAIL record for the reported wrong-value payload was attached at intake, and no deployed version, environment, or observation timestamp beyond the report date was recorded. The reported current behavior (wrong value on the wire) therefore stands as a reporter observation that could not be reproduced from the workspace alone.

## Problem Analysis

### Finding F-01 — the reported expectation matches the already-approved rule

The reporter's expected direction (perujuk identifier from the Bilreg PPK lookup, not the Jetli referral letter number) is consistent with the approved architecture TD-003/TD-004, the feasibility record GAP-010/OQ-005, and the Bilreg receiving contract. No new business rule is implied by the report; the investigation neither invents nor changes the rule, it confirms the report points at the existing rule.

### Finding F-02 — the receiving contract cannot accept a BPJS referral number as `rujukanId`

`RjkGetByPpkIdResponse` exposes the local master as `RujukanId` keyed by `PpkId`, and the booking-direct registration handler resolves the admission referral by loading the local `RujukanType` by that `rujukanId` key whenever the admission channel requires a rujukan, otherwise it uses the default (no-rujukan) record. A value from the Jetli referral-letter space (e.g. a `noRujukan` shaped as a BPJS letter number) is not a key in the local referral-master space, so on any channel that requires a rujukan it resolves to a `Rujukan not found`-class rejection rather than to a wrong linkage; on a channel that does not require a rujukan the supplied value is bypassed in favor of the default record. Either way the letter number cannot function as the local linkage.

### Finding F-03 — the inspected kiosk path already resolves through the PPK mapping

Observed in the current workspace implementation: the booking-commit path prepares registration data from the selected BPJS reference before calling the booking-direct endpoint — the Rujukan branch looks up the PPK mapping by the reference's stored referring-facility identifier and uses the returned local `RujukanId` and `CaraMasukDkId`; the SKDP branch skips the lookup with empty `rujukanId`; the no-reference branch uses the booking fallback identifier. The reference-parsing step retains both the letter number (as the display/selection identifier) and the referring-facility identifier (as the mapping key) from the same Jetli response. This is recorded as a workspace observation, not as proof about what a deployed build sent.

### Finding F-04 — the defect as reported is not reconciled with the inspected code, and the gap is evidence, not a root cause

Three mutually exclusive possibilities remain open and are not decided by this investigation:

1. The observation was made against a deployed build that predates the PPK-mapping behavior (regression-vs-version question).
2. The observation was made on a path that bypasses the inspected preparation (e.g. a non-kiosk caller of the same Bilreg endpoint, an officer-workspace or fallback path, or a booking record with no selected BPJS reference so the fallback identifier was used).
3. The observation reflects a transient mapping failure (PPK lookup miss, empty referring-facility key) whose fallback or error surface was mistaken for a wrong-value payload.

No evidence was available to select among these. A definitive root cause is therefore not stated, per the analysis boundary.

### Suspected causes (not established)

- Stale deployed kiosk client predating the reference-type-specific registration mapping.
- A caller other than the inspected kiosk booking-commit path submitting the Jetli letter number directly.
- A missing or unresolvable referring-facility key causing a fallback or manual substitution upstream of the registration call.

### Supporting evidence

- Reporter statement 2026-09-29 naming the three endpoints and the two identifier spaces (ISSUE Evidence).
- Bilreg `RjkGetByPpkIdQuery`/`RjkGetByPpkIdResponse` shape and `RegJalanByBookingCmd.ResolveRujukan` behavior as cited under Context.
- Architecture TD-003/TD-004 separation rule and feasibility GAP-010/OQ-005 reference-type-specific mapping record.
- Kiosk registration-preparation and booking-commit behavior and the never-copy-BPJS-number test assertion as cited under Current State (workspace observation).

## Affected Components

| Component | Relationship to defect |
|---|---|
| Kiosk booking-direct registration workflow (booking commit before SEP lifecycle) | Suspected. Reported site of the wrong value; inspected workspace path already applies the PPK mapping. |
| Kiosk BPJS reference model (letter number as selection identifier, referring-facility identifier as mapping key) | Related. The two identifiers originate from the same Jetli response and must not be interchanged downstream. |
| Bilreg PPK mapping integration (`GET Rujukan/ppk/{ppkId}`) | Related. Authoritative source of the expected local `RujukanId` + `CaraMasukDkId` for a Rujukan. |
| Bilreg booking-direct registration endpoint (`POST Reg/rajalByBooking/direct`) | Affected surface. Rejects or mislinks a letter-number value per F-02; no change to the endpoint itself is implied. |
| Jetli SEP rujukan retrieval (`GET Sep/rujukan/{noPeserta}/peserta`) | Not at fault. Supplies both the letter number (correct as the later SEP reference) and the referring-facility key (correct as the PPK lookup key). |
| SKDP and non-BPJS registration branches | Not affected by this report, which names the Rujukan booking-direct path only. Their rules (SKDP empty `rujukanId` + channel 8; non-BPJS booking fallback) are unchanged. |
| Persisted registration/rujukan data | No repair, migration, or backfill is implied; none was evidenced. |

## Impact Assessment

### Business impact

- If the reported value reaches Bilreg on a channel that requires a rujukan, registration is rejected at admission (lookup failure), so the patient cannot complete kiosk self-registration on the Rujukan booking path and is diverted to manual handling. The rujukan linkage the capability exists to record is not established.
- If it reaches Bilreg on a channel that does not require a rujukan, the value is bypassed and the clinical linkage defaults, which masks the fault while recording an admission without the intended perujuk linkage.
- Scope is confined to the Rujukan booking-direct path as reported; the SKDP, walk-in, and non-BPJS paths are not implicated by this report.

### Operational impact

- Each affected patient absorbs an exception path (counter handling, re-registration, or admisi fallback), adding manual work per case. Diagnosis from the client alone is hard without a captured payload because the two identifiers are opaque strings at the boundary.
- No data corruption, partial SEP state, or database intervention is evidenced or implied.

### Technical impact

- The blast radius as understood is narrow: one outbound field on one endpoint on one reference path, with the authoritative mapping contract already available and the separation rule already approved. No new integration boundary, persistence change, or cross-cutting change is evidenced as required.
- The unresolved part is provenance, not contract shape: which build, caller, or fallback produced the observed payload (F-04). Closing that requires deployment and runtime evidence, not a contract decision.

## Assumptions

- **A-01.** The Bilreg source read in this workspace (`RjkGetByPpkIdQuery`, `RegJalanByBookingCmd`) is the code serving the environment where the wrong value was observed. The services were not started to confirm the deployed version.
- **A-02.** The kiosk implementation read in this workspace is later than or equal to the architecture v1.1 approval; the deployed build the reporter observed may be older. No build hash or deployment record was available.
- **A-03.** The report concerns the kiosk client path, not another caller (officer workspace, integration job) of the same Bilreg endpoint. The reporter did not name the calling application beyond the payload endpoint.
- **A-04.** The Jetli `faskesPerujuk.faskesId` value is usable as the Bilreg `ppkId` lookup key, per the approved mapping rule. The key-space equivalence itself was not re-verified against master data in this investigation.
- **A-05.** No captured payload exists to inspect; the Current Situation records the reporter's observation as stated.

## Open Questions

- **OQ-BI-01 — Where was the wrong payload observed?** Environment, deployed kiosk build/version, timestamp, and the captured `POST rajalByBooking/direct` request body are needed to confirm the report against F-03. Without the body, the investigation cannot distinguish a stale build from a bypassing caller. Blocks confirmation; does not block Architecture review of the correction direction.
- **OQ-BI-02 — Which caller submitted it?** Was the payload sent by the kiosk booking-commit path, another frontend, or a manual/test harness? If non-kiosk, the correction belongs to that caller, not the kiosk. Needs the calling-application identity or API access log.
- **OQ-BI-03 — What was the PPK lookup outcome for that case?** Did `GET Rujukan/ppk/{faskesId}` succeed, miss, or get skipped (empty referring-facility key)? Determines whether the fault is a bypass, a lookup miss with fallback, or a stale build. Needs the Bilreg/Jetli request correlation for the failing case.
- **OQ-BI-04 — What was the Bilreg response to the wrong value?** Rejection text (e.g. rujukan-lookup failure) versus silent acceptance on a non-rujukan channel changes the business-impact reading and the retest criterion. Needs the captured response body.
- **OQ-BI-05 — Is the booking fallback implicated?** For bookings with no selected BPJS reference the inspected path uses the booking `extAppRef.reffId` as `rujukanId`. Whether any failing case ran through that fallback (rather than the Rujukan branch) is unconfirmed and affects which path the retest must exercise.

## Recommended Decision

Treat the Bilreg PPK lookup result as the sole authoritative source of the booking-direct `rujukanId` for a selected Rujukan, with the Jetli referral letter number reserved exclusively for the later SEP reference and never used as the Bilreg local `rujukanId`.

The correction should ensure the booking-direct registration carries the mapped local perujuk linkage together with its mapped admission channel, preserves the distinct handling of the SKDP and non-BPJS branches, and preserves the existing fail-safe behavior — a missing or unresolvable perujuk mapping must stop the flow with guidance to staff rather than substitute the letter number or an invented value.

OQ-BI-01 through OQ-BI-03 (observation provenance, calling application, PPK outcome) must be closed with runtime evidence before or during architecture review so the correction lands in the caller that actually produced the payload.

## Decision

**Selected direction: the booking-direct `rujukanId` for a Rujukan must be the local perujuk identifier from the Bilreg PPK mapping, never the Jetli referral letter number; the letter number remains the SEP-reference value only. Missing or unresolvable perujuk mapping must fail safe to staff guidance.**

This is a correction-direction decision at the investigation level. It confirms the reported expectation against the existing approved rule and does not introduce a new business rule, a new contract, or a technical realization.

## Decision Rationale

### Supporting findings

- **F-01** establishes the reported expectation as a restatement of the already-approved separation rule (TD-003/TD-004, GAP-010/OQ-005), so adopting it introduces no new business knowledge and contradicts no existing artifact.
- **F-02** establishes from the receiving contract that the letter number cannot satisfy the local linkage: it is not a key in the referral-master space and fails the admission lookup on any rujukan-required channel.
- **F-03** bounds the change: the inspected kiosk path already expresses the selected direction, so the correction is a provenance-and-conformance matter (ensure the deployed caller conforms), not a contract-shape matter.
- **F-04** constrains the claim honestly: without a captured payload the investigation does not assert which build or caller produced the observation, and the decision is therefore framed to apply to whichever caller is confirmed by OQ-BI-01/OQ-BI-02.

### Rejected alternatives

- **Accept the letter number as `rujukanId`.** Rejected — directly refuted by F-02; the receiving contract resolves the local linkage by master key, which the letter number is not.
- **Introduce a new perujuk identifier or new lookup contract.** Rejected — no evidence of a missing contract; the PPK mapping already returns the required local identifier and channel (F-01).
- **Extend the correction to SKDP or non-BPJS branches.** Rejected — the report names the Rujukan booking-direct path only, and those branches have distinct approved rules that this investigation leaves unchanged.
- **Substitute the letter number as a fallback when the mapping misses.** Rejected — it would convert a diagnosable fail-safe stop into a mislinked or rejected admission (F-02) and contradict the approved never-copy rule.
- **Defer the direction until runtime evidence arrives.** Rejected as unnecessary serialization: the correction direction is already determined by F-01/F-02, while OQ-BI-01–OQ-BI-03 concern only which caller the correction must be applied to and verified against.

### Constraints and trade-offs

- The decision adds no new knowledge; it reaffirms existing architecture. If runtime evidence (OQ-BI-02) shows a non-kiosk caller produced the payload, the same direction applies to that caller and the kiosk needs no change beyond verification.
- The fail-safe requirement trades a small amount of self-service continuity (stop with staff guidance on unresolvable mapping) against preventing mislinked admissions, consistent with the existing never-substitute posture.
- No data repair, migration, or multi-service release is implied by this decision.

## Architecture Applicability

### Decision

ARCHITECTURE-NOT-REQUIRED

*(The Architect owns and may override this determination; it is recorded here as the investigation's evidence-based recommendation.)*

### Rationale

Recorded as ARCHITECTURE-NOT-REQUIRED because the correction as understood requires no formal technical target-state definition beyond what the approved architecture already holds:

- No new or changed component, integration boundary, persistence or data-ownership change, or cross-cutting change is evidenced; TD-003/TD-004 already define the mapping, the separation, and the caller responsibilities.
- The remaining unknowns (OQ-BI-01–OQ-BI-05) are provenance and verification questions answerable with runtime evidence, not structural ambiguities requiring a target-state decision.
- If the Architect's provenance review finds the payload came from a caller or fallback outside the approved structure, or finds the mapping key space itself defective, that finding would promote this to ARCHITECTURE-REQUIRED; on current evidence that promotion is not warranted.
