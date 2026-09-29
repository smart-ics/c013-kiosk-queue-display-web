---
Title: Kiosk SEP and SKDP Integration Architecture
Code: KIOSK-SEP-SKDP
Artifact: ARCHITECTURE
Version: 1.1
LastUpdated: 2026-09-28
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

The architecture realizes the approved decisions in `KIOSK-SEP-SKDP-FEASIBILITY-ASSESSMENT`
and the approved correction in `KIOSK-SEP-SKDP-BUG-INVESTIGATION`.

No kiosk SKDP creation is included. Existing SKDP data is consumed only as a control-reference input.

Version 1.1 adds the SEP request date-time contract (TD-008), its enforcement at the
shared client boundary (TD-009), and the request-direction contract conformance
requirement (TD-010). It realizes the correction of DEF-001
(`KIOSK-SEP-SKDP-ISSUE-DEF-001`); the defect, its evidence, and the rejected
alternatives are owned by the BUG-INVESTIGATION and are not restated here.

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

Approved bug-correction input (version 1.1):

- `c013-kiosk-queue-display-web/docs/analysis/KIOSK-SEP-SKDP-BUG-INVESTIGATION.md`
- `c013-kiosk-queue-display-web/docs/issues/KIOSK-SEP-SKDP-ISSUE.md`

The date-time contract helper is an external library referenced by the Jetli
source and is part of the contract authority:

- `Nuna.Lib.NetStandard` 3.5.159 — `Nuna.Lib.ValidationHelper.DateTimeHelper` and `DateFormatEnum`

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
- Composition of the `POST /sep` `sepDate` request value as `yyyy-MM-dd HH:mm:ss`, using the HIS business date for the date part and the kiosk host clock for the time part.
- Validation of that `sepDate` value at the shared client contract boundary, with a contract violation stopping the flow before any request is issued.
- Request-direction contract conformance tests for the `POST /sep` date-time field.

## Excluded

- Kiosk-initiated SKDP creation.
- Changes to Jetli's SKDP generation from rencana kontrol.
- New Bilreg referral master data.
- Originating-PPK lookup for SKDP.
- A second registration or a second SEP after an unknown/successful create outcome.
- Replacement of the existing authentication/token-provider architecture.
- Any change to the `b12-Jetli-JknTrustedLinkApi` service, its endpoint contracts, or its error response shape.
- Any change to the HIS business-date contract or to the `b09-bilreg-api` service.
- Format or type validation of `POST /sep` request fields other than `sepDate`. The remaining unconstrained request fields are a known contract gap, recorded in the BUG-INVESTIGATION as OQ-BI-04, and are to be raised as a separate ISSUE by the owning role.
- Machine-readable, field-level rejection feedback from Jetli. Jetli's opaque 400 `data` string is a known limitation (BUG-INVESTIGATION F-03) and addressing it would require a `b12` change, which is excluded.

# 4. Technical Decisions

## TD-001: Jetli source is the client contract authority in both directions

The kiosk API client and schemas must follow the current Jetli application
contract types.

Request direction (outbound from the kiosk):

- `SepCreateCommand` — the authoritative shape of the `POST /sep` request
  body, including the `SepDate` field and its required `yyyy-MM-dd HH:mm:ss`
  format.

Response direction (inbound to the kiosk):

- `RujukanBpjsGetResponse`
- `RujukanBpjsInfo`
- `SkdpInfo`
- `SepCreateResponse`

The request direction is now explicitly in scope for this decision. In version
1.0 the authority was stated for response types only, while the request contract
was listed only under referenced sources; the SEP request contract was therefore
never treated as a boundary the client had to satisfy. The corrections in TD-008
through TD-010 establish it.

Legacy names such as `tglMulai`, nested `diagnosa.kode`, and `diagnosa.nama` are not compatibility fields. Missing required Jetli data is a validation failure, not a reason to apply `Z00.0` or an empty date. The same applies to a missing or malformed `SepDate`: a value that does not satisfy the Jetli contract is a validation failure, not a reason to send a date-only value, a zeroed time, or a client-side invented default.

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

## TD-008: SEP date-time composition

The `POST /sep` `sepDate` request value is a single composed date-and-time value
in the pattern `yyyy-MM-dd HH:mm:ss`, composed from two distinct sources:

| Component | Source | Notes |
|---|---|---|
| Date part | HIS business date | The existing kiosk business date. Semantics are unchanged and remain date-only. |
| Time part | Kiosk host local clock, read at the moment the SEP payload is composed | Represents the moment the SEP was created at the kiosk. |

The composed value replaces the kiosk's internal date-only business-date value at
the outbound contract boundary only. The internal business-date value itself is
not widened, not reformatted, and not replaced; its other consumers — visit-date
comparison, scheduling, and age formatting — continue to receive the date-only
value they receive today.

Consequences of this composition rule, which implementation must preserve:

- The date component must remain the business date even when the business date
  differs from the kiosk host's calendar date. The kiosk's *today* must never
  substitute for the business date.
- The time component is the kiosk host's local time. It is not authoritative for
  audit: the Jetli service derives its own audit timestamp from its own server
  clock, independently of this value.
- No time zone is carried in the `POST /sep` contract. The kiosk host and the
  Jetli server are therefore required to observe the same time base; see
  Cross-Cutting Concerns.
- Both reference types use the same composed value. The date-time contract is not
  reference-specific and is independent of the TD-005 payload policy.

## TD-009: The SEP request contract is validated at the shared client boundary

The `sepDate` format constraint of TD-008 is declared in the shared client
contract, not only applied at the call site. A `POST /sep` payload whose
`sepDate` does not match `yyyy-MM-dd HH:mm:ss` is rejected by the client
contract before any request is issued.

Behavior on a contract violation:

- Treat it as a local contract failure, not as a service call and not as a
  business rejection.
- Do not issue the `POST /sep` request.
- Do not retry, and do not substitute a fallback date, a zeroed time, or an
  omitted field.
- Surface it through the existing post-registration recovery behaviour, which
  preserves `regId` and produces the admisi handoff, consistent with TD-007.

The validation scope for this architecture is the `sepDate` field only. Other
`POST /sep` request fields remain unconstrained strings in the shared contract
and are out of scope here.

## TD-010: Request-direction contract conformance is verifiable

The shared client contract for the `POST /sep` request must be covered by
automated tests that assert the date-time format, and by unit tests that assert
the composed value at the SEP payload boundary.

This is an architectural requirement, not a testing preference. The version 1.0
contract was satisfied by schemas and tests that both encoded an unconstrained
string, so a request-contract defect could not be detected by the repository
verification gate. The test coverage must fail if the emitted `sepDate` format
regresses, and must not be satisfied by fixtures that assume a date-only value.

# 5. Component Responsibilities

| Component | Responsibility |
|------------|---------------|
| `useKioskRegistration` orchestration | Coordinates reference selection, pre-registration mapping, registration, SEP lifecycle, retries, and recovery state. |
| Jetli API client adapter | Calls Jetli endpoints, unwraps JSend responses, validates current Jetli shapes, and exposes typed results. |
| Bilreg API client adapter | Calls Rujukan PPK mapping, registration, eligibility update, and admission fallback endpoints using existing auth/config boundaries. |
| Reference mapper | Converts Jetli Rujukan/SKDP responses into the discriminated kiosk reference model. |
| Registration preparation service | Resolves local `RujukanId`/`CaraMasukDkId` before registration according to reference type. |
| SEP payload policy | Builds Rujukan or SKDP SEP payloads from the selected typed reference and participant context, including composing the `sepDate` value per TD-008. |
| Shared `POST /sep` request contract | Owns the declared outbound request shape for SEP creation, including the `sepDate` format constraint, and rejects a non-conforming value before a request is issued per TD-009. |
| Kiosk business date | Owns the date-only business date used by visit-date comparison, scheduling, and age formatting, and supplies the date component of the composed `sepDate`. |
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
| Kiosk | Jetli `POST Sep` | Create the single SEP using the selected reference-specific policy. The request carries `sepDate` as `yyyy-MM-dd HH:mm:ss` per TD-008 and is validated against the shared request contract per TD-009. |
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
| Composed SEP date-time value, before it is sent | Kiosk orchestration session |
| SEP date and time as persisted by Jetli | Jetli |
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

The TD-008 through TD-010 corrections require no migration, backfill, or data
repair, and no `b12` or `b09` deployment. The kiosk client is the only deployed
artifact. This is consistent with the fail-safe failure behavior established in
the BUG-INVESTIGATION: a rejected `POST /sep` does not persist a SEP row or a
partial state, so no repair obligation is created.

The kiosk host and the Jetli server must be on a synchronised time source before
or at rollout, per the Cross-Cutting Concerns below.

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

## Clock discipline

The `POST /sep` contract carries no time zone. Because TD-008 composes the time
component from the kiosk host clock, the kiosk host and the Jetli server must
observe the same time base. This is a deployment prerequisite, not an
application mechanism.

The composed time component is not the audit time. The Jetli service derives its
audit timestamp from its own server clock. The composed value determines the
business date stored with the SEP and the time recorded alongside it, and is
therefore operational data subject to the kiosk host's time accuracy.

The date component is not derived from the host clock and must not drift: it is
the HIS business date and is the component the BPJS-facing date is taken from.

## Contract validation observability

Jetli rejects a malformed request with an HTTP 400 whose body carries only a
free-text `data` string, in a shape shared with legitimate business rejections. A
client-side contract rejection therefore must be distinguishable in kiosk logs
from a service-side business rejection, so that a request-contract defect is
diagnosable without reading the free-text message. Log the validation failure as a
contract failure naming the offending field, separately from service error text.

Do not log the participant identity, credentials, or the full request body for
this purpose.

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
- Emit `POST /sep` `sepDate` as `yyyy-MM-dd HH:mm:ss`, composed from the HIS business date for the date part and the kiosk host local clock for the time part.
- Never substitute the kiosk host's calendar date for the business date in the SEP date component.
- Never normalise the composed time to midnight or to any fixed time.
- Do not widen, reformat, or replace the kiosk business-date value itself; it remains date-only for its other consumers.
- Validate the `sepDate` format in the shared client contract; do not rely on a call-site-only check.
- On a contract violation, do not issue the request, do not retry, and do not substitute a fallback value; route through the existing post-registration recovery behaviour.
- Do not extend contract validation to `POST /sep` request fields other than `sepDate` under this architecture.
- Correct existing test fixtures and assertions that assume a date-only `sepDate`; they encode the non-conforming contract.
- The kiosk host and the Jetli server must be on a synchronised time source.
- No change to `b12-Jetli-JknTrustedLinkApi` is authorized by this architecture.

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
- A `POST /sep` request carries `sepDate` in `yyyy-MM-dd HH:mm:ss`, with a seconds component, on both the Rujukan and the SKDP branch.
- The date component of the emitted `sepDate` is the HIS business date, not the kiosk host's calendar date.
- The kiosk business-date value and its other consumers — visit-date comparison, scheduling, and age formatting — are unchanged.
- A `sepDate` that does not match `yyyy-MM-dd HH:mm:ss` is rejected by the shared client contract without issuing a `POST /sep` request.
- No date-only `sepDate` reaches the SEP payload policy boundary, and no date-only fixture or assertion remains in the kiosk SEP-create path.
- A contract rejection is recorded in kiosk logs as a contract failure naming the field, distinct from a service error response.
- The shared `POST /sep` request contract has automated coverage that fails if the `sepDate` format regresses, and the repository verification gate covers it.
- No `b12-Jetli-JknTrustedLinkApi` change is required and none is introduced.
