---
Title: Kiosk setDataEligibility Upload-Authoritative Identity Implementation Plan
Code: KIOSK-SETDATAELIGIBILITY-SJP
Artifact: IMPLEMENTATION-PLAN
Version: 1.0
LastUpdated: 2026-09-29
Status: COMPLETED
Execution Approval: APPROVED
---

# 1. Objective

Correct the kiosk post-registration handoff so `PATCH Reg/setDataEligibility` consumes only the validated `PATCH Sep/upload` identity, per the approved correction.

Planning Mode: FEATURE-PLANNING

Referenced artifacts:

- BUG-INVESTIGATION: `c013-kiosk-queue-display-web/docs/analysis/KIOSK-SETDATAELIGIBILITY-SJP-BUG-INVESTIGATION.md` (v1.2, INVESTIGATION-COMPLETE; OQ-01/OQ-02 CLOSED, OQ-03 administrative non-blocking, OQ-04 informational non-blocking)
- ARCHITECTURE: `c013-kiosk-queue-display-web/docs/architecture/KIOSK-SETDATAELIGIBILITY-SJP-ARCHITECTURE.md` (v1.0; TD-SJP-01–TD-SJP-03 authoritative)
- Baseline capability reference (unchanged): `c013-kiosk-queue-display-web/docs/architecture/KIOSK-SEP-SKDP-ARCHITECTURE.md` (v1.1)
- Current truth: `c013-kiosk-queue-display-web/apps/kiosk-web/src/composables/useKioskRegistration.ts` (`register()` ll. 943–969: upload result discarded, eligibility reads `sepRes.*`), `c013-kiosk-queue-display-web/packages/shared-types/src/index.ts` (`responseUploadSepSchema` ll. 666–675, `payloadSetDataEligibilitySchema` ll. 403–408 — both unchanged by this plan)

Architecture Applicability: ARCHITECTURE-REQUIRED (correction changes orchestration data flow and contract boundary, as decided in BUG-INVESTIGATION § Architecture Applicability and realized in the ARCHITECTURE above).

---

# 2. Planning Scope

Included:

- Capture the resolved upload object in `register()` and wire `upload.sepNo`/`upload.sepId` to `setDataEligibility` (`sjpNo`/`sjpId`) and to the session/print `sepNo` state.
- `isValidUploadSepNo` guard (non-blank, not `"-"`) before any eligibility call; invalid identity routes to existing `enterAdmisiFallback()` with `regId` preserved and no eligibility call.
- Regression + fallback automated coverage in `apps/kiosk-web` (booking and walk-in parity through the shared `register()` path); repo gate `pnpm turbo run typecheck test` as evidence.

Excluded (per ARCHITECTURE §3):

- Any `b09-bilreg-api` change; any Jetli/Bilreg contract or error-shape change; any `payloadSetDataEligibilitySchema` change; any retry-budget, pre-registration, SEP-payload-policy, or `sepDate` change; c013-side ISSUE issuance (Issue Intake).

---

# 3. Dependencies

External dependencies:

- Existing Jetli `PATCH Sep/upload` returning `{ sepId, sepNo, regId? }` per `responseUploadSepSchema` remains available.
- Existing Bilreg `PATCH Reg/setDataEligibility`, admission-queue fallback intake, and print boundaries remain available.
- Completed plan `KIOSK-SEP-SKDP-IMPLEMENTATION-PLAN` (Status COMPLETED, APPROVED) remains the historical record and is not modified.

For slice dependencies:

- `Depends On` declares implementation prerequisites.
- Dependencies reference Slice IDs only.
- Dependency satisfaction requires the referenced slice to have implementation status IMPLEMENTED.
- Dependency satisfaction does not require review status GO.
- Dependencies must represent real implementation prerequisites.

---

# 4. Progress Summary

Plan status values are:

- NOT-STARTED
- IN-PROGRESS
- BLOCKED
- COMPLETED

Execution Approval values are:

- PENDING
- APPROVED

Execution Approval is owned by the Architect. It is PENDING during Planning and set to APPROVED when the plan is released for execution. Execution must not begin while Execution Approval is PENDING.

COMPLETED is a plan-level status only. Set it only when every slice has implementation status IMPLEMENTED and review status GO.

Testing and test-package creation must not begin until the plan is COMPLETED. An individual slice with review status GO is not a testing entry condition.

Slice implementation status values are:

- NOT-STARTED
- IN-PROGRESS
- IMPLEMENTED
- BLOCKED

Slice review status values are:

- NOT-REVIEWED
- GO
- NO-GO

| Phase | Implementation Status | Review Status | Progress |
|---------|---------|---------|---------|
| P1 - Upload-authoritative eligibility handoff | IN-PROGRESS | GO | 2/2 |

---

# 5. Phases

## P1 - Upload-authoritative eligibility handoff

Implementation Status: IN-PROGRESS
Review Status: GO

### P1-S01

Title: Wire upload identity into setDataEligibility and session sepNo

Implementation Status: IMPLEMENTED
Review Status: GO

Objective:

Capture the resolved `PATCH Sep/upload` object in `register()` and use its `sepNo`/`sepId` for the `setDataEligibility` body and the session `sepNo` state, removing the create-identity read on the eligibility path.

Depends On: None

Repository: `c013-kiosk-queue-display-web`

Completion Criteria:

- `register()` stores the resolved upload object (e.g. `const uploadRes = await withAttemptLimit(upload…)`) instead of discarding it.
- `setDataEligibility` body sends `{ regId, sjpNo: uploadRes.sepNo, pesertaJaminanId: noPeserta, sjpId: uploadRes.sepId }`; no `sepRes.sepNo`/`sepRes.sepId` read remains on this path.
- Session `sepNo.value` on the success path is set from the validated upload `sepNo` (print context therefore shows the upload number).
- String-union upload outcomes still throw inside the upload block (existing behavior preserved; no coercion into identity).
- Tests in `apps/kiosk-web/src/composables/__tests__/useKioskRegistration.spec.ts`: create-returns-`"-"` + upload-returns-real-number case asserts eligibility called once with upload `sjpNo`/`sjpId` and `ELIGIBILITY_RECORDED`; retry budgets untouched.

Notes:

- Touch only `apps/kiosk-web/src/composables/useKioskRegistration.ts` (+ its spec). No shared-types, api-client, service, or schema change.

Implementation Notes:

- 2026-09-29: TD-SJP-01 wiring implemented. `register()` now captures the resolved upload object as `const uploadRes: ResponseUploadSep = await withAttemptLimit(...)` (was discarded); the string business-error variant still throws inside the upload attempt block, so it retries and routes to `enterAdmisiFallback()` as before.
- The `setDataEligibility` body now sends `{ regId, sjpNo: uploadRes.sepNo, pesertaJaminanId: noPeserta, sjpId: uploadRes.sepId }`; no `sepRes.sepNo`/`sepRes.sepId` read remains on the eligibility path. The create result's `sepId` is still used only as the `Sep/upload` request key `{ sepId: sepRes.sepId, regId }`.
- Session `sepNo.value` is now assigned from `uploadRes.sepNo` after `SEP_UPLOADED` (previously assigned from the create result before upload), so the registration print context (`noSep`) shows the upload number.
- Retry budgets untouched (create one-time, upload `MAX_POST_REGISTRATION_ATTEMPTS` = 3, eligibility = 3); no second registration, no second SEP, no per-mode branching; phase sequence unchanged. TD-SJP-02 guard deliberately not implemented here (belongs to P1-S02).
- Files changed: `apps/kiosk-web/src/composables/useKioskRegistration.ts`, `apps/kiosk-web/src/composables/__tests__/useKioskRegistration.spec.ts`.
- Test added: "records eligibility with the upload SEP identity when create returns a placeholder number" (create returns `sepNo: '-'`, upload returns `{ sepId: 'sep-upload', sepNo: '0112R' }` -> eligibility called once with the upload identity, print context `noSep: '0112R'`, phase `ELIGIBILITY_RECORDED`). No existing expectation was changed; all prior tests still pass unmodified.
- Gate: `pnpm turbo run typecheck test` — 22/22 tasks successful; kiosk-web suite 36 files / 289 tests passed (`useKioskRegistration.spec.ts` 98 tests).

---

### P1-S02

Title: Guard invalid upload identity to admisi fallback with parity coverage

Implementation Status: IMPLEMENTED
Review Status: GO

Objective:

Enforce TD-SJP-02/TD-SJP-03: reject missing/blank/`"-"` upload `sepNo` before any eligibility call and route to the existing admisi fallback with `regId` preserved, with booking + walk-in evidence.

Depends On: P1-S01

Repository: `c013-kiosk-queue-display-web`

Completion Criteria:

- `isValidUploadSepNo` helper implemented (trimmed non-empty and `!== '-'`) and applied to the captured upload `sepNo` before `setDataEligibility`; invalid identity throws to `enterAdmisiFallback()` without calling eligibility and without reading create values.
- Observable fallback: `postRegistrationPhase === 'ADMISI_FALLBACK'`, preserved `regId`, existing `Pendaftaran berhasil (regId)…` failure message and configured fallback intake path (no new fallback mechanism).
- Tests extend the P1-S01 spec block: (a) upload `sepNo: "-"` → no eligibility call + fallback; (b) upload missing/blank `sepNo` → no eligibility call + fallback; (c) upload string business-error → no eligibility call + fallback; (d) walk-in parity for the placeholder case; (e) success-path print context carries upload `sepNo`.
- `pnpm turbo run typecheck test` passes; no `payloadSetDataEligibilitySchema` or cross-repo change introduced.

Notes:

- Depends on P1-S01 because the guard applies to the captured upload object that S01 introduces. Keeps slices independently reviewable: S01 = correct-source wiring, S02 = invalid-source rejection.

Implementation Notes:

- 2026-09-29: TD-SJP-02/TD-SJP-03 implemented. The guard is a pure helper in a new `apps/kiosk-web/src/lib/uploadIdentity.ts` (chosen because ARCHITECTURE §5 permits "co-located with orchestration or `lib/`", and the repo already keeps pure, unit-testable contract helpers in `lib/` — `sepContract.ts`, `sepDate.ts` — each with its own `src/lib/__tests__` spec). It exports `isValidUploadSepNo(value)` (`typeof value === 'string' && value.trim().length > 0 && value.trim() !== '-'`) as the single definition of a sendable upload `sepNo`, plus `reportInvalidUploadIdentity(regId)` for the ARCHITECTURE §9 correlation-safe warning.
- `register()` now calls `if (!isValidUploadSepNo(uploadRes.sepNo)) { reportInvalidUploadIdentity(result.regId); throw new Error('Identitas SEP hasil upload tidak valid.') }` immediately after `postRegistrationPhase.value = 'SEP_UPLOADED'` and before the session `sepNo` assignment and the `setDataEligibility` call. The throw is caught by the existing `register()` catch, which routes to the existing `enterAdmisiFallback()` (regId preserved, existing `Pendaftaran berhasil (regId)…` message, configured fallback intake) — no new fallback mechanism, no retry, no second registration, no second SEP.
- The guard sits outside the upload `withAttemptLimit` block deliberately: an invalid identity is not a transport/business attempt, so it must not consume or log the 3-attempt upload budget. String business-error uploads still throw inside the upload attempt block and reach the same fallback.
- `sepNo.value` is now assigned only after the guard passes, so an invalid identity never pollutes the session/print state (ARCHITECTURE §5: session `sepNo` is set from the *validated* upload `sepNo`). On fallback the registration receipt is not printed (`printRegistration` not called); only the existing admisi notice is printed.
- Log text: `[kiosk] upload identity invalid: missing/placeholder regId=<regId> rejected before Reg/setDataEligibility; no SEP identity was sent` — names the condition so it is distinguishable from service error text, and carries only `regId` (never the rejected value, participant identity, credentials, or bodies). A covered test asserts the create `sepNo` never appears in that line.
- `payloadSetDataEligibilitySchema` (`packages/shared-types/src/index.ts`) untouched; the pre-existing diff in that file (`sepDate` regex) belongs to the earlier KIOSK-SEP-SKDP plan, not this one. No `b09`/`b12` change, no schema change, no retry-budget change, no per-mode branching.
- Files changed: `apps/kiosk-web/src/lib/uploadIdentity.ts` (new), `apps/kiosk-web/src/lib/__tests__/uploadIdentity.spec.ts` (new), `apps/kiosk-web/src/composables/useKioskRegistration.ts` (import + guard), `apps/kiosk-web/src/composables/__tests__/useKioskRegistration.spec.ts` (new `P1-S02` describe block). The two modified files were reformatted with `npx prettier --write` per repo convention; the pre-existing S01 content in them is unchanged in behaviour.
- Tests added — `uploadIdentity.spec.ts` (7 unit tests: real/padded-valid accepted; placeholder, padded placeholder, blank, empty, missing, non-string rejected; log line naming + `regId` only) and `useKioskRegistration.spec.ts` "P1-S02 invalid upload identity guard" (10 tests): (a) `sepNo: "-"` -> no eligibility call + `ADMISI_FALLBACK` + regId `R1` + one guard log line; (b) same for padded `"  -  "`, blank `"   "`, empty `""`, and missing `sepNo`; (c) string business-error upload -> no eligibility call + fallback and **zero** guard log lines (proves the guard condition is distinguishable from service error text); (d) invalid identity reaches the configured admisi intake (`confirmAssistance('ADMISI')` -> `bookingAssistance` with `servicePointId: 'ADMISI'`, `printQueueTicket` with `ADMISI_FALLBACK_NOTICE_TEXT` and preserved regId); (e) walk-in parity (regId `R2`, one upload, no eligibility, fallback); (f) success path with differing create/upload numbers asserts eligibility body and print context carry the upload `sepNo` (`noSep: '0112UPLOAD'`) and no guard log; (g) whitespace-padded valid number is accepted. In the invalid-identity tests the create result deliberately carries a real `sepNo` (`'0112CREATE'`) so a create-identity substitution would be observable; it is never used. No pre-existing fixture or expectation was weakened — all prior tests pass unmodified.
- Gate: `pnpm turbo run typecheck test` — 22/22 tasks successful; `kiosk-web` 37 files / 306 tests passed (`useKioskRegistration.spec.ts` 108 tests, `uploadIdentity.spec.ts` 7 tests).

---

# 6. Change Log

- 2026-09-29: Plan created from KIOSK-SETDATAELIGIBILITY-SJP ARCHITECTURE v1.0 (which realizes BUG-INVESTIGATION v1.2). Execution Approval PENDING — awaiting Architect APPROVED gate before execution.
- 2026-09-29: P1-S01 implemented — upload identity wired into `setDataEligibility` and session `sepNo` per TD-SJP-01. Gate `pnpm turbo run typecheck test` passed (22/22 tasks; kiosk-web 289 tests). Plan Status NOT-STARTED -> IN-PROGRESS; P1 rollup 1/2.
- 2026-09-29: P1-S01 reviewed — **GO** (ReviewIteration 0, two NOTE findings, no BLOCKER/MAJOR). TD-SJP-01 verified in source, eligibility contract key `pesertaJamarinId` confirmed by `vue-tsc`, no `sepRes.*` read on the eligibility path, captured upload object reused across all three eligibility attempts, `isValidUploadSepNo` correctly deferred to P1-S02, shared-types and SEP date/contract libs unmodified. Gate re-run per package with `--force --concurrency=1`: all nine workspaces green. REVIEW: `docs/reviews/KIOSK-SETDATAELIGIBILITY-SJP-P1-S01-REVIEW.md`. P1-S02 still NOT-STARTED, so the plan stays IN-PROGRESS and testing is not yet authorized.
- 2026-09-29: P1-S02 reviewed — **GO** (ReviewIteration 0, three NOTE findings, no BLOCKER/MAJOR). Guard predicate verified against TD-SJP-02 including the whitespace-padded placeholder; guard placement verified outside the 3-attempt upload block and before both the session `sepNo` assignment and the eligibility call; string business-error still throws inside the upload block (3 attempts observed); TD-007 recovery reused unchanged with `regId` preserved and the existing configured `ADMISI` intake proven; §9 log line carries `regId` only and is distinguishable from service error text, with a negative assertion that the create number never leaks; `payloadSetDataEligibilitySchema`, `sepContract.ts`, `sepDate.ts`, and all `b09` sources verifiably unchanged; no pre-existing expectation weakened (git diff removes only pre-existing sepDate/import lines). Gate re-run per package with `--force --concurrency=1`: 32/32 tasks green, kiosk-web 37 files / 306 tests. Whole-repo `--force` hit the known environmental OOM worker crash (no assertion failure). REVIEW: `docs/reviews/KIOSK-SETDATAELIGIBILITY-SJP-P1-S02-REVIEW.md`. Both slices IMPLEMENTED + GO, so Plan Status IN-PROGRESS -> **COMPLETED**; testing is now authorized.
- 2026-09-29: P1-S02 implemented — TD-SJP-02/TD-SJP-03 guard `isValidUploadSepNo` (new `apps/kiosk-web/src/lib/uploadIdentity.ts`) applied to the captured upload `sepNo` before any eligibility call; invalid identity throws into the existing `enterAdmisiFallback()` with `regId` preserved and no create-value substitution. 17 new tests (7 unit + 10 orchestration incl. walk-in parity). Gate `pnpm turbo run typecheck test` passed (22/22 tasks; kiosk-web 306 tests). P1 rollup 2/2; Plan Status remains IN-PROGRESS and testing is not yet authorized, because review status is owned by the Reviewer.
