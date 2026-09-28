---
Title: Kiosk SEP and SKDP Integration Architecture
Code: KIOSK-SEP-SKDP
Artifact: ARCHITECTURE
Version: 1.0
LastUpdated: 2026-09-24
---

# 1. Overview

This architecture realizes the kiosk BPJS self-registration integration with Jetli VClaim and Bilreg for:

- participant Rujukan/SKDP retrieval;
- reference selection;
- rawat jalan registration;
- SEP creation;
- SEP upload to the created registration;
- Bilreg eligibility recording; and
- recovery through admisi when post-registration eligibility processing cannot be completed.

The architecture realizes the approved decisions in `KIOSK-SEP-SKDP-FEASIBILITY-ASSESSMENT`.

No kiosk SKDP creation is included. Existing SKDP data is consumed only as a control-reference input.

# 2. Architectural Basis

## Business Context

No formal standalone DOMAIN or FEATURE artifact for this capability was found. Existing kiosk business and orchestration references are:

- `c013-kiosk-queue-display-web/docs/domain-model.md`
- `c013-kiosk-queue-display-web/docs/adr/ADR-002-jaminan-eligibility-rule.md`
- `c013-kiosk-queue-display-web/docs/adr/ADR-005-kiosk-orchestration-state-machine.md`
- `c013-kiosk-queue-display-web/docs/adr/ADR-009-patient-context-re-query-booking-continuation.md`

## Analysis Input

Primary analysis input:

- `c013-kiosk-queue-display-web/docs/analysis/KIOSK-SEP-SKDP-FEASIBILITY-ASSESSMENT.md`

Authoritative external source contracts:

- `b12-Jetli-JknTrustedLinkApi/Jetli.Application/VClaimContext/SepFeature/RujukanBpjsGetQuery.cs`
- `b12-Jetli-JknTrustedLinkApi/Jetli.Application/VClaimContext/SepFeature/SepCreateCommand.cs`
- `b09-bilreg-api/src/bilreg/Bilreg.Application/AdmisiContext/RujukanFeature/RjkGetByPpkIdQuery.cs`
- `b09-bilreg-api/src/bilreg/Bilreg.Application/AdmisiContext/RegFeature/UseCases/RegJalanWalkInCommand.cs`

# 3. Scope

## Included

- Strict Jetli Rujukan/SKDP response mapping based on the current source contract.
- Explicit reference discriminator: `rujukan` or `skdp`.
- Rujukan PPK-to-local-Rujukan resolution before Bilreg registration.
- SKDP registration using empty local `rujukanId` and `caraMasukDkId = "8"` (`DATANG SENDIRI`).
- Reference-specific SEP payload policy.
- One-time SEP creation.
- Three retries for SEP upload.
- Three retries for `Reg/setDataEligibility`.
- Post-registration failure state, admisi fallback, and special registration notice.
- Contract and unit tests for the cross-repository client boundary.

## Excluded

- Kiosk-initiated SKDP creation.
- Changes to Jetli's SKDP generation from rencana kontrol.
- New Bilreg referral master data.
- Originating-PPK lookup for SKDP.
- A second registration or a second SEP after an unknown/successful create outcome.
- Replacement of the existing authentication/token-provider architecture.

# 4. Technical Decisions

## TD-001: Jetli source is the client contract authority

The kiosk API client and schemas must follow the current Jetli application response types:

- `RujukanBpjsGetResponse`
- `RujukanBpjsInfo`
- `SkdpInfo`
- `SepCreateResponse`

Legacy names such as `tglMulai`, nested `diagnosa.kode`, and `diagnosa.nama` are not compatibility fields. Missing required Jetli data is a validation failure, not a reason to apply `Z00.0` or an empty date.

## TD-002: Preserve reference type

The selected BPJS reference is represented internally as a discriminated value:

```text
RujukanReference {
  type: "rujukan"
  noRujukan
  faskesPerujukId
  diagnosisId
  diagnosisName
}

SkdpReference {
  type: "skdp"
  noSkdp
  tglRencanaKontrol
  diagnosisId
  diagnosisName
}
```

A common display identifier may be used by the UI, but orchestration must retain `type`.

## TD-003: Resolve Bilreg registration data before registration

The registration payload cannot be assembled until local admission mapping is complete.

For `rujukan`:

```text
Jetli Rujukan.FaskesPerujuk.FaskesId
  -> Bilreg GET /api/Rujukan/ppk/{ppkId}
  -> local RujukanId + CaraMasukDkId
```

For `skdp`:

```text
RujukanId = ""
CaraMasukDkId = "8"
```

The SKDP path does not call the PPK mapping endpoint.

## TD-004: Separate local registration reference from Jetli SEP reference

The selected reference number has two distinct uses:

| Reference type | Jetli SEP `NoRujukan` | Bilreg local `rujukanId` | Bilreg `caraMasukDkId` |
|---|---|---|---|
| Rujukan | `Rujukan.NoRujukan` | mapped local `RujukanId` | mapped value from Bilreg |
| SKDP | `SkdpInfo.NoSkdp` | empty string | `8` / `DATANG SENDIRI` |

A BPJS number must never be copied into Bilreg `rujukanId` unless it is the returned local `RujukanId`.

## TD-005: Reference-specific SEP policy

For Rujukan, retain the approved standard outpatient SEP defaults.

For SKDP/control / same-poli second visit:

```text
tujuanKunjunganId    = "2"
assesmentPelayananId = "5"
flagProcedureId      = ""
penunjangId          = ""
NoRujukan            = selected NoSkdp
faskesPerujukId      = ""
DiagnosaId           = selected Jetli diagnosis
```

Diagnosis must come from the selected Jetli Rujukan/SKDP data. No silent diagnosis fallback is permitted.

## TD-006: SEP creation is one-time

SEP creation is a single transition. The client must not automatically submit a second `POST Sep` after a successful or unknown-outcome request.

If the create result is unknown, the recovery path must use existing lookup/reconciliation capabilities or route to admisi; it must not blindly create again.

## TD-007: Post-registration recovery

The target state machine separates:

```text
REGISTRATION_CREATED
  -> SEP_CREATE_ATTEMPTED
  -> SEP_CREATED
  -> SEP_UPLOADED
  -> ELIGIBILITY_RECORDED
```

Allowed retries:

- SEP create: none automatically.
- SEP upload: maximum three attempts.
- Bilreg eligibility update: maximum three attempts.

After a post-registration operation remains unsuccessful, transition to `ADMISI_FALLBACK` while preserving `regId` and preventing another registration.

# 5. Component Responsibilities

| Component | Responsibility |
|------------|---------------|
| `useKioskRegistration` orchestration | Coordinates reference selection, pre-registration mapping, registration, SEP lifecycle, retries, and recovery state. |
| Jetli API client adapter | Calls Jetli endpoints, unwraps JSend responses, validates current Jetli shapes, and exposes typed results. |
| Bilreg API client adapter | Calls Rujukan PPK mapping, registration, eligibility update, and admission fallback endpoints using existing auth/config boundaries. |
| Reference mapper | Converts Jetli Rujukan/SKDP responses into the discriminated kiosk reference model. |
| Registration preparation service | Resolves local `RujukanId`/`CaraMasukDkId` before registration according to reference type. |
| SEP payload policy | Builds Rujukan or SKDP SEP payloads from the selected typed reference and participant context. |
| Retry/recovery coordinator | Applies operation-specific retry limits and emits the post-registration admisi fallback state. |
| Print context/renderer | Prints the SEP when available and prints the special existing-registration admisi notice when recovery is required. |
| Jetli `SepController` / application | Owns SEP creation, reference resolution, BPJS payload persistence, and duplicate-create rejection. |
| Bilreg `RujukanController` | Owns PPK-to-local-Rujukan mapping for Rujukan registration. |
| Bilreg registration application | Owns local registration creation and admission-channel validation. |
| Bilreg admission queue | Owns fallback queue intake using the configured default service point. |
| Admisi operator workflow | Owns manual completion and later SEP upload/recovery after kiosk fallback. |

# 6. Integration Design

| Source | Target | Purpose |
|----------|----------|---------|
| Kiosk | Jetli `GET Sep/rujukan/{noPeserta}/peserta` | Retrieve authoritative participant, Rujukan, and active SKDP data. |
| Kiosk | Bilreg `GET Rujukan/ppk/{ppkId}` | Resolve a Rujukan's BPJS referring-facility ID to local `RujukanId` and admission channel before registration. |
| Kiosk | Bilreg registration endpoint | Create the single rawat jalan registration with resolved local admission data. |
| Kiosk | Jetli `POST Sep` | Create the single SEP using the selected reference-specific policy. |
| Kiosk | Jetli `PATCH Sep/upload` | Associate the created SEP with the existing registration; retry up to three times. |
| Kiosk | Bilreg `Reg/setDataEligibility` | Record SEP eligibility against the existing registration; retry up to three times. |
| Kiosk | Bilreg admission queue intake | Create the fallback admission queue handoff using the configured default service point. |
| Kiosk | Printer | Print normal registration/SEP output or the special admisi handoff notice. |
| Admisi | Jetli/Bilreg | Complete manual SEP upload and eligibility recovery after fallback. |

The integration boundary must keep Jetli BPJS identifiers and Bilreg local identifiers separate.

# 7. Data Ownership

| Data | Owner |
|--------|--------|
| Participant BPJS data | Jetli |
| Rujukan BPJS data | Jetli |
| Active SKDP data | Jetli |
| SEP and SEP number | Jetli |
| Local referral master and `RujukanId` | Bilreg |
| Local admission channel (`CaraMasukDkId`) | Bilreg |
| Registration and `RegId` | Bilreg |
| Kiosk reference-selection state | Kiosk session only |
| Retry state and user-facing recovery state | Kiosk orchestration session |
| Admission fallback queue record | Bilreg admission queue |

# 8. Database Design

## New Tables

None required by this architecture.

## Modified Tables

None required by this architecture. Existing Jetli SEP and Bilreg registration/eligibility persistence remain authoritative.

## Relationships

No new persistence relationship is introduced. The runtime relationship is:

```text
Bilreg RegId -> Jetli SEP upload association -> Bilreg eligibility record
```

## Migration Considerations

No data migration is required. Rollout must ensure the client contract changes are deployed with compatible Jetli source behavior and that the fallback service point is configured.

# 9. Cross-Cutting Concerns

## Security

Use existing authenticated Jetli and Bilreg clients. Do not embed tokens or bypass the configured provider boundaries.

## Logging and audit

Log correlation-safe technical events for:

- selected reference type;
- local mapping result;
- registration ID;
- SEP ID/number when returned;
- operation and retry attempt;
- fallback reason.

Do not log unnecessary participant or credential data.

## Concurrency

Disable duplicate submission while an operation is in progress. Preserve the same registration and SEP identifiers across retries.

## Failure handling

A failure after registration is not a registration failure. It is a recovery state that must preserve `regId` and produce the admisi handoff.

# 10. Implementation Constraints

- Use the current Jetli source contract; do not retain legacy frontend field names as authoritative.
- Use Vue 3 Composition API and existing kiosk infrastructure boundaries.
- Use existing API client/JSend unwrapping conventions.
- Do not create SKDP from kiosk.
- Do not use a BPJS Rujukan/SKDP number as Bilreg local `RujukanId`.
- Resolve Rujukan local mapping before registration.
- For SKDP use `rujukanId: ''` and `caraMasukDkId: '8'`.
- Do not automatically retry SEP creation.
- Retry SEP upload and eligibility update at most three times.
- Do not create a second registration or SEP during recovery.
- Do not use `Z00.0` as an implicit diagnosis fallback.
- Preserve the existing default service-point fallback configuration.
- No database schema changes are authorized by this architecture.

# 11. Acceptance Conditions

- Jetli Rujukan/SKDP responses parse using the current source vocabulary.
- Rujukan and SKDP selection retains an explicit reference type.
- Rujukan registration resolves local `RujukanId` and `CaraMasukDkId` before registration.
- SKDP registration sends empty local `rujukanId` and `caraMasukDkId: '8'`.
- Rujukan SEP payload uses the approved outpatient policy.
- SKDP SEP payload uses `tujuanKunjunganId: '2'` and `assesmentPelayananId: '5'`, with diagnosis from Jetli.
- A selected SKDP number is sent to Jetli as SEP `NoRujukan` but never as Bilreg local `RujukanId`.
- SEP creation is submitted at most once by the kiosk flow.
- SEP upload and eligibility update each stop after three failed attempts.
- A post-registration failure preserves `regId`, invokes the configured admisi fallback, and prints the special handoff notice.
- No kiosk endpoint creates an SKDP.
- Contract, orchestration, retry, and recovery tests cover both Rujukan and SKDP branches.
