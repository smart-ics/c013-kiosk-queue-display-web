---
Title: Kiosk SEP and SKDP Integration Implementation Plan
Code: KIOSK-SEP-SKDP
Artifact: IMPLEMENTATION-PLAN
Version: 1.0
LastUpdated: 2026-09-24
Status: COMPLETED
Execution Approval: APPROVED
---

# 1. Objective

Implement the approved kiosk SEP/SKDP integration architecture for rawat jalan self-registration.

Referenced artifacts:

- ARCHITECTURE: `c013-kiosk-queue-display-web/docs/architecture/KIOSK-SEP-SKDP-ARCHITECTURE.md`
- FEASIBILITY-ASSESSMENT: `c013-kiosk-queue-display-web/docs/analysis/KIOSK-SEP-SKDP-FEASIBILITY-ASSESSMENT.md`
- Current kiosk flow: `c013-kiosk-queue-display-web/apps/kiosk-web/src/composables/useKioskRegistration.ts`
- Current Jetli contract: `b12-Jetli-JknTrustedLinkApi/Jetli.Application/VClaimContext/SepFeature/`
- Current Bilreg registration contract: `b09-bilreg-api/src/bilreg/Bilreg.Application/AdmisiContext/`

# 2. Planning Scope

Included:

- Jetli-aligned Rujukan/SKDP client contract.
- Explicit `rujukan` and `skdp` reference type preservation.
- Bilreg PPK-to-local-Rujukan mapping before Rujukan registration.
- SKDP registration with empty local `rujukanId` and `caraMasukDkId: "8"`.
- Reference-specific SEP payload construction.
- Explicit outpatient SEP semantics independent of BPJS class.
- One-time SEP creation and safe continuation/recovery.
- Three retries for SEP upload and three retries for Bilreg eligibility update.
- Post-registration admisi fallback and special registration notice.
- Repository-local automated coverage as implementation evidence; final testing gate occurs after plan completion.

Excluded:

- Kiosk SKDP creation.
- Changes to Jetli clinical SKDP generation.
- New Bilreg referral master data.
- Originating-PPK lookup for SKDP.
- Database migrations.
- Implementation of unrelated kiosk flows.

# 3. Dependencies

External dependencies:

- Current Jetli source remains the authoritative contract.
- Existing Bilreg `Rujukan/ppk/{ppkId}` endpoint is available for Rujukan mapping.
- Existing Bilreg registration, eligibility, admission queue, and print configuration boundaries remain available.
- The configured booking-failure fallback service point exists.

Slice dependencies are listed on every slice below. Independent repository slices may execute in parallel after their prerequisites are satisfied.

# 4. Progress Summary

Execution Approval: APPROVED

| Phase | Implementation Status | Review Status | Progress |
|---------|---------|---------|---------|
| P1 - Provider and local contract foundations | IMPLEMENTED | GO | 2/2 |
| P2 - Kiosk orchestration and client realization | IMPLEMENTED | GO | 3/3 |
| P3 - Recovery, printing, and integration evidence | IMPLEMENTED | GO | 2/2 |

# 5. Phases

## P1 - Provider and local contract foundations

Implementation Status: IMPLEMENTED
Review Status: GO

### P1-S01

Title: Align Jetli SEP creation with outpatient and reference-specific policy

Implementation Status: IMPLEMENTED
Review Status: GO

Objective:

Update the Jetli SEP application boundary so kiosk requests represent rawat jalan explicitly, while preserving one-time SEP creation and the existing Rujukan/SKDP resolution behavior.

Depends On: None

Repository: `b12-Jetli-JknTrustedLinkApi`

Completion Criteria:

- `KelasRawatId` is not used as the rawat jalan/rawat inap discriminator.
- Kiosk-supported SEP creation is explicitly rawat jalan while BPJS class remains class data.
- SKDP control payload values `tujuanKunjunganId: "2"` and `assesmentPelayananId: "5"` are accepted and persisted through the existing Jetli model.
- Diagnosis remains required and is resolved from the selected reference or explicit request diagnosis.
- Duplicate SEP creation remains rejected or safely resolved by existing Jetli behavior; no second-create contract is introduced.
- The response remains compatible with `SepCreateResponse(SepId, SepNo)`.

Notes:

- Aligned Jetli SEP creation boundary with explicit rawat jalan (outpatient) service type semantics.
- Decoupled rawat jalan/rawat inap discriminator from `KelasRawatId` parameter, treating `KelasRawatId` exclusively as BPJS class data.
- Ensured SKDP control values (`tujuanKunjunganId: "2"` and `assesmentPelayananId: "5"`) map cleanly to domain models and persist correctly.
- Maintained diagnosis validation, duplicate-create rejection, and backward-compatible response types.
- Do not add kiosk SKDP creation. Do not change Jetli clinical SKDP generation.

---

### P1-S02

Title: Confirm Bilreg pre-registration mapping and empty-referral registration contract

Implementation Status: IMPLEMENTED
Review Status: GO

Objective:

Ensure the Bilreg integration boundary supports the architecture's two registration mappings without changing local referral master ownership.

Depends On: None

Repository: `b09-bilreg-api`

Completion Criteria:

- `GET /api/Rujukan/ppk/{ppkId}` remains the authoritative Rujukan mapping contract and exposes local `RujukanId` and `CaraMasukDkId`.
- A registration using `caraMasukDkId: "8"` and empty `rujukanId` is accepted for SKDP control visits according to the existing domain rule `DATANG SENDIRI`.
- Bilreg eligibility update remains addressable by `RegId`, SEP number, participant number, and SEP ID.
- Existing admission queue intake can receive the configured kiosk fallback service point.
- Any required contract clarification is covered by repository-local API tests or equivalent contract evidence.

Notes:

- Verified `GET /api/Rujukan/ppk/{ppkId}` returns `RjkGetByPpkIdResponse` containing local `RujukanId` and `CaraMasukDkId`.
- Verified `CaraMasukDkType.DatangSendiri` (`caraMasukDkId = "8"`) has `RequiresRujukan = false`, allowing registration with empty `rujukanId` without referral lookup.
- Verified `RegSetDataEligibilityCmd` (`RegSetDataEligibilityHandler`) updates eligibility addressable by `RegId`, `SjpNo`, `PesertaJaminanId`, and `SjpId`.
- Fixed compiler syntax error in `AdmisiRajalPatientContextQuery.cs` for type-safe build.
- Added repository-local unit test contract evidence in `KioskBilregContractEvidenceTest.cs` covering DatangSendiri rules, PPK mapping response shape, and eligibility command fields.
- Do not add originating-PPK lookup for SKDP. Do not create new referral master data.

---

## P2 - Kiosk orchestration and client realization

Implementation Status: IMPLEMENTED
Review Status: GO

### P2-S03

Title: Replace legacy Jetli Rujukan/SKDP client models

Implementation Status: IMPLEMENTED
Review Status: GO

Objective:

Align shared types and the Jetli API client with the current Jetli source vocabulary and preserve the selected reference discriminator.

Depends On: P1-S01

Repository: `c013-kiosk-queue-display-web`

Completion Criteria:

- `RujukanBpjsGetResponse`, `RujukanBpjsInfo`, and `SkdpInfo` are represented using current Jetli field names.
- Obsolete fields such as `tglMulai` and legacy nested diagnosis aliases are no longer authoritative.
- `RujukanReference` and `SkdpReference` retain distinct types and required fields.
- `SepCreateBody` and response parsing follow the current Jetli/JSend client boundary.
- Missing required diagnosis/reference data fails validation instead of silently using `Z00.0` or an empty date.
- API client methods exist for Bilreg PPK mapping and use the existing authenticated client infrastructure.

Notes:

- Replaced the legacy permissive Rujukan/SKDP catch-all schemas in `@aq/shared-types` with Jetli-aligned strict schemas: `RujukanBpjsGetResponse`, `RujukanBpjsInfo`, `SkdpInfo` (with `tglRencanaKontrol`, `tglExpired`, `Icd10Type` diagnosis, `FaskesPerujuk`, `Tujuan`, `PoliPerujuk`, `PoliTujuan`). Legacy `tglMulai` and nested `diagnosa.kode`/`nama` names are no longer authoritative contract fields; missing required Jetli data now fails schema validation instead of defaulting to `Z00.0` or an empty date.
- Added distinct required reference discriminator models `RujukanReference` (`type: 'rujukan'`) and `SkdpReference` (`type: 'skdp'`) per architecture TD-002.
- Added the Bilreg PPK mapping contract `RjkGetByPpkIdResponse` (local `RujukanId` and `CaraMasukDkId`) to shared types and exposed `getRujukanByPpk(ppkId)` on the authenticated HIS API client (`Rujukan/ppk/{ppkId}`).
- Kept `SepCreateBody`/`SepUploadBody` and JSend response parsing aligned with the current Jetli `SepCreateCommand`/`SepCreateResponse(SepId, SepNo)` boundary; the JSend client unwraps both object and plain-string business-error responses.
- Updated repository-local tests: shared-types schema fixtures now use Jetli field names plus missing-diagnosis and discriminator validation cases; api-client adds a PPK-mapping contract test; kiosk-web `getRujukanSkpd` test fixtures were brought into the typed `RujukanBpjsGetResponse` contract.
- P2-S04 (orchestration rework of the local reference-mapping path), P2-S05 (reference-specific SEP payload policy), and P3 recovery slices remain downstream.

---

### P2-S04

Title: Implement reference-specific pre-registration preparation

Implementation Status: IMPLEMENTED
Review Status: GO

Objective:

Prepare the correct Bilreg registration payload before registration is created.

Depends On: P1-S02, P2-S03

Repository: `c013-kiosk-queue-display-web`

Completion Criteria:

- Rujukan selection calls Bilreg `Rujukan/ppk/{faskesPerujukId}` before registration.
- Rujukan registration uses the returned local `RujukanId` and `CaraMasukDkId`.
- SKDP selection skips PPK lookup.
- SKDP registration uses `rujukanId: ""` and `caraMasukDkId: "8"`.
- A BPJS Rujukan/SKDP number is never copied directly into Bilreg local `rujukanId`.
- Walk-in and booking paths apply the same reference-type rules.

Notes:

- Reworked the kiosk reference-selection model so the selected reference retains the reference discriminator and the Jetli PPK mapping key: `BpjsReference` now carries `faskesPerujukId` (from `RujukanBpjsInfo.FaskesPerujuk.FaskesId`) for Rujukan, and reference parsing reads the already-validated `RujukanBpjsGetResponse` fields instead of legacy permissive inline schemas (legacy `tglMulai` and nested `diagnosa.kode`/`nama` no longer used; no implicit `Z00.0` fallback).
- Added `prepareBilregRegistrationData` as the registration-preparation service (TD-003/TD-004): for `rujukan` it calls Bilreg `Rujukan/ppk/{faskesPerujukId}` (via `deps.getRujukanByPpk`) before registration and uses the returned local `RujukanId` and `CaraMasukDkId`; for `skdp` it skips the PPK lookup and registers with `rujukanId: ""` and `caraMasukDkId: "8"` (DATANG SENDIRI); non-BPJS paths keep the booking `extAppRef.reffId` fallback with `caraMasukDkId: "8"`.
- Booking (`registerBookingCommit`) and walk-in (`registerWalkinCommit`) registration payloads are now built from the resolved local registration data only; a BPJS Rujukan/SKDP number is never copied into the Bilreg local `rujukanId`.
- Wired `getRujukanByPpk` into the kiosk deps (`KioskPage.vue`) and updated/extended repository-local tests: PPK mapping called before registration with the Jetli `faskesPerujukId`, Rujukan payload uses local `RujukanId`/`CaraMasukDkId`, SKDP booking and walk-in skip the PPK lookup and use empty `rujukanId`/`caraMasukDkId "8"`, and the missing-PPK-key guard fails registration.
- P2-S05 (reference-specific SEP payload construction) and P3 recovery slices remain downstream; SEP payload policy is intentionally unchanged here.

---

### P2-S05

Title: Implement reference-specific SEP payload construction

Implementation Status: IMPLEMENTED
Review Status: GO

Objective:

Build valid Jetli SEP requests from the selected typed reference and participant context.

Depends On: P1-S01, P2-S03, P2-S04

Repository: `c013-kiosk-queue-display-web`

Completion Criteria:

- Rujukan uses the approved standard outpatient payload policy.
- SKDP uses `tujuanKunjunganId: "2"` and `assesmentPelayananId: "5"`.
- SKDP uses empty `flagProcedureId`, empty `penunjangId`, empty `faskesPerujukId`, and selected `NoSkdp` as Jetli `NoRujukan`.
- Diagnosis is taken from the selected Jetli Rujukan/SKDP data.
- SEP creation is attempted only once per registration flow.
- The same payload policy is used for booking and walk-in flows.

Notes:

- Added `buildSepPayloadPolicy` as the reference-specific SEP payload policy service (TD-005): for `rujukan` it retains the approved standard outpatient defaults (`tujuanKunjunganId: "0"`, blank `assesmentPelayananId`/`flagProcedureId`/`penunjangId`); for `skdp` it applies the control/second-visit policy (`tujuanKunjunganId: "2"`, `assesmentPelayananId: "5"`, blank `flagProcedureId`/`penunjangId`/`faskesPerujukId`, and the selected `NoSkdp` as Jetli `NoRujukan`). Diagnosis always comes from the selected Jetli reference; a missing/blank diagnosis throws a validation error instead of falling back to `Z00.0`.
- Removed the legacy `activeBpjsContext` mirror and the `diagnosaId ... || 'Z00.0'` fallback from `register()`; SEP payloads are now built from the selected typed reference (`selectedBpjsReference`) and participant context. The same policy is used for booking and walk-in flows because both share `register()`.
- Added `faskesPerujukId` as an optional SEP-create body field in `@aq/shared-types` so the SKDP policy can send the empty value required by TD-005; the field remains optional and passthrough-compatible with the Jetli `SepCreateCommand`.
- SEP creation remains a single call per registration flow: the flow state machine (`REGISTRATION_SUCCESS`/`FAILURE` cannot return to a confirm step) plus the `withSubmit` guard prevent a second create, and `createSep` is not re-invoked when upload fails.
- Added repository-local tests: shared-types schema fixture for the SKDP control SEP-create fields; kiosk-web composable tests for the Rujukan standard-outpatient payload, SKDP booking and walk-in payloads (same policy), one-time SEP creation (including no re-attempt after upload failure), and `buildSepPayloadPolicy` unit cases (Rujukan defaults, SKDP control values with selected NoSkdp as NoRujukan, missing-diagnosis rejection without an implicit fallback).
- P3-S06 (post-registration retry and admisi fallback state) and P3-S07 (recovery print output and implementation evidence) remain downstream.

---

## P3 - Recovery, printing, and integration evidence

Implementation Status: IMPLEMENTED
Review Status: GO

### P3-S06

Title: Implement post-registration retry and admisi fallback state

Implementation Status: IMPLEMENTED
Review Status: GO

Objective:

Make failures after registration recoverable without creating a second registration or SEP.

Depends On: P2-S05

Repository: `c013-kiosk-queue-display-web`

Completion Criteria:

- Registration success is retained before SEP processing begins.
- SEP creation is not automatically repeated.
- SEP upload retries no more than three times.
- `Reg/setDataEligibility` retries no more than three times.
- Existing `regId` is preserved on all post-registration failure paths.
- Exhausted recovery transitions to the existing failed-booking/admisi fallback and configured default service point.
- Unknown SEP-create outcome does not trigger a blind second create.
- Booking and walk-in flows share the same recovery invariants.

Notes:

- Modeled TD-007 as an internal `postRegistrationPhase` ref (`REGISTRATION_CREATED → SEP_CREATE_ATTEMPTED → SEP_CREATED → SEP_UPLOADED → ELIGIBILITY_RECORDED → ADMISI_FALLBACK`) in `useKioskRegistration`; no new KioskFlow UI states were added.
- `register()` retains `registrationResult` (regId) immediately after the registration commit and records `REGISTRATION_CREATED` before any SEP processing; every post-registration failure path (SEP create throw or string business-error response, SEP upload exhaustion after 3 attempts, `Reg/setDataEligibility` exhaustion after 3 attempts, `buildSepPayloadPolicy` failure) preserves the existing regId and transitions through `enterAdmisiFallback()` to the existing `FAILURE → confirmAssistance → ASSISTANCE_QUEUE` admisi fallback with message `Pendaftaran berhasil (regId), namun pemrosesan SEP belum selesai. Silakan menuju Loket Admisi untuk penyelesaian berkas.`
- SEP creation is exactly one attempt — never retried, including for an unknown/ambiguous outcome (string business-error responses are also treated as failures and never re-create).
- `withAttemptLimit` caps `uploadSep` and `setDataEligibility` at `MAX_POST_REGISTRATION_ATTEMPTS = 3` total attempts each, logging each failed attempt with the preserved regId; recovery within the limit continues to the next phase.
- `goHome()` resets `postRegistrationPhase`; `enterAdmisiFallback()` is the single recovery entry, so booking and walk-in share the same invariants.
- `KioskPage` automatic-fallback watch now allows non-booking mode when `postRegistrationPhase === 'ADMISI_FALLBACK'`, so walk-in post-registration recovery also auto-routes to the configured default service point (`fallbackServicePoints.bookingFailure` via `recommendedFallbackServicePointId`); ordinary walk-in failures still keep the manual selector, and booking post-registration recovery uses the existing `bookingAssistance` path unchanged.
- Added repository-local tests: 12 composable tests in `useKioskRegistration.spec.ts` (registration retained before SEP processing, phase advance, one-time create with unknown/business-error outcomes, 3-attempt upload/eligibility retries incl. recovery-within-limit, business-error upload as failed attempt, regId preservation across all three failure paths, walk-in shared invariants, booking → configured fallback via `bookingAssistance`) and 1 `KioskPage.spec.ts` UI test proving a walk-in post-registration SEP-create failure auto-routes through `intake` to the configured admisi fallback (`assist-redirect-queue`) and prints the queue ticket without calling `bookingAssistance`.

---

### P3-S07

Title: Add recovery print output and repository-local implementation evidence

Implementation Status: IMPLEMENTED
Review Status: GO

Objective:

Expose the existing-registration handoff clearly to the patient and provide implementation evidence for the complete cross-repository contract.

Depends On: P1-S02, P3-S06

Repository: `c013-kiosk-queue-display-web`

Completion Criteria:

- Fallback printing includes `Berhasil Registrasi regid : RGxxx`.
- Fallback printing instructs the patient to visit admisi for document completion.
- Normal SEP printing remains unchanged when SEP processing succeeds.
- Repository-local implementation evidence covers Rujukan, SKDP, retry limits, and fallback output.
- No temporary development print/download behavior remains in production paths.

Notes:

- Added the fallback print notice to the queue-ticket render path: `QueueTicketNotice` (`regId` + `instruction`) in `apps/kiosk-web/src/lib/queueTicket.ts`, with `formatRegistrasiFallbackHeader(regId)` producing exactly `Berhasil Registrasi regid : <regId>` and `buildAdmisiFallbackNotice(regId)` producing the admisi instruction `Silakan menuju Loket Admisi untuk penyelesaian berkas.`; `renderQueueTicketPng` prints both lines when a notice is present (canvas height extends to fit).
- `useKioskSelfPrint.printQueueTicket` now accepts an optional notice and forwards it to the renderer; when none is supplied the ticket renders exactly as before (no notice line), so normal queue-ticket printing is unchanged.
- `useKioskRegistration.confirmAssistance` builds the notice only when `postRegistrationPhase === 'ADMISI_FALLBACK'` and the registration exists, passing the preserved `regId` to `printQueueTicket`; the notice is remembered (`assistanceNotice`) so `reprintQueueTicket` reprints it; `goHome()` clears it. Ordinary assistance failures (no post-registration recovery) print without a notice, and the successful SEP path still prints the normal registration receipt with `noSep` and never prints the queue ticket.
- Verified no temporary print/download behavior remains in production paths: no `import.meta.env.DEV` auto-download snippets or `createObjectURL`/anchor-download code exists in `apps/kiosk-web` (AGENTS.md Print Development Mode Guidelines); the only `import.meta.env.DEV` in the repo is display-web's SignalR dev proxy URL selection, which is unrelated to printing.
- Repository-local implementation evidence (automated coverage): existing tests already cover Rujukan (`buildSepPayloadPolicy`/PPK mapping), SKDP (control SEP payload), and retry limits (P3-S06 3-attempt upload/eligibility); this slice adds `queueTicket.spec.ts` (3 tests for the exact fallback header/instruction strings), `useKioskSelfPrint.spec.ts` (notice pass-through + no-notice render), `useKioskRegistration.spec.ts` P3-S07 block (4 tests: booking and walk-in fallback print notice, normal assistance unchanged, successful SEP receipt unchanged), and an extended `KioskPage.spec.ts` assertion that the admisi-fallback intake prints the notice.
- Changed files: `apps/kiosk-web/src/lib/queueTicket.ts`, `apps/kiosk-web/src/composables/useKioskSelfPrint.ts`, `apps/kiosk-web/src/composables/useKioskRegistration.ts`, `apps/kiosk-web/src/lib/__tests__/queueTicket.spec.ts` (new), `apps/kiosk-web/src/composables/__tests__/useKioskSelfPrint.spec.ts`, `apps/kiosk-web/src/composables/__tests__/useKioskRegistration.spec.ts`, `apps/kiosk-web/src/views/__tests__/KioskPage.spec.ts`, and this plan. Repository-wide gate `pnpm turbo run typecheck test` passes (22 tasks).

# 6. Change Log

- 2026-09-24: Initial plan created from KIOSK-SEP-SKDP architecture version 1.0.
- 2026-09-24: P2-S04 implemented — reference-specific pre-registration preparation (Rujukan PPK mapping before registration; SKDP skips PPK lookup with `rujukanId: ""` / `caraMasukDkId: "8"`; BPJS numbers are never used as Bilreg local `rujukanId`).
- 2026-09-24: P2-S05 implemented — reference-specific SEP payload construction (`buildSepPayloadPolicy` per TD-005: Rujukan standard outpatient defaults, SKDP control policy with `tujuanKunjunganId "2"`/`assesmentPelayananId "5"`/empty `flagProcedureId`/`penunjangId`/`faskesPerujukId` and selected NoSkdp as NoRujukan; diagnosis from selected reference with no `Z00.0` fallback; one-time create preserved).
- 2026-09-24: P3-S06 implemented — post-registration retry and admisi fallback state (TD-006/TD-007): `postRegistrationPhase` lifecycle, registration retained with existing `regId` before SEP processing, one-time SEP creation (no blind second create, string business-error responses treated as failure), `uploadSep` and `Reg/setDataEligibility` capped at 3 attempts via `withAttemptLimit`, exhaustion routed through `enterAdmisiFallback()` to the configured `fallbackServicePoints.bookingFailure` service point; `KioskPage` auto-fallback watch extended so walk-in post-registration recovery also auto-routes to the configured default service point while ordinary walk-in failures keep the manual selector. 13 new tests (12 composable + 1 KioskPage UI).
- 2026-09-24: P3-S07 implemented — recovery print output and repository-local implementation evidence: fallback printing now includes `Berhasil Registrasi regid : <regId>` and the admisi instruction (`Silakan menuju Loket Admisi untuk penyelesaian berkas.`) via a queue-ticket notice built only in the `ADMISI_FALLBACK` post-registration phase; normal SEP/queue-ticket printing unchanged; no DEV print/download snippets remain in kiosk-web production paths. Added `queueTicket.spec.ts`, selfPrint notice tests, a `useKioskRegistration` P3-S07 test block, and extended `KioskPage.spec.ts`; full repo gate `pnpm turbo run typecheck test` passes.
- 2026-09-28: Aggregate status reconciled per RV-001 (Architect) — phase-level status fields for P1, P2, and P3 set to `IMPLEMENTED` / `GO`, and the section 4 Progress Summary table aligned to the same completed state, with the `Execution Approval` value reconciled to `APPROVED` (matching the frontmatter). Slice-level statuses, plan structure, slice count, ordering, dependencies, and completion criteria are unchanged.
