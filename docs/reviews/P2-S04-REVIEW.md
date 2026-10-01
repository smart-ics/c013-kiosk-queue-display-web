---

Code: KIOSK-SEP-SKDP
Artifact: REVIEW
Slice: P2-S04
ReviewIteration: 0
Decision: GO
---

# Scope Reviewed

Slice P2-S04 — "Contract-failure behaviour and contract-rejection observability"
(IMPLEMENTATION-PLAN `c013-kiosk-queue-display-web/docs/plans/KIOSK-SEP-SKDP-DEF-001-IMPLEMENTATION-PLAN.md` §5, lines 374–471).

Dependencies verified independently in the plan artifact: P1-S01 (Implementation
Status IMPLEMENTED, Review Status GO) and P2-S03 (IMPLEMENTED, GO) — both satisfied.

Repository: `c013-kiosk-queue-display-web`.

Primary specification reviewed: ARCHITECTURE v1.1 TD-009 (lines 255–274),
TD-007 (lines 205–223), TD-008 (lines 225–253), and §9 "Contract validation
observability" (lines 410–420).

Change set reviewed (`git status`, `git diff`):

- NEW `apps/kiosk-web/src/lib/sepContract.ts`
- NEW `apps/kiosk-web/src/lib/__tests__/sepContract.spec.ts`
- MOD `apps/kiosk-web/src/composables/useKioskRegistration.ts` (49 changed lines:
  two imports, the `buildSepPayloadPolicy` signature change belonging to P2-S03,
  and the narrow `try`/`catch` belonging to this slice — verified nothing else changed)
- MOD `apps/kiosk-web/src/composables/__tests__/useKioskRegistration.spec.ts`
- MOD `packages/api-client/src/__tests__/his.spec.ts`

`apps/kiosk-web/public/global_config.json` is modified in the working tree but
belongs to no slice and to no slice `Changed Files` list. Not part of this
slice's diff; not ruled on here (see RV-004).

Verification commands run from `c013-kiosk-queue-display-web`:

| Command | Result |
|---|---|
| `pnpm --filter kiosk-web test` | 36 files, 288/288 passed |
| `pnpm --filter @aq/api-client test` | 4 files, 33/33 passed |
| `pnpm --filter @aq/shared-types test` | 2 files, 25/25 passed |
| `pnpm turbo run typecheck test --force` | 22/22 tasks successful, 0 cached |

`lint` was not used as a gate (noop in every package, per plan §6).

# Completion Criteria Verification

| Criterion | Result | Evidence |
|---|---|---|
| A non-conforming `sepDate` results in zero `POST /sep` requests | PASS | `packages/api-client/src/his.ts:341` calls `sepCreateBodySchema.parse(body)` before `client.postJson` (line 342), so a rejection precedes any HTTP call. `his.spec.ts` "issues no request for a date-only sepDate and does not repair it" and "issues no request for a sepDate without the seconds component" both `expect(() => api.createSep(...)).toThrow()` then `expect(fetchImpl).not.toHaveBeenCalled()`. The schema constraint is `packages/shared-types/src/index.ts:623` `z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)`, required. The kiosk path is additionally pinned by "issues no SEP request and preserves the regId when sepDate cannot be composed" (`expect(deps.createSep).not.toHaveBeenCalled()`) and, from P2-S03, "rejects the SEP payload when the business date is unavailable, without a fallback date". |
| The recovery state preserves `regId` and prints the existing notice, matching the behaviour already proven for other post-registration failures | PASS | Existing, unmodified TD-007 path: `registrationResult.value = result` and `postRegistrationPhase.value = 'REGISTRATION_CREATED'` (useKioskRegistration.ts:901–902) execute before payload composition; the outer `catch` at :978–982 calls `enterAdmisiFallback()` (`:337–346`), which sets `ADMISI_FALLBACK`, reads `registrationResult.value?.regId`, and calls `setFailure(BACKEND_ERROR, "Pendaftaran berhasil (${regId}), namun pemrosesan SEP belum selesai. Silakan menuju Loket Admisi untuk penyelesaian berkas.")`. Tests assert `postRegistrationPhase === 'ADMISI_FALLBACK'`, `registrationResult.value?.regId === 'R1'`, and that the message contains `Pendaftaran berhasil (R1)`. The notice text is the pre-existing `buildAdmisiFallbackNotice` / `ADMISI_FALLBACK_NOTICE_TEXT` (`KioskPage.vue:302`); no new recovery state, no new terminal screen, no state-machine edit (see the `git diff` of the composable). |
| A contract rejection produces a log entry naming the field, distinguishable from a service error response | PASS | `sepContract.ts:17` `SEP_CONTRACT_FAILURE_LOG_PREFIX = '[kiosk] SEP request contract failure'`; `:41–48` emits exactly one line containing `field=<fields>` and the phrase "rejected by the client contract before any POST /sep request was issued". Composables test "logs the rejection as a contract failure naming sepDate" asserts exactly one prefixed line containing `field=sepDate`; the two negative tests assert zero prefixed lines for a Jetli business rejection (plain-string result → `Error('Gagal membuat SEP: …')`) and for an `ApiClientError` transport failure, while both still reach `ADMISI_FALLBACK`. Distinguishability therefore holds in both directions. |
| `pnpm --filter kiosk-web test` and `pnpm --filter @aq/api-client test` pass | PASS | 288/288 and 33/33 respectively, plus the full plan gate `pnpm turbo run typecheck test --force` at 22/22 tasks, 0 cached. |

# Plan Obligations Verified

| Obligation | Result | Evidence |
|---|---|---|
| 1 — zero `POST /sep`, asserted at the API client | PASS | `his.ts:341–342` parse-before-`postJson`; the three new api-client tests (missing, date-only, seconds-less `sepDate`) each assert `fetchImpl` never called. |
| 2 — local contract failure: no retry, no fallback date, no zeroed time, no omitted field, no second registration, no second SEP | PASS | The narrow `try`/`catch` (useKioskRegistration.ts:912–936) reports and then `throw error` — it neither swallows nor retries. `buildSepPayloadPolicy` composes `sepDate` via `composeSepDate`, which rejects a malformed business date or clock rather than repairing it (`sepDate.ts:26–35`). Tests assert `createSep` called at most once (`toHaveBeenCalledTimes(1)`), `registerBooking` `toHaveBeenCalledTimes(1)`, `uploadSep` and `setDataEligibility` never called. |
| 3 — existing TD-007 recovery reused, not modified; no new recovery state or terminal screen | PASS | `enterAdmisiFallback` and the phase union (`:247–256`) are untouched by the diff; `postRegistrationPhase` is set only to the pre-existing values. The only consumer, `KioskPage.vue:302`, reads `'ADMISI_FALLBACK'` and is unmodified. |
| 4 — contract failure logged naming `sepDate`, separately from service error text | PASS | See criterion 3 above, plus the two negative tests. Both negative tests are non-vacuous (see below). |
| 5 — log carries no participant identity, credentials, or request body | PASS | `contractFailureFields` (`sepContract.ts:19–30`) returns only `error.field` or `issue.path[0]` segments. The raw `ZodError` `message` (which embeds received values) is never referenced anywhere in the file, and the `SepDateContractError` message is not logged either. The emitted line is a template of prefix + field list + fixed text. |
| 6 — tests assert all six required facts | PASS | No request issued (`fetchImpl` not called; `createSep` not called); `createSep` never invoked with a non-conforming payload (composition fails before the call, and the schema-conformance test parses the emitted payload); no retry (`createSep`/`registerBooking` `toHaveBeenCalledTimes(1)`); `ADMISI_FALLBACK`; `regId === 'R1'`; exactly one contract-failure log naming `sepDate`. |

# Independent Assessment of the "Pre-Existing Behaviour, Proven by Test" Claims

The implementer separated its work into newly implemented behaviour
(contract-rejection observability, the narrow `try`/`catch`) and pre-existing
behaviour that it only pinned with tests (ADMISI_FALLBACK + `regId` preservation;
zero-request at the client). I verified each claim independently rather than
accepting it.

Claim A — zero `POST /sep` at the API client. Independently confirmed by reading
`packages/api-client/src/his.ts:340–343`: `sepCreateBodySchema.parse(body)` runs
synchronously before `client.postJson`. This is genuinely pre-existing (P1-S01,
already reviewed GO), and the three new tests in `his.spec.ts` exercise the real
adapter with a real `fetchImpl` spy. Non-vacuous.

Claim B — the recovery path (`ADMISI_FALLBACK`, `regId` preserved, existing
notice). I read the control flow: `registrationResult.value` is assigned at
:901 and the whole SEP block is inside the `try` whose `catch` at :978 routes to
`enterAdmisiFallback()` whenever `registrationResult.value` is set. The
`SepDateContractError` thrown synchronously by `composeSepDate` inside the
`buildSepPayloadPolicy` call therefore genuinely reaches that catch, and
`enterAdmisiFallback` runs unmodified. No guard, short-circuit, or special case
was added — the implementer did not fake the path.

The two headline recovery tests are non-vacuous, not assertions of incidental
current behaviour:

1. "issues no SEP request and preserves the regId when sepDate cannot be
   composed" — `makeDeps({ now: () => Number.NaN })` with the real composer.
   The composer is real code, the business date fixture (`'2026-08-03'`) is
   real and conforming, and the `Number.NaN` clock drives the real
   `composeSepDate` guard at `sepDate.ts:29–35`. Nothing that is under test is
   mocked away: only the network boundary (`createSep`) is a spy, and the
   assertion is that it is *not* reached. The flow is driven end-to-end through
   the real `register()` via the real booking path, reaching
   `flow === 'FAILURE'` and `postRegistrationPhase === 'ADMISI_FALLBACK'` — a
   combination only the post-registration catch can produce. This is a genuine
   local contract failure driven by a real input.
2. "recovers once, without retrying, when the shared client contract rejects the
   payload" — this one mocks `createSep`, which is legitimate here: the thing
   under test is the composable's handling of a `ZodError` raised at the client
   boundary, and the mock raises a *real* `ZodError` produced by the *real*
   shared `sepCreateBodySchema.parse` fed a genuinely date-only `sepDate` — not a
   hand-rolled `new ZodError([])`. It asserts one call (no retry), no upload, no
   eligibility call, one registration, `ADMISI_FALLBACK`, `regId === 'R1'`, and
   exactly one `field=sepDate` log. Meaningful.

The two negative tests are also non-vacuous. The business-rejection test drives
`createSep` resolving to the plain string `'SEP sudah ada untuk pasien ini'`,
which the production code converts at :937–939 into
`Error('Gagal membuat SEP: …')` — a plain `Error`, correctly unrecognised, and
the test additionally asserts the flow still reaches `ADMISI_FALLBACK`, so it
cannot pass by the flow silently taking another route. The transport test raises
`ApiClientError` from the real `@aq/api-client` export. In both cases the
`contractLogLines` helper filters *only* lines carrying
`SEP_CONTRACT_FAILURE_LOG_PREFIX`, so a passing `toHaveLength(0)` genuinely means
"no contract-failure line", not "no log at all". Cross-package
`instanceof ZodError` in `sepContract.ts` is also safe: every dependent
(`kiosk-web`, `@aq/api-client`, `@aq/shared-types`) pins the identical
`zod` `3.25.76` specifier, and the end-to-end composable test that asserts
`field=sepDate` from a `ZodError` originating in `@aq/shared-types` passes, which
empirically confirms it.

Composition and `createSep` coverage: the narrow `try` spans both the
`buildSepPayloadPolicy` call and the `createSep` call, and it is followed by an
unconditional rethrow, so the outer catch is guaranteed to see the error. The
`git diff` of `useKioskRegistration.ts` contains only the two new imports, the
P2-S03 `buildSepPayloadPolicy` signature change, and this `try`/`catch` — no
behaviour drift, no altered error mapping, no reordering. The
`typeof sepRes === 'string'` check moved from a `const` binding to the
`let sepRes` binding but is semantically unchanged.

# Findings

## RV-001

Severity: NOTE

Description: The implementer deliberately left
`postRegistrationPhase = 'SEP_CREATE_ATTEMPTED'` un-set for a composer contract
failure, since the assignment now sits after payload composition. I adjudicated
this independently against TD-007 and TD-009. TD-007 enumerates the phase
progression and requires that a post-registration failure transition to
`ADMISI_FALLBACK` while preserving `regId`; it does not require that a request
which was never issued be marked as attempted. TD-009 requires the failure to be
treated as a local contract failure, to issue no request, and to surface through
the existing recovery behaviour — all satisfied. The observable state after
recovery is identical either way, because `enterAdmisiFallback()` overwrites the
phase with `ADMISI_FALLBACK`, and the only consumer of `postRegistrationPhase`
(`KioskPage.vue:302`) reads `'ADMISI_FALLBACK'`. The implementer's reasoning
(no request issued ⇒ "attempted" would misreport) is technically sound and
defensible.

Evidence: ARCHITECTURE TD-007 lines 205–223; TD-009 lines 262–270;
`useKioskRegistration.ts:931` (marker inside the `try`, after composition) and
`:337–338` (`enterAdmisiFallback` sets `ADMISI_FALLBACK` unconditionally);
`KioskPage.vue:302` is the sole reader of the phase.

Required Correction: None. If the Architect considers `SEP_CREATE_ATTEMPTED` to
be a mandatory phase marker regardless of whether a request left the client,
that is a TD-007 semantics decision, not an implementation defect, and should be
routed to the Architect rather than remediated here.

Status: OPEN (escalated as an observation — not a slice acceptance blocker)

## RV-002

Severity: MINOR

Description: Plan-level aggregate status fields remain stale. The §4 Progress
Summary table still reads `P1 | NOT-STARTED | NOT-REVIEWED | 0/2` and
`P2 | NOT-STARTED | NOT-REVIEWED | 0/2`, and the §5 phase headings still read
`Implementation Status: NOT-STARTED` / `Review Status: NOT-REVIEWED`, while every
slice is IMPLEMENTED and GO. Same class of defect as RV-001 in
`P3-S07-REVIEW.md`.

Evidence: `KIOSK-SEP-SKDP-DEF-001-IMPLEMENTATION-PLAN.md` lines 130–133 and
141–142, 278–279, versus the slice-level statuses at lines 152–153, 232–233,
287–288, 378–379.

Required Correction: Reconcile the phase-level and Progress Summary aggregate
fields with the completed slice state. This is aggregate bookkeeping; per
reviewer boundaries, implementation-status fields and plan structure are not
modified by Review. Escalated to the Architect.

Status: OPEN (escalated — not a slice acceptance blocker)

## RV-003

Severity: NOTE

Description: `reportSepContractFailure` returns a boolean that the composable
call site discards (`useKioskRegistration.ts:934`); the error is rethrown
unconditionally either way. This is the correct behaviour for this slice — the
recovery path must not vary by error kind — but the return value is currently
unused in production code and exists only to make the recognition decision
testable.

Evidence: `sepContract.ts:41–48`; sole call site `useKioskRegistration.ts:934`.

Required Correction: None. Future work may reuse the boolean if a caller needs
to differentiate recovery; noted for traceability only.

Status: OPEN (observation)

## RV-004

Severity: NOTE

Description: `apps/kiosk-web/public/global_config.json` is modified in the
working tree. Confirmed it is not listed in any slice's `Changed Files` and is
not part of this slice's diff. It belongs to no slice and is under owner review.

Evidence: `git status --porcelain` shows it as the only non-test/non-doc
unrelated modification; the slice's `Changed Files` (plan lines 465–471) exclude it.

Required Correction: None in this review.

Status: OPEN (outside slice scope — noted only)

# Current Decision

GO — the slice objective, ARCHITECTURE TD-009, TD-007, TD-008 and §9 Contract
validation observability, the approved dependencies, and all four Completion
Criteria are satisfied with concrete evidence. No BLOCKER or MAJOR findings.
Three NOTEs and one MINOR, none acceptance-blocking.

Plan-level Status set to **COMPLETED**. Evidence, read from the plan artifact
after this review: P1-S01 IMPLEMENTED / GO, P1-S02 IMPLEMENTED / GO, P2-S03
IMPLEMENTED / GO, P2-S04 IMPLEMENTED / GO. Every slice meets the plan §4
condition, and the §6 verification gate `pnpm turbo run typecheck test` passes
22/22 with no cached tasks. Testing and test-package creation are now authorised;
human retest of DEF-001 (TEST-EXECUTION TC-RE-02) remains a separate
post-COMPLETED activity owned by the Tester.

`Review Status` for P2-S04 set to GO by the Reviewer. No `Implementation Status`
was modified by this review.

# Re-Review History

## Iteration 0 (initial review)

Decision: GO

Summary: Final slice reviewed. Contract-rejection observability implemented via a
new `reportSepContractFailure` that logs only offending field names — no identity,
no credentials, no request body, and the raw `ZodError` message is never
referenced. Zero-request behaviour asserted at the API client where
`parse` precedes `postJson`, and at the composable where `createSep` is never
invoked. The TD-007 recovery path is reused unmodified and the rethrow genuinely
reaches the existing catch; the "pre-existing behaviour" claims were verified to
be real and the new tests non-vacuous. The narrow `try`/`catch` is the only
composable change in this slice. Findings: RV-001 NOTE (deliberate omission of
`SEP_CREATE_ATTEMPTED`, adjudicated as sound and routed to the Architect as a
TD-007 semantics question), RV-002 MINOR (stale aggregate progress rows,
escalated), RV-003 NOTE (unused return value), RV-004 NOTE (unrelated working-tree
change). Plan-level Status set to COMPLETED.
