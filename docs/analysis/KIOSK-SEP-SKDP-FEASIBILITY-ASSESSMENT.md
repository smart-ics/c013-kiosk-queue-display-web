---
Title: Kiosk SEP and SKDP Integration Feasibility Assessment
Code: KIOSK-SEP-SKDP
Artifact: FEASIBILITY-ASSESSMENT
Version: 1.6
LastUpdated: 2026-09-24
Status: READY-FOR-PLANNING
---

# 1. Request Summary

Feature being assessed: kiosk BPJS self-registration integration with Jetli VClaim for participant eligibility, Rujukan/SKDP reference selection, SEP creation, SEP upload to registration, and registration eligibility recording.

Referenced artifacts:

- DOMAIN: No formal DOMAIN artifact for the kiosk SEP/SKDP capability was found in the reviewed workspace.
- FEATURE: No formal FEATURE artifact for the kiosk SEP/SKDP capability was found in the reviewed workspace.
- Existing business/implementation references: `c013-kiosk-queue-display-web/docs/domain-model.md`, `docs/adr/ADR-002-jaminan-eligibility-rule.md`, `docs/adr/ADR-003-biometric-contract.md`, `docs/adr/ADR-005-kiosk-orchestration-state-machine.md`, and `docs/adr/ADR-009-patient-context-re-query-booking-continuation.md`.

## Objective

Determine whether the current kiosk implementation and the current `b12-Jetli-JknTrustedLinkApi` contract support the intended SEP/SKDP flow, identify contract and business-behavior gaps, and identify the decisions required before Architecture can define a safe cross-repository change.

---

# 2. Current State

## Existing Behavior

### Kiosk frontend

- Runtime Jetli base URL is read from `apps/kiosk-web/public/global_config.json` through `configService.jetliApiBase`; the current configured value is `http://dev.smart-ics.com:8089/JetliAPi/api`.
- `apps/kiosk-web/src/infrastructure.ts` creates a separate authenticated Jetli client using the kiosk token provider. The app does not fall back to `bilregApiBase` when `jetliApiBase` is missing.
- `packages/api-client/src/his.ts` currently calls these Jetli routes:
  - `GET Sep/peserta/{noPeserta}` for existing SEP lookup.
  - `GET Sep/reg/{regId}` for SEP by registration.
  - `GET Sep/finger/peserta/{noPeserta}` for fingerprint status.
  - `GET Sep/rujukan/{noPeserta}/peserta` for participant, Rujukan, and SKDP data.
  - `POST Sep` to create a SEP.
  - `PATCH Sep/upload` to associate the SEP with a registration.
- The kiosk registration flow first obtains the participant's active Rujukan/SKDP data, builds a selectable reference list, and selects a reference automatically when only one exists. With multiple references, the user selects one in `BpjsSelectReferenceStep.vue`.
- For adults, biometric verification is performed before registration. Patients under 17 bypass biometric verification.
- The flow creates the Bilreg registration first. For a non-UMUM eligibility requiring eligibility processing, it then creates a SEP, uploads the SEP using the registration ID, and calls Bilreg `Reg/setDataEligibility` with the SEP number, participant number, and SEP ID.
- The printed registration receipt includes the SEP number when one is available. No SKDP is created by the kiosk; SKDP is consumed as an eligibility/reference input.
- The kiosk's `SepCreateBody` schema is permissive and optional for nearly every field. Rujukan and SKDP payload schemas are intentionally permissive (`catchall`) because the provider shape was not confirmed.

### Jetli API

- `SepController` exposes `POST /api/Sep`, `PATCH /api/Sep/upload`, and several SEP/Rujukan queries.
- `GET /api/Sep/rujukan/{noPeserta}/peserta` returns a participant object, a nullable Rujukan response, and a list of SKDP information. The application response types are:
  - `RujukanBpjsGetResponse(Peserta, Rujukan, IEnumerable<SkdpInfo>)`.
  - `SkdpInfo(NoSkdp, TglRencanaKontrol, TglExpired, IsSpri, PoliPerujuk, PoliTujuan, Diagnosa, Keterangan)`.
- SEP creation is handled by `SepCreateCommand`, requiring the command fields used by the kiosk. The handler resolves the supplied reference first as a Rujukan and then as a SKDP control-letter number.
- SEP creation requires a participant record, validates the reference when `NoRujukan` is supplied, resolves diagnosis data, and creates/persists a Jetli SEP. The response is `SepCreateResponse(SepId, SepNo)`.
- SEP upload requires a Jetli SEP ID and a Bilreg registration ID. It loads the registration, service, and doctor, binds those values to the SEP, persists the uploaded SEP, and returns `SepId`, `SepNo`, and `RegId`.
- Jetli has a `SkdpController` with `POST /api/Skdp` for creating an SKDP from a rencana kontrol, plus GET routes by internal ID, control-letter number, rencana kontrol ID, and date. These routes are not currently used by the kiosk client.
- Jetli's SKDP creation path is represented by `SkdpGenFromRencKontrolCmd` and the related SPRI repository/application services. It requires an existing rencana kontrol/registration context and is not a simple kiosk participant lookup operation.

## Existing Constraints

- The kiosk is an external client of both Bilreg and Jetli. It must use the existing runtime configuration and token provider boundaries.
- The kiosk is a self-registration flow and must not silently create a second eligibility or registration ledger.
- Jetli uses JSend response envelopes (`JSendOk`) and the shared HTTP client unwraps those responses before Zod validation.
- The client currently depends on field names and shapes that are not represented by a versioned Jetli contract document.
- SEP creation occurs after Bilreg registration. A failure after registration can leave a registration without completed eligibility data unless a defined recovery/reconciliation behavior exists.
- BPJS/VClaim rules and payload validity are externally governed and may vary by service type, reference type, participant data, and current BPJS integration rules.
- This assessment does not approve technical realization or alter Jetli/Bilreg source code.

---

# 3. Gap Analysis

| ID | Severity | Gap |
|------|------|------|
| GAP-001 | CLOSED | The current source comparison confirms the kiosk still contains obsolete Rujukan/SKDP mappings (`tglMulai`, nested `diagnosa.kode`/`nama`, and fallback `Z00.0`), while Jetli's authoritative response is `RujukanBpjsGetResponse` with `TglRencanaKontrol`, `TglExpired`, and `Icd10Type` fields. The legacy mapping is identified and must be replaced; it is no longer an unanswered contract question. |
| GAP-002 | CLOSED | The kiosk is rawat jalan only. `kelasRawatId` means the participant's BPJS entitlement class; the value `3` is the default class for this rawat jalan/non-class flow. Jetli's current derivation of service type from whether the field is empty is inconsistent with this business meaning. |
| GAP-003 | CLOSED | The kiosk consumes existing Rujukan/SKDP data only. It must not create SKDP. Jetli SKDP creation remains outside kiosk scope. |
| GAP-004 | CLOSED | The authoritative Rujukan/SKDP contract is the current Jetli source in `b12-Jetli-JknTrustedLinkApi`, specifically `RujukanBpjsGetResponse`, `RujukanBpjsInfo`, and `SkdpInfo` in `Jetli.Application/VClaimContext/SepFeature/RujukanBpjsGetQuery.cs`. Legacy frontend assumptions are obsolete. |
| GAP-005 | CLOSED | Post-registration recovery uses a simple operation-specific retry policy: SEP creation is not automatically retried; SEP upload is retried up to three times; Bilreg eligibility update is retried up to three times. If upload or eligibility update still fails, the existing registration is preserved and the patient is routed to the admisi fallback. |
| GAP-006 | CLOSED | The current Jetli source is the contract authority for successful and error behavior. The client must align to Jetli's actual JSend-wrapped responses and no longer preserve legacy response-shape assumptions. |
| GAP-007 | CLOSED | Jetli is authoritative for active SKDP filtering: `RujukanBpjsGetHandler` returns only SKDP entries whose `TglExpired > DateTime.Now`. The kiosk consumes the returned list and does not redefine expiry. |
| GAP-008 | CLOSED | Candidate-reference semantics are explicit: a Rujukan candidate uses `Rujukan.NoRujukan`; an SKDP candidate uses `SkdpInfo.NoSkdp`. The selected reference type must remain available to registration and SEP orchestration even if the UI context stores the selected number in a common field. |
| GAP-009 | CLOSED | SEP payload defaults are reference-type-specific. For Rujukan, the standard outpatient defaults remain applicable. For SKDP/control, use `tujuanKunjunganId: '2'`, `assesmentPelayananId: '5'`, empty `flagProcedureId` and `penunjangId`, the SKDP number as `NoRujukan`, empty `faskesPerujukId`, and diagnosis from the selected Rujukan/SKDP. |
| GAP-010 | CLOSED | Registration mapping is reference-type-specific. A Rujukan is resolved through Jetli `FaskesPerujuk.FaskesId` → Bilreg `Rujukan/ppk/{ppkId}` before registration. An SKDP uses `RujukanId: ''` and `CaraMasukDkId: '8'` (`DATANG SENDIRI`), without PPK/Faskes lookup. |
| GAP-011 | CLOSED | `RujukanBpjsInfo` exposes `FaskesPerujuk`, but the current `SkdpInfo` response does not expose the originating Rujukan's `FaskesPerujukId`. This is not required for the approved SKDP path because an SKDP/control visit uses `CaraMasukDkId: '8'` (`DATANG SENDIRI`) and does not resolve through PPK/Faskes. |

---

# 4. Open Questions

| ID | Question | Impact |
|------|------|------|
| OQ-001 | CLOSED — For kiosk outpatient self-registration, what is the authoritative SEP service type and class meaning? | Kiosk registration is always rawat jalan. `kelasRawatId` means the participant's BPJS class; default `3` represents the rawat jalan/non-class flow. Jetli must not infer rawat inap merely because the class is non-empty. |
| OQ-002 | CLOSED — Should the kiosk create an SKDP, or only use an existing BPJS SKDP/control letter returned by Jetli? | The kiosk only consumes existing Rujukan/SKDP data. It does not create SKDP. |
| OQ-003 | CLOSED — What is the authoritative client contract for Rujukan and SKDP response fields, including diagnosis, date, expiry, service/poli, and reference type? | Use the current Jetli source contract. The primary response types are `RujukanBpjsGetResponse`, `RujukanBpjsInfo`, and `SkdpInfo` in `Jetli.Application/VClaimContext/SepFeature/RujukanBpjsGetQuery.cs`. Legacy frontend assumptions are obsolete. |
| OQ-004 | CLOSED — When multiple references exist, should the patient choose any active reference, or must the kiosk restrict choices by selected clinic/service, date, control-letter date, or reference type? | The kiosk must use the existing Bilreg clinic/service/doctor/schedule APIs to constrain candidates where the selected service and schedule provide the relevant context. The reference itself remains supplied by Jetli. Bilreg references include `GET Layanan`, `GET Layanan/{instalasiDkId}/list`, `GET Ppa/dokter/{layananId}`, and `GET JadwalPraktek/layanan/{layananId}`. Exact orchestration belongs to Architecture. |
| OQ-005 | CLOSED | Which reference values are candidates for SEP `NoRujukan`? | A Rujukan candidate uses `Rujukan.NoRujukan`; an SKDP/control-letter candidate uses `SkdpInfo.NoSkdp`. For SKDP, the selected number is submitted to Jetli as `NoRujukan`, while local Bilreg registration uses an empty `rujukanId`. |
| OQ-006 | CLOSED — What must happen if registration succeeds but SEP creation, SEP upload, or `Reg/setDataEligibility` fails? | Use a simple retry policy. If the retry still fails, use the failed-booking/admisi fallback and default service point. Treat the registration as already created, print a special notice containing `Berhasil Registrasi regid : RGxxx`, and instruct the patient to go to admisi for document completion. SEP upload/recovery is then handled by admisi. |
| OQ-007 | CLOSED | Jetli and Bilreg calls use the existing kiosk authentication boundaries and token providers. No separate business decision is required for the SEP/SKDP flow; implementation and deployment verification remain technical concerns. | Affects deployment readiness and failure diagnosis, but does not block the business flow decision. |
| OQ-008 | CLOSED — Which Jetli API version/deployment is authoritative for the configured `jetliApiBase`, and does it match the checked-out source? | The latest checked-out Jetli API source in `b12-Jetli-JknTrustedLinkApi` is authoritative. Runtime deployment comparison is out of scope. |
| OQ-009 | CLOSED — Should SEP creation be idempotent when the same registration/reference is retried? | Jetli rejects duplicate SEP creation. SEP creation is allowed only once. Retry behavior must therefore not blindly repeat a successful or unknown-outcome SEP creation; recovery must distinguish creation from later upload/eligibility failures. |
| OQ-010 | CLOSED | What exact BPJS/VClaim business rules determine valid `tujuanKunjungan`, diagnosis, procedure, and Rujukan/SKDP combinations for kiosk rawat jalan? | Rujukan uses the standard outpatient defaults. SKDP/control uses `tujuanKunjunganId: '2'`, `assesmentPelayananId: '5'`, empty `flagProcedureId` and `penunjangId`, the SKDP number as `NoRujukan`, empty `faskesPerujukId`, and diagnosis from the selected Rujukan/SKDP. |
| OQ-011 | CLOSED | For a selected Rujukan, use the officer-style PPK-to-local-Rujukan mapping. For a selected SKDP/control visit, do not resolve through PPK/Faskes; use `CaraMasukDkId: '8'` (`DATANG SENDIRI`) because the patient is attending for control. The selected SKDP number remains the BPJS reference for SEP creation, while local registration admission-channel semantics are `DATANG SENDIRI`. | Resolves the local registration path without an additional originating-Rujukan lookup for SKDP. |

---

# 5. Assumptions

| ID | Assumption |
|------|------|
| ASM-001 | “SEP/SKDP related to kiosk” means the BPJS self-registration flow in `useKioskRegistration.ts`, not the separate Jetli clinical/admin workflows for creating SPRI/SKDP from a rencana kontrol. |
| ASM-002 | The checked-out Jetli source is intended to represent the API behind the configured development `jetliApiBase`; this is not verified against a running deployment. |
| ASM-003 | JSON serialization uses the usual ASP.NET Core camel-case policy, so C# names such as `TglRencanaKontrol` are exposed as `tglRencanaKontrol` unless deployment configuration overrides it. |
| ASM-004 | The kiosk is intended to register rawat jalan, based on its `rajalWalkIn` and `rajalByBooking` Bilreg routes and the kiosk service-selection flow. |
| ASM-005 | Existing SKDP data returned by Jetli is expected to be active/current at the time of kiosk selection, subject to the unresolved date and expiry policy. |

---

# 6. Risks

| ID | Risk | Impact | Mitigation |
|------|------|------|------|
| RISK-001 | A provider response shape changes while permissive Zod schemas continue to parse it. | The kiosk may create an SEP using fallback diagnosis/date/reference values rather than stopping safely. | Resolve OQ-003 and establish a strict, versioned contract with contract tests before changing implementation. |
| RISK-002 | Jetli currently derives service type from whether `KelasRawatId` is empty, while the business meaning is BPJS class. | BPJS SEP rejection or incorrect clinical/financial classification. | GAP-002/OQ-001 are closed as a business decision; Architect must define the explicit outpatient contract correction. |
| RISK-003 | A partial post-registration flow leaves an incomplete eligibility record. | Patient confusion and manual correction. | The approved fallback prevents duplicate registration, retries several times, prints the existing `regId`, and routes the patient to admisi. Idempotency and exact retry classification remain open. |
| RISK-004 | Kiosk attempts to create SKDP without the required rencana kontrol/clinical context. | Invalid SKDP, incorrect control-letter linkage, or unauthorized BPJS transaction. | Closed by keeping SKDP creation outside kiosk scope. |
| RISK-005 | The checked-out Jetli source differs from a runtime deployment. | Runtime behavior may differ from source-based analysis. | Runtime comparison is explicitly out of scope; the latest checked-out Jetli source is authoritative for this assessment. |
| RISK-006 | The kiosk uses a BPJS reference number where Bilreg registration expects a local `RujukanId`, while applying one admission-channel rule to both Rujukan and SKDP. | Rujukan registration may be linked to the wrong local referral master, or SKDP may be incorrectly classified as a referral admission. | Use PPK-to-local-Rujukan mapping for Rujukan and `CaraMasukDkId: '8'` (`DATANG SENDIRI`) for SKDP; preserve the reference type through orchestration. |

---

# 7. Recommendations

## Option A

Keep the kiosk as a consumer of existing Rujukan/SKDP data and make the Jetli/Bilreg SEP contract explicit and aligned for outpatient self-registration.

### Advantages

- Matches the current kiosk flow and existing Jetli separation between lookup and SKDP creation.
- Avoids creating a control letter without a defined rencana kontrol/clinical authorization.
- Limits the change to contract alignment, validation, and recovery behavior.

### Disadvantages

- Does not support a new kiosk-initiated SKDP creation use case.
- Requires business clarification and coordinated contract changes across Jetli, the shared client, and kiosk flow.

## Option B

Extend the kiosk flow to create or request an SKDP before SEP creation.

### Advantages

- Could support a future workflow where kiosk registration is the entry point for a control-letter process.
- Makes SKDP creation an explicit step rather than relying on existing local data.

### Disadvantages

- Jetli's current SKDP creation path requires rencana kontrol/registration context and is not equivalent to a simple kiosk request.
- Adds BPJS side effects and additional failure/recovery states to a self-service flow.
- Cannot be assessed as feasible until the business authorization, required inputs, and reference relationship are defined.

---

# 8. Gap Closure

## GAP-001

### Decision

The current Jetli source is the authoritative Rujukan/SKDP contract, and the kiosk's legacy response mapping is obsolete. The kiosk must consume `RujukanBpjsGetResponse`, `RujukanBpjsInfo`, and `SkdpInfo`, including `TglRujukan`, `TglRencanaKontrol`, `TglExpired`, and the actual `Icd10Type` fields. It must not use `tglMulai`, legacy nested diagnosis names, or fallback diagnosis `Z00.0` as a substitute for missing Jetli data.

### Rationale

The source comparison shows that the current kiosk parser and selection model were built against an older provider shape, while Jetli now exposes a fixed application contract.

### Impact

The current kiosk implementation is not contract-aligned. Reference display, selected diagnosis, SEP payload construction, and validation must be based on Jetli fields. A missing required diagnosis or reference field must be treated as an invalid/incomplete eligibility context rather than silently replaced by an invented default.

### Architecture Impact

Architecture must define the Jetli-to-kiosk contract boundary and the safe failure behavior for incomplete reference data. It must not preserve the obsolete frontend shape as a compatibility authority.

### Resolved By

Business owner / Analyst

### Resolved Date

2026-09-24

## GAP-002

### Decision

Kiosk registration is always rawat jalan. `kelasRawatId` represents the participant's BPJS entitlement class, with default value `3` for this rawat jalan/non-class flow. It must not be interpreted as a rawat inap indicator solely because it is non-empty.

### Rationale

The kiosk only supports rawat jalan registration, and the business meaning of the field is BPJS class rather than service type.

### Impact

SEP request and response contract validation must preserve the distinction between service type and BPJS class. Existing Jetli interpretation is a contract gap to be addressed by the Architect.

### Architecture Impact

Architecture must define an explicit outpatient SEP realization and prevent class presence from selecting rawat inap behavior.

### Resolved By

Business owner / Analyst

### Resolved Date

2026-09-24

## GAP-003

### Decision

The kiosk consumes existing Rujukan/SKDP data and does not create SKDP. Jetli SKDP creation remains outside this feature.

### Rationale

SKDP creation requires a rencana kontrol/clinical context and is not part of kiosk self-registration.

### Impact

Kiosk scope remains lookup, selection, SEP creation, SEP upload, and eligibility recording. No kiosk `POST /api/Skdp` flow is required.

### Architecture Impact

Architecture must treat Jetli SKDP creation endpoints as out of scope and define only the existing-reference consumption boundary.

### Resolved By

Business owner / Analyst

### Resolved Date

2026-09-24

## OQ-001

### Decision

Kiosk registration is rawat jalan only. `kelasRawatId` is the BPJS class, defaulting to `3`; it is not the service-type selector.

### Rationale

Confirmed business rule.

### Impact

The client and Jetli contract must represent outpatient service type independently from BPJS class.

### Architecture Impact

Architecture must define the explicit contract mapping without prescribing implementation details here.

### Resolved By

Business owner / Analyst

### Resolved Date

2026-09-24

## OQ-002

### Decision

The kiosk does not create SKDP and only consumes existing Rujukan/SKDP references.

### Rationale

Confirmed business scope.

### Impact

No SKDP creation operation is needed in the kiosk flow.

### Architecture Impact

No kiosk integration with Jetli SKDP creation is required.

### Resolved By

Business owner / Analyst

### Resolved Date

2026-09-24

## OQ-006

### Decision

After registration exists, SEP creation is not automatically retried because Jetli permits only one SEP creation. SEP upload is retried up to three times, and Bilreg eligibility update is retried up to three times. If a post-creation operation still fails, the kiosk uses the failed-booking/admisi fallback with the configured default service point, prints a special registration notice containing `Berhasil Registrasi regid : RGxxx`, and directs the patient to admisi for document completion. Admisi owns subsequent SEP upload/recovery.

### Rationale

The registration already exists and must not be duplicated. The patient needs a usable handoff and the admisi team must complete the remaining eligibility work.

### Impact

The kiosk needs a post-registration failure state distinct from an ordinary registration failure. The fallback must preserve the existing `regId`, identify the default service point, and produce the special printed instruction. The exact retry count and retryable error classification remain unresolved.

### Architecture Impact

Architecture must define the retry boundary, idempotency/retry safety, post-registration failure state, fallback queue orchestration, and print data needed by admisi. It must not create a second registration.

### Resolved By

Business owner / Analyst

### Resolved Date

2026-09-24

## OQ-008

### Decision

Use the latest checked-out Jetli source in `b12-Jetli-JknTrustedLinkApi` as the authoritative reference. Runtime deployment comparison is not required for this assessment.

### Rationale

Confirmed project working rule.

### Impact

Contract analysis is grounded in the current source tree. Deployment verification is not a blocker for architecture analysis.

### Architecture Impact

Architecture should reference the current Jetli source contract and identify any required source changes for the Architect/Jetli owner.

### Resolved By

Business owner / Analyst

### Resolved Date

2026-09-24

---

## GAP-004

### Decision

The current Jetli source is the authoritative Rujukan/SKDP contract. The frontend's previous permissive/legacy assumptions are obsolete. The kiosk must align with `RujukanBpjsGetResponse`, `RujukanBpjsInfo`, and `SkdpInfo` from `Jetli.Application/VClaimContext/SepFeature/RujukanBpjsGetQuery.cs`.

### Rationale

The requested source-of-truth rule explicitly selects the latest checked-out Jetli API source.

### Impact

Frontend schemas and mapping must represent Jetli's actual fields, including `TglRujukan`, `TglRencanaKontrol`, `TglExpired`, `Diagnosa`, `PoliPerujuk`, and `PoliTujuan`. Legacy names such as `tglMulai` must not remain authoritative.

### Architecture Impact

Architecture must define a contract adapter or shared contract aligned to Jetli source without retaining obsolete field assumptions.

### Resolved By

Business owner / Analyst

### Resolved Date

2026-09-24

## GAP-006

### Decision

The client must align to the current Jetli source and its JSend-wrapped result behavior; legacy response-shape assumptions are not authoritative.

### Rationale

Jetli source is the selected contract authority.

### Impact

Client success parsing and error handling must be based on current Jetli behavior. The source contract must be treated consistently for SEP lookup, Rujukan/SKDP lookup, create, and upload.

### Architecture Impact

Architecture must define the cross-repository contract boundary and error handling without duplicating legacy contract models.

### Resolved By

Business owner / Analyst

### Resolved Date

2026-09-24

## GAP-007

### Decision

Jetli determines active SKDP records using its existing expiry filter. The kiosk consumes the returned active list and does not redefine expiry locally.

### Rationale

Jetli is the authoritative source for Rujukan/SKDP eligibility data.

### Impact

The kiosk must not silently substitute a different expiry calculation. The source timezone/date behavior remains part of the Jetli contract.

### Architecture Impact

Architecture must preserve Jetli's authority for active SKDP filtering.

### Resolved By

Business owner / Analyst

### Resolved Date

2026-09-24

## OQ-003

### Decision

Use the current Jetli response types as the authoritative contract; all legacy frontend assumptions are obsolete.

### Rationale

Confirmed source-of-truth decision.

### Impact

The kiosk mapping must use Jetli's actual response vocabulary and fail safely when required fields are absent rather than applying obsolete fallbacks.

### Architecture Impact

Architecture must define the contract alignment across Jetli and the kiosk API client.

### Resolved By

Business owner / Analyst

### Resolved Date

2026-09-24

## OQ-004

### Decision

Reference candidates must be constrained using the selected Bilreg clinic/service/doctor/schedule context where applicable. Bilreg provides the relevant service and schedule APIs; Jetli provides the Rujukan/SKDP candidates.

### Rationale

The selected outpatient service must remain compatible with the reference and its available schedule.

### Impact

The flow must coordinate Jetli reference data with Bilreg service catalog and schedule data. Exact matching rules are an architecture/business orchestration concern.

### Architecture Impact

Architecture must define how Jetli references and Bilreg clinic/service/doctor/schedule context interact without making either system's domain data authoritative in the wrong boundary.

### Resolved By

Business owner / Analyst

### Resolved Date

2026-09-24

## OQ-011

### Decision

Rujukan and SKDP use different local admission-channel rules. For a selected Rujukan, the kiosk must use the officer-style mapping from Jetli `FaskesPerujuk.FaskesId` through Bilreg `GET /api/Rujukan/ppk/{ppkId}` and use the returned local `RujukanId` and `CaraMasukDkId`. For a selected SKDP/control visit, the kiosk must not perform PPK/Faskes lookup; it uses `CaraMasukDkId: '8'` (`DATANG SENDIRI`).

### Rationale

An SKDP represents a control examination performed by the patient. Looking up the originating Rujukan/PPK would add latency and is not required for the local admission-channel decision. Bilreg explicitly defines `8` as `DATANG SENDIRI`.

### Impact

The selected SKDP remains the BPJS `NoRujukan` candidate for SEP creation, but it is not treated as a Bilreg local Rujukan master ID. The registration flow must carry the selected reference type so it can apply the correct local registration rule. For Rujukan, `CaraMasukDkId` is obtained from the PPK mapping; for SKDP, it is `8`.

### Architecture Impact

Architecture must define the reference-type-specific orchestration and preserve the distinction between BPJS SEP reference and Bilreg local registration reference. It must not add an originating-Rujukan lookup to the SKDP path unless a future business decision changes this rule.

### Resolved By

Business owner / Analyst

### Resolved Date

2026-09-24

## OQ-009

### Decision

SEP creation is one-time. Jetli rejects duplicate SEP creation. Retry/recovery must not blindly repeat SEP creation when the result is successful or unknown; later upload and eligibility operations must be handled separately.

### Rationale

Confirmed Jetli business behavior.

### Impact

The workflow needs a distinction between SEP creation and subsequent SEP upload/eligibility update. An unknown create outcome requires a lookup/recovery decision rather than another create request.

### Architecture Impact

Architecture must define one-time creation state, unknown-outcome recovery, and safe continuation to upload without duplicate SEP creation.

### Resolved By

Business owner / Analyst

### Resolved Date

2026-09-24

---

## GAP-005

### Decision

Use three retries for SEP upload and Bilreg eligibility update. Do not automatically retry SEP creation because Jetli permits only one SEP creation. If a post-creation operation still fails, preserve the existing registration and route the patient to admisi.

### Rationale

SEP creation is not safely repeatable, while upload and eligibility update are the recoverable follow-up operations.

### Impact

The flow must distinguish creation failure from post-creation failure and must not create a second registration or SEP.

### Architecture Impact

Architecture must define operation-specific retry and recovery states.

### Resolved By

Business owner / Analyst

### Resolved Date

2026-09-24

## GAP-008

### Decision

Rujukan and SKDP numbers are both valid Jetli SEP reference candidates, but the selected reference type must remain explicit. Rujukan uses `Rujukan.NoRujukan`; SKDP uses `SkdpInfo.NoSkdp`.

### Rationale

The same `NoRujukan` submission field has different source semantics for the two reference types.

### Impact

The kiosk must not lose the selected type when constructing registration and SEP data.

### Architecture Impact

Architecture must preserve reference type across orchestration boundaries.

### Resolved By

Business owner / Analyst

### Resolved Date

2026-09-24

## GAP-009

### Decision

Use reference-type-specific SEP defaults. Rujukan uses the standard outpatient values. SKDP/control uses `tujuanKunjunganId: '2'`, `assesmentPelayananId: '5'`, empty `flagProcedureId` and `penunjangId`, the SKDP number as the Jetli reference, empty `faskesPerujukId`, and diagnosis from the selected Rujukan/SKDP.

### Rationale

SKDP represents a control visit to the same clinic and requires the BPJS control combination.

### Impact

The previous generic defaults are not valid for every reference type. Diagnosis is required from authoritative Jetli data; it must not silently fall back to `Z00.0`.

### Architecture Impact

Architecture must model reference-type-specific SEP payload policy.

### Resolved By

Business owner / Analyst

### Resolved Date

2026-09-24

## GAP-010

### Decision

Resolve Rujukan through PPK-to-local-Rujukan mapping before registration. For SKDP, use local `RujukanId: ''` and `CaraMasukDkId: '8'` (`DATANG SENDIRI`) without PPK/Faskes lookup.

### Rationale

Registration requires local `RujukanId` and admission channel before creation. SKDP control visits do not require originating-referral lookup.

### Impact

The registration payload differs by selected reference type.

### Architecture Impact

Architecture must perform Rujukan mapping before registration and apply the direct SKDP rule.

### Resolved By

Business owner / Analyst

### Resolved Date

2026-09-24

## GAP-011

### Decision

No originating PPK is required for SKDP registration.

### Rationale

SKDP is treated as a patient-initiated control visit, using `DATANG SENDIRI`.

### Impact

The current `SkdpInfo` response does not need to be extended for this flow.

### Architecture Impact

Architecture must not add an unnecessary SKDP-to-originating-Rujukan lookup.

### Resolved By

Business owner / Analyst

### Resolved Date

2026-09-24

## OQ-005

### Decision

Use `Rujukan.NoRujukan` for Rujukan and `SkdpInfo.NoSkdp` for SKDP as the Jetli SEP reference. For SKDP, local Bilreg `rujukanId` remains empty.

### Rationale

Jetli resolves the selected number as either Rujukan or SKDP, while Bilreg local registration has separate admission semantics.

### Impact

BPJS reference and local Bilreg reference must not be conflated.

### Architecture Impact

Architecture must keep the two identifiers separate.

### Resolved By

Business owner / Analyst

### Resolved Date

2026-09-24

## OQ-007

### Decision

Use the existing kiosk authentication boundaries for Jetli and Bilreg. No additional business decision is required.

### Rationale

Authentication/token handling is an existing infrastructure boundary, not a new SEP/SKDP business rule.

### Impact

Implementation must continue using the configured authenticated clients.

### Architecture Impact

Architecture may validate the existing integration boundary but does not need a new authorization model for this feature.

### Resolved By

Business owner / Analyst

### Resolved Date

2026-09-24

## OQ-010

### Decision

Rujukan uses standard outpatient SEP defaults. SKDP/control uses `tujuanKunjunganId: '2'`, `assesmentPelayananId: '5'`, empty `flagProcedureId` and `penunjangId`, empty `faskesPerujukId`, and diagnosis from Jetli Rujukan/SKDP data.

### Rationale

The SKDP combination represents standard same-poli control / second visit.

### Impact

SEP payload construction must branch by reference type and must reject missing diagnosis rather than inventing a fallback.

### Architecture Impact

Architecture must define the payload policy boundary without duplicating BPJS domain rules in the kiosk.

### Resolved By

Business owner / Analyst

### Resolved Date

2026-09-24

## OQ-011

### Decision

Rujukan uses PPK mapping before registration. SKDP uses `rujukanId: ''` and `caraMasukDkId: '8'` (`DATANG SENDIRI`) without PPK lookup.

### Rationale

Confirmed business rule for control visits.

### Impact

The registration command must be assembled only after the reference-type-specific local mapping is known.

### Architecture Impact

Architecture must place the mapping decision before registration creation.

### Resolved By

Business owner / Analyst

### Resolved Date

2026-09-24

---

# 9. Planning Readiness

## Readiness Checklist

- [ ] All critical gaps resolved
- [ ] All required decisions recorded
- [ ] All blocking open questions resolved
- [ ] Architecture can be finalized or updated

## Status

NOT-READY

## Notes

The business decisions for outpatient registration, BPJS class semantics, SKDP consumption-only scope, post-registration retry/fallback, Jetli source-of-truth, response contract, reference candidates, one-time SEP creation, reference-type-specific local admission mapping, and SKDP control payloads have been recorded. Source analysis confirms that Rujukan uses PPK-to-local-Rujukan mapping, while SKDP/control visits use `CaraMasukDkId: '8'` (`DATANG SENDIRI`) with an empty local `rujukanId` and control SEP values. Readiness remains NOT-READY only because Architecture must validate the realization against current Bilreg/Jetli boundaries; no additional business answer is currently blocking Architecture review. The Architect must review the admisi fallback, one-time SEP creation recovery, reference-type-specific registration mapping, and special registration print notice.

---

# 10. References

Referenced artifacts:

- `c013-kiosk-queue-display-web/docs/domain-model.md`
- `c013-kiosk-queue-display-web/docs/adr/ADR-002-jaminan-eligibility-rule.md`
- `c013-kiosk-queue-display-web/docs/adr/ADR-003-biometric-contract.md`
- `c013-kiosk-queue-display-web/docs/adr/ADR-005-kiosk-orchestration-state-machine.md`
- `c013-kiosk-queue-display-web/docs/adr/ADR-009-patient-context-re-query-booking-continuation.md`

Referenced codebase locations:

- `c013-kiosk-queue-display-web/apps/kiosk-web/src/composables/useKioskRegistration.ts`
- `c013-kiosk-queue-display-web/apps/kiosk-web/src/infrastructure.ts`
- `c013-kiosk-queue-display-web/apps/kiosk-web/src/views/steps/BpjsSelectReferenceStep.vue`
- `c013-kiosk-queue-display-web/packages/api-client/src/his.ts`
- `c013-kiosk-queue-display-web/packages/shared-types/src/index.ts`
- `c013-kiosk-queue-display-web/apps/kiosk-web/public/global_config.json`
- `b12-Jetli-JknTrustedLinkApi/Jetli.Api/Controllers/VClaimContext/SepController.cs`
- `b12-Jetli-JknTrustedLinkApi/Jetli.Api/Controllers/VClaimContext/SkdpController.cs`
- `b12-Jetli-JknTrustedLinkApi/Jetli.Application/VClaimContext/SepFeature/SepCreateCommand.cs`
- `b12-Jetli-JknTrustedLinkApi/Jetli.Application/VClaimContext/SepFeature/SepUploadCommand.cs`
- `b12-Jetli-JknTrustedLinkApi/Jetli.Application/VClaimContext/SepFeature/RujukanBpjsGetQuery.cs`
- `b12-Jetli-JknTrustedLinkApi/Jetli.Application/VClaimContext/SkdpFeature/SkdpGenFromRencKontrolCmd.cs`
- `b12-Jetli-JknTrustedLinkApi/Jetli.Infrastructure/VClaimContext/SepFeature/SepBpjsCreateDto.cs`
- `b12-Jetli-JknTrustedLinkApi/Jetli.Infrastructure/VClaimContext/SkdpFeature/SkdpBpjsGetDto.cs`
- `b09-bilreg-api/src/bilreg/Bilreg.Api/Controllers/AdmisiContext/RujukanSub/RujukanController.cs`
- `b09-bilreg-api/src/bilreg/Bilreg.Application/AdmisiContext/RujukanFeature/RjkGetByPpkIdQuery.cs`
- `b09-bilreg-api/src/bilreg/Bilreg.Api/Controllers/AdmisiContext/LayananSub/LayananController.cs`

Referenced documents:

- `c013-kiosk-queue-display-web/AGENTS.md`
- `b12-Jetli-JknTrustedLinkApi/README.md`
