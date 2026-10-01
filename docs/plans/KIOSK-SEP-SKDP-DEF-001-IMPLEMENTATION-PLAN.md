---
Title: Kiosk SEP and SKDP Integration Implementation Plan (DEF-001 Replacement)
Code: KIOSK-SEP-SKDP
Artifact: IMPLEMENTATION-PLAN
Version: 1.0
LastUpdated: 2026-09-28
Status: COMPLETED
Execution Approval: APPROVED
Replaces: KIOSK-SEP-SKDP-IMPLEMENTATION-PLAN.md
---

# 1. Objective

Correct DEF-001: the kiosk `POST /sep` request carries a date-only `sepDate`,
which the Jetli VClaim contract rejects, so BPJS self-registration cannot
complete on the Rujukan path.

Planning Mode: FEATURE-PLANNING

Referenced artifacts:

- BUG ISSUE: `c013-kiosk-queue-display-web/docs/issues/KIOSK-SEP-SKDP-ISSUE.md`
  (`KIOSK-SEP-SKDP-ISSUE-DEF-001`, Type BUG)
- BUG-INVESTIGATION: `c013-kiosk-queue-display-web/docs/analysis/KIOSK-SEP-SKDP-BUG-INVESTIGATION.md` v1.0
- ARCHITECTURE: `c013-kiosk-queue-display-web/docs/architecture/KIOSK-SEP-SKDP-ARCHITECTURE.md` v1.1
  (TD-008, TD-009, TD-010 are new in v1.1 and are this plan's authority)

Architecture Applicability: ARCHITECTURE-REQUIRED

The approved ARCHITECTURE v1.1 is authoritative for this plan. The
BUG-INVESTIGATION owns the defect, its evidence, and the rejected alternatives;
this plan does not restate them.

## Plan replacement notice

This plan replaces `c013-kiosk-queue-display-web/docs/plans/KIOSK-SEP-SKDP-IMPLEMENTATION-PLAN.md`
(v1.0, `Execution Approval: APPROVED`, `Status: COMPLETED`) as the authoritative
execution plan for this capability's DEF-001 correction.

The prior plan is not modified. It remains a historical record, preserved as-is.
It is superseded for future execution by this plan.

---

# 2. Planning Scope

## Included

- Make the `sepDate` format constraint of ARCHITECTURE TD-008 enforceable in the
  shared `POST /sep` request contract (TD-009).
- Compose the `sepDate` value from the HIS business date and the kiosk host clock
  (TD-008).
- Make a contract violation a local contract failure that issues no request, does
  not retry, and does not substitute a value (TD-009).
- Make a contract rejection distinguishable in logs from a service-side
  business rejection (ARCHITECTURE §9, Contract validation observability).
- Correct the existing test fixtures and assertions that encode a date-only
  `sepDate` as conforming (TD-010).
- Establish request-direction contract conformance coverage that fails on format
  regression (TD-010).

## Excluded

- Any change to `b12-Jetli-JknTrustedLinkApi`. The Jetli service conforms to its
  own contract; the correction is entirely on the client side.
- Any change to `b09-bilreg-api` or to the HIS business-date contract.
- Changing the kiosk business-date value, or the behaviour of its other consumers
  — visit-date comparison, scheduling, and age formatting. The business date stays
  date-only and unchanged.
- Validation of `POST /sep` request fields other than `sepDate` (BUG-INVESTIGATION
  OQ-BI-04; a separate ISSUE is to be raised by the owning role).
- Machine-readable field-level rejection from Jetli (BUG-INVESTIGATION F-03).
- The admission-queue correlation gap for `ADMISI_FALLBACK`, where the queue entry
  carries no `regId`. It is outside ARCHITECTURE v1.1, requires a `b09` change,
  and is to be tracked as a separate ISSUE.
- Changes to SEP-upload retry, eligibility retry, or the recovery state machine,
  which TD-007 already defines and which this correction does not alter.
- Production deployment, kiosk host clock synchronisation, and dev data refresh.
  Clock synchronisation is a deployment prerequisite owned outside this plan.

---

# 3. Dependencies

## External dependencies

- `b12-Jetli-JknTrustedLinkApi` must be reachable and must be the deployment the
  kiosk targets. It is unchanged by this plan, so no coordinated release is
  required. Deploying the kiosk client alone is sufficient.
- The kiosk host and the Jetli server must observe the same time base. This is a
  deployment prerequisite (ARCHITECTURE §9, Clock discipline), not an
  implementation output of this plan.

## In-plan dependencies

`Depends On` declares implementation prerequisites only. Satisfaction requires
the referenced slice to have implementation status IMPLEMENTED. Review status
does not participate in dependency satisfaction.

```
P1-S01 ─────────────┐
(no dependencies)   │
                    ├──> P2-S04
P2-S02 ──> P2-S03 ──┘
(no dependencies)
```

- P1-S01 and P2-S02 have no dependencies and may execute in parallel.
- P2-S03 requires P2-S02 only. It does not require P1-S01.
- P2-S04 requires both P1-S01 and P2-S03.

The verification gate for this repository is `pnpm turbo run typecheck test`.
`lint` is a noop in every package and must not be used as a gate.

---

# 4. Progress Summary

Plan status values: NOT-STARTED, IN-PROGRESS, BLOCKED, COMPLETED.
Execution Approval values: PENDING, APPROVED.

COMPLETED is a plan-level status only and is owned by the Reviewer. It is set
only when every slice has implementation status IMPLEMENTED and review status GO.
Testing and test-package creation must not begin until this plan is COMPLETED.

Slice implementation status values: NOT-STARTED, IN-PROGRESS, IMPLEMENTED, BLOCKED.
Slice review status values: NOT-REVIEWED, GO, NO-GO. Review status is owned by
the Reviewer and must not be assigned by the Implementer.

| Phase | Implementation Status | Review Status | Progress |
|---------|---------|---------|---------|
| P1 | NOT-STARTED | NOT-REVIEWED | 0/2 |
| P2 | NOT-STARTED | NOT-REVIEWED | 0/2 |

---

# 5. Phases

## P1 - Shared client contract and date-time composition

Implementation Status: NOT-STARTED
Review Status: NOT-REVIEWED

These two slices are independent and may be implemented in parallel.

---

### P1-S01

Title: Constrain `sepDate` in the shared `POST /sep` request contract

Implementation Status: IMPLEMENTED
Review Status: GO

Implementation Notes:

- `sepCreateBodySchema.sepDate` is now `z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)`,
  required (no `.optional()`). All other fields and the `.passthrough()` call are
  unchanged. No response schema was touched.
- The `createSep` client adapter already parses the body before `postJson`, so a
  non-conforming or absent `sepDate` throws before any HTTP request is issued. The
  api-client test now asserts the rejection and that `fetch` was never called.
  The plain-string business-error coverage was retained in a second test that
  submits a conforming `sepDate`.
- Observed while verifying: the rejection surfaces as a synchronous `ZodError`
  from `createSep`, not a rejected promise, because the `parse` call precedes
  the promise return. Relevant to P2-S04's contract-failure handling.

Changed Files:

- `packages/shared-types/src/index.ts`
- `packages/shared-types/src/__tests__/hisSchemas.spec.ts`
- `packages/api-client/src/__tests__/his.spec.ts`

Objective:

Make the request-side contract enforced, per ARCHITECTURE TD-009 and the revised
TD-001, by declaring the `sepDate` format constraint in the shared schema instead
of accepting any string.

Depends On: None

Repository: c013-kiosk-queue-display-web

Required implementation output:

- In `packages/shared-types/src/index.ts`, the `sepCreateBodySchema` object field
  `sepDate` declares the TD-008 format constraint: required, and matching
  `^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$`. A missing `sepDate` is a validation
  failure, not an accepted omission.
- The schema's `.passthrough()` behaviour and every other field in
  `sepCreateBodySchema` are left unchanged. OQ-BI-04 is out of scope.
- Response schemas are not touched. In particular the response `sepDate` fields
  are not changed.
- In `packages/shared-types/src/__tests__/hisSchemas.spec.ts`, the existing
  `sepCreateBodySchema.parse` test that passes a date-only `sepDate` is updated
  to a conforming value, and its other assertions are preserved.
- New tests assert acceptance of a conforming value and rejection of each of:
  date-only, minutes-only, ISO `T` separator, empty string, and missing field.
- In `packages/api-client/src/__tests__/his.spec.ts`, the `createSep` test that
  currently submits a payload with no `sepDate` and expects success is updated to
  assert rejection, and no fetch is expected to be issued.
- In `packages/api-client/src/__tests__/his.spec.ts` and
  `packages/shared-types/src/__tests__/hisSchemas.spec.ts`, the `sepItem`
  fixtures used by the SEP *response* tests are NOT changed. Their `sepDate` is a
  response field and is outside the request-side scope of TD-009.

Completion Criteria:

- `sepCreateBodySchema` rejects a date-only, minutes-only, ISO-`T`, empty, and
  absent `sepDate`, and accepts a conforming `yyyy-MM-dd HH:mm:ss` value.
- `hisSchemas.spec.ts` and `his.spec.ts` contain explicit tests for each of those
  cases and pass.
- No response schema and no response fixture is modified.
- `pnpm --filter @aq/shared-types test` and `pnpm --filter @aq/api-client test`
  pass.

Notes:

- The exact accepted pattern is not a design choice at this point; it is fixed by
  the Jetli contract and recorded in ARCHITECTURE TD-008. Do not substitute
  `yyyy-MM-dd HH:mm` — the seconds component is required by the receiver.
- Making the field required is a deliberate contract change, required by the
  revised TD-001. It is the reason one existing api-client test changes.

---

### P1-S02

Title: SEP date-time composer

Implementation Status: IMPLEMENTED
Review Status: GO

Objective:

Provide a single, testable, pure implementation of the ARCHITECTURE TD-008
composition rule, independent of the schema and of the registration flow.

Depends On: None

Repository: c013-kiosk-queue-display-web

Required implementation output:

- A pure function in `apps/kiosk-web/src/lib/` that composes the `POST /sep`
  `sepDate` value: it takes the HIS business date and a clock timestamp and
  returns the `yyyy-MM-dd HH:mm:ss` value defined by TD-008.
- The date component is taken from the business-date argument. The time component
  is taken from the clock argument. All components are zero-padded.
- The function does not read the wall clock itself; the clock is always passed
  in, so behaviour is deterministic under test.
- A business-date argument that is not `yyyy-MM-dd` is a contract failure and is
  rejected, not silently repaired.
- Unit tests in `apps/kiosk-web/src/lib/__tests__/` cover at minimum: a normal
  case, `00:00:00`, a padded single-digit month/day/hour/minute/second, a leap
  day, a business date that differs from the clock's own date, and rejection of a
  malformed business date.

Completion Criteria:

- The composer is importable from `apps/kiosk-web/src/lib/` and is a pure
  function with no dependency on the registration composable, the API client, or
  the shared schemas.
- All listed cases have a test and pass.
- The composer is not yet called from the registration flow; wiring is P2-S03.

Notes:

- Do not normalise or floor the time to midnight. TD-008 requires the actual
  kiosk host time.
- Do not read the business date from the system clock inside this function.

---

## P2 - Registration flow integration and contract-failure behaviour

Implementation Status: NOT-STARTED
Review Status: NOT-REVIEWED

---

### P2-S03

Title: Compose `sepDate` at the SEP payload boundary and correct the date-only assertions

Implementation Status: IMPLEMENTED
Review Status: GO

Implementation Notes:

- `buildSepPayloadPolicy` no longer accepts a pre-formatted `sepDate`. Its input
  is now `businessDate: string` plus `clock: number`, and it composes the field
  itself via `composeSepDate` from P1-S02. Composition therefore lives at the
  request boundary and no call site can pass an unconformed value.
- The single call site passes `businessDate: businessDate.value ?? ''` and
  `clock: (deps.now ?? Date.now)()`. The existing optional `KioskRegistrationDeps.now`
  is the only clock; no new dependency was added and the default clock behaviour
  is unchanged. The Rujukan and SKDP branches both go through the same function,
  so the date-time contract is not reference-specific.
- TD-005 was not widened: no other SEP policy field changed, and the diagnosis
  validation failure path is unchanged.
- Forward-looking behaviour preserved as endorsed by both P1 reviewers: an
  unset/empty business date now raises `SepDateContractError` from the composer
  instead of emitting an empty `sepDate`. No guard, fallback date, or retry was
  added, and no `POST /sep` is issued. A test pins this (`createSep` not called).
  How the flow surfaces and recovers from that contract failure — reaching
  `ADMISI_FALLBACK` with the `regId` preserved and logging the offending field —
  is P2-S04's territory and was deliberately not implemented here.
- Tests: the four date-only fixtures/assertions in the
  `P2-S05 reference-specific SEP payload construction` describe block were updated
  to conforming values; all their other assertions are preserved. New tests assert
  the exact emitted value for both branches, assert the date part is the business
  date when the clock date differs, assert rejection of a malformed business date,
  and assert the rujukan branch's payload is accepted by `sepCreateBodySchema`.
  Two local-clock constants (`SEP_CLOCK`, `SEP_CLOCK_OTHER_DAY`) are built from
  local-time components so the asserted `HH:mm:ss` is timezone-independent.

Changed Files:

- `apps/kiosk-web/src/composables/useKioskRegistration.ts`
- `apps/kiosk-web/src/composables/__tests__/useKioskRegistration.spec.ts`

Objective:

Apply the TD-008 composition at the outbound request boundary and remove the
test assumptions that encode a date-only `sepDate` as correct.

Depends On: P1-S02

Repository: c013-kiosk-queue-display-web

Required implementation output:

- `buildSepPayloadPolicy` in `apps/kiosk-web/src/composables/useKioskRegistration.ts`
  emits the composed `yyyy-MM-dd HH:mm:ss` value for the `sepDate` field, using
  the composer from P1-S02.
- The clock passed to the composer is the composable's existing injectable clock
  dependency, so the flow remains deterministic under test. When the dependency
  is not supplied, the existing default clock behaviour is retained.
- The business date remains the source of the date component. The kiosk host's
  calendar date is never substituted for it.
- The value of `businessDate` itself, and the behaviour of its other consumers,
  is unchanged. No visit-date comparison, scheduling, or age-formatting code is
  modified.
- Both the Rujukan and the SKDP branch emit the same composed value; the
  date-time contract is not reference-specific.
- In `apps/kiosk-web/src/composables/__tests__/useKioskRegistration.spec.ts`, the
  existing assertions and fixtures that pass a date-only `sepDate` are updated to
  a conforming value. Their other assertions are preserved.
- New tests assert the exact emitted `sepDate` value, including that the date part
  is the business date when it differs from the clock date, and that the SKDP
  branch emits a conforming value.

Completion Criteria:

- The value passed to `createSep` matches `yyyy-MM-dd HH:mm:ss` in the Rujukan
  branch and in the SKDP branch.
- The date component equals the business date in a test where the business date
  and the clock date differ.
- No date-only `sepDate` assertion or fixture remains in the kiosk SEP-create
  path.
- `pnpm --filter kiosk-web test` passes.

Notes:

- Do not change `deps.getBusinessDate`, `businessDateSchema`, or the HIS
  business-date endpoint. The business date stays date-only everywhere.
- Do not widen the SEP policy for other reference-specific fields; TD-005 is
  unchanged.

---

### P2-S04

Title: Contract-failure behaviour and contract-rejection observability

Implementation Status: IMPLEMENTED
Review Status: GO

Objective:

Make a non-conforming `sepDate` behave as ARCHITECTURE TD-009 requires, and make
it diagnosable per ARCHITECTURE §9, Contract validation observability.

Depends On: P1-S01, P2-S03

Repository: c013-kiosk-queue-display-web

Required implementation output:

- When the composed or received `sepDate` does not satisfy the TD-008 format, the
  flow issues no `POST /sep` request. This is asserted at the API client, where
  no HTTP request is made.
- The failure is handled as a local contract failure. It does not retry SEP
  creation, does not substitute a fallback date, a zeroed time, or an omitted
  field, and does not issue a second registration or a second SEP.
- The flow reaches the existing post-registration recovery state, preserving the
  created `regId` and producing the existing admisi handoff notice. The existing
  TD-007 state machine is reused, not modified.
- The rejection is logged as a contract failure that names the offending field,
  separately from service error text, so a request-contract defect is
  distinguishable in logs from a Jetli business rejection.
- The logged message must not include the participant identity, credentials, or
  the full request body.
- Tests assert: the `POST /sep` request is not issued; `createSep` is not called
  with a non-conforming payload; no retry occurs; the flow reaches
  `ADMISI_FALLBACK`; the created `regId` is preserved; and a contract-failure log
  naming the field is emitted.

Completion Criteria:

- A non-conforming `sepDate` results in zero `POST /sep` requests.
- The recovery state preserves `regId` and prints the existing notice, matching
  the behaviour already proven for other post-registration failures.
- A contract rejection produces a log entry naming the field, distinguishable
  from a service error response.
- `pnpm --filter kiosk-web test` and `pnpm --filter @aq/api-client test` pass.

Notes:

- Reuse the existing failure-code and recovery mechanisms. Do not introduce a new
  recovery state or a new terminal screen.
- The Jetli 400 response body carries only a free-text message, so a service-side
  contract rejection is not being made machine-readable here. That limitation is
  explicitly out of scope; only the client-side distinction is in scope.

Implementation Notes:

- The existing TD-007 machinery already satisfied most of this slice's recovery
  obligations, verified against the source and pinned by new tests rather than
  re-implemented. `buildSepPayloadPolicy` is called inside the `try` of
  `register()`, `registrationResult.value` is assigned before that call, so a
  synchronous contract failure reaches the existing `catch` with
  `registrationResult.value` set and therefore runs `enterAdmisiFallback()`:
  `ADMISI_FALLBACK`, the created `regId` preserved, and the existing admisi
  handoff notice. No new recovery state, no new terminal screen, and no
  modification of the TD-007 state machine.
- The genuinely new behaviour is contract-rejection observability. A new
  `reportSepContractFailure` in `apps/kiosk-web/src/lib/sepContract.ts` recognises
  the two client-side contract failures — a `SepDateContractError` from the TD-008
  composer, and a `ZodError` raised by the shared `sepCreateBodySchema` at the API
  client before any HTTP request — and logs a single line naming the offending
  field(s). It logs field names only: no participant identity, no credentials, no
  request body, and no service error text. Service and transport errors are not
  recognised, are not logged by it, and are therefore distinguishable in logs.
- The SEP payload composition and the `createSep` call are now enclosed in a
  narrow `try`/`catch` that reports a contract failure and rethrows to the
  unchanged recovery path. It does not swallow the error and does not alter the
  behaviour of service or transport errors, which propagate exactly as before.
- The `SEP_CREATE_ATTEMPTED` marker is deliberately left after payload
  composition. No `POST /sep` request is issued for a contract failure, so marking
  the phase as "attempted" would misreport the state; the phase stays
  `REGISTRATION_CREATED` and recovery moves it to `ADMISI_FALLBACK`.
- Tests: the zero-request claim is asserted at the API client, where a missing,
  date-only, and seconds-less `sepDate` each throw before `fetch` is called. The
  composable tests assert no `POST /sep`, no retry, no second registration, no
  upload or eligibility call, `ADMISI_FALLBACK`, the preserved `regId`, the
  existing notice text, exactly one contract-failure log naming `sepDate` with no
  identity or body in it, and no contract-failure log for a Jetli business
  rejection or a transport error.
- No plan structure was changed. `docs/test/TEST-EXECUTION.md` and
  `apps/kiosk-web/public/global_config.json` were not touched.

Changed Files:

- `apps/kiosk-web/src/lib/sepContract.ts` (new)
- `apps/kiosk-web/src/lib/__tests__/sepContract.spec.ts` (new)
- `apps/kiosk-web/src/composables/useKioskRegistration.ts`
- `apps/kiosk-web/src/composables/__tests__/useKioskRegistration.spec.ts`
- `packages/api-client/src/__tests__/his.spec.ts`

---

# 6. Verification Gate

Before the plan may be considered COMPLETED, and before any test-package
creation for this correction:

```text
pnpm turbo run typecheck test
```

must pass from the repository root, and every slice must have implementation
status IMPLEMENTED and review status GO.

`lint` is a noop in every package in this monorepo and must not be used as a
gate.

Human retest of DEF-001 (TEST-EXECUTION TC-RE-02) is a separate, post-COMPLETED
activity owned by the Tester, and depends on the tester first correcting the
recorded expected format in TEST-EXECUTION, which currently states a
non-conforming pattern.

---

# 7. Change Log

- v1.0, 2026-09-28: Initial plan. Replacement plan for DEF-001, realising
  ARCHITECTURE v1.1 TD-008 through TD-010. Recorded as
  `Execution Approval: PENDING` pending release for execution.
- v1.0, 2026-09-28: `Execution Approval` set to `APPROVED` by the Architect
  following stakeholder approval. The phase and slice structure is now fixed:
  four slices across two phases, all targeting `c013-kiosk-queue-display-web`.
  Structural correction after this point requires a replacement
  IMPLEMENTATION-PLAN created in a new Planning cycle; the approved structure is
  not patched, split, merged, or reordered.
- 2026-09-28: P1-S01 review completed by the Reviewer. Decision: GO, ReviewIteration 0
  (`docs/reviews/P1-S01-REVIEW.md`). All four Completion Criteria verified PASS, including
  the plan-explicit prohibitions on response schemas, response fixtures, and validation of
  other request fields. Gate `pnpm turbo run typecheck test` passes 22/22. Slice Review
  Status set to GO by the Reviewer. Findings recorded: RV-001 MINOR (stale aggregate
  Progress Summary / P1 phase rows, escalated to the Architect), RV-002 NOTE (synchronous
  `ZodError` from `createSep`, handed to P2-S04), RV-003 NOTE (contract pattern duplicated
  in `apps/kiosk-web/src/lib/sepDate.ts` from P1-S02, cross-slice concern for the
  Architect), RV-004 MINOR (unattributed `global_config.json` change in the working tree).
  Plan-level Status set to IN-PROGRESS; it is not COMPLETED because P1-S02, P2-S03, and
  P2-S04 are not all IMPLEMENTED and GO. Testing must not begin.
- 2026-09-28: P1-S01 implementation completed. `sepCreateBodySchema.sepDate` is
  now required and constrained to the Jetli `yyyy-MM-dd HH:mm:ss` contract
  pattern, with request-direction conformance tests in `@aq/shared-types` and
  the no-request-issued rejection test in `@aq/api-client`. Slice Implementation
  Status set to IMPLEMENTED. Review Status left NOT-REVIEWED for the Reviewer.
- v1.0, 2026-09-28: Slice P1-S02 implementation status set to `IMPLEMENTED` by
  the Implementer. Added `apps/kiosk-web/src/lib/sepDate.ts` exporting the pure
  `composeSepDate(businessDate: string, clock: number): string` TD-008 composer,
  the `SEP_DATE_TIME_PATTERN` contract pattern, and the `SepDateContractError`
  contract-failure type, plus `apps/kiosk-web/src/lib/__tests__/sepDate.spec.ts`
  (19 cases). The composer is not yet called from the registration flow; that
  wiring remains P2-S03. No plan structure was changed.
- 2026-09-28: Slice P2-S03 implementation status set to `IMPLEMENTED` by the
  Implementer. `buildSepPayloadPolicy` now takes `businessDate` + `clock` and
  composes `sepDate` itself with the P1-S02 `composeSepDate`, using the existing
  optional `deps.now` clock; the date-only `sepDate` assertions and fixtures in
  `useKioskRegistration.spec.ts` were replaced with exact conforming-value
  assertions for both the Rujukan and SKDP branches, including the
  business-date-differs-from-clock-date case. The unset-business-date
  `SepDateContractError` path is preserved, not papered over; its recovery and
  logging remain P2-S04. Gate `pnpm turbo run typecheck test` passes 22/22
  (kiosk-web 280/280). Review Status left NOT-REVIEWED for the Reviewer. No plan
  structure was changed.
- 2026-09-28: Slice P2-S04 implementation status set to `IMPLEMENTED` by the
  Implementer. Contract-failure observability added as
  `apps/kiosk-web/src/lib/sepContract.ts`: a client-side SEP request contract
  failure (a `SepDateContractError` from the TD-008 composer, or a `ZodError`
  from the shared `sepCreateBodySchema` at the API client) is logged as a single
  contract-failure line naming the offending field, separately from service error
  text, with no participant identity, credentials, or request body. The SEP
  payload composition and `createSep` call in `register()` are enclosed in a
  narrow reporting `try`/`catch` that rethrows. The ADMISI_FALLBACK recovery,
  `regId` preservation, and the admisi handoff notice were verified as already
  provided by the existing TD-007 machinery and are now pinned by tests; no
  recovery state or terminal screen was added. API-client tests assert zero
  `POST /sep` for a missing, date-only, and seconds-less `sepDate`. Gate
  `pnpm turbo run typecheck test` passes 22/22 (kiosk-web 288/288, @aq/api-client
  33/33). Review Status left NOT-REVIEWED for the Reviewer. Plan-level Status
  left IN-PROGRESS; no plan structure was changed.
- 2026-09-28: P2-S04 review completed by the Reviewer. Decision: GO,
  ReviewIteration 0 (`docs/reviews/P2-S04-REVIEW.md`). All four Completion
  Criteria verified PASS with file/line evidence, including the §9 observability
  requirement: `reportSepContractFailure` logs offending field names only, and
  the raw `ZodError` message is never referenced. Zero-request is asserted at the
  API client where `parse` precedes `postJson` and at the composable where
  `createSep` is never invoked. The TD-007 recovery path is reused unmodified
  and the rethrow genuinely reaches the existing catch; the implementer's
  "pre-existing behaviour, proven by test" claims were independently verified to
  be real and the new tests non-vacuous. Slice Review Status set to GO by the
  Reviewer. Findings recorded: RV-001 NOTE (deliberate omission of the
  `SEP_CREATE_ATTEMPTED` marker, adjudicated as sound and routed to the Architect
  as a TD-007 semantics question, not a defect), RV-002 MINOR (stale aggregate
  Progress Summary and phase rows, escalated to the Architect), RV-003 NOTE
  (unused return value of `reportSepContractFailure`), RV-004 NOTE (unrelated
  working-tree `global_config.json` change, not part of any slice diff).
  Plan-level Status set to COMPLETED: every slice (P1-S01, P1-S02, P2-S03,
  P2-S04) has Implementation Status IMPLEMENTED and Review Status GO, and the
  §6 gate `pnpm turbo run typecheck test --force` passes 22/22 with no cached
  tasks. Testing is now authorised; human retest of DEF-001 remains a separate
  post-COMPLETED activity owned by the Tester. No plan structure was changed.
