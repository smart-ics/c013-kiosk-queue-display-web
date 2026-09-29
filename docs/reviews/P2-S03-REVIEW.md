---

Code: KIOSK-SEP-SKDP
Artifact: REVIEW
Slice: P2-S03
ReviewIteration: 0
Decision: GO
---

# Scope Reviewed

Slice P2-S03 — "Compose `sepDate` at the SEP payload boundary and correct the
date-only assertions" (IMPLEMENTATION-PLAN
`c013-kiosk-queue-display-web/docs/plans/KIOSK-SEP-SKDP-DEF-001-IMPLEMENTATION-PLAN.md`,
section `### P2-S03`, lines 283–370).

Dependency verified: P1-S02 — Implementation Status `IMPLEMENTED`, Review Status
`GO` (plan line 232–233). Satisfied. P1-S01 is not a declared dependency of this
slice (plan line 109) and was not re-adjudicated.

Repository: `c013-kiosk-queue-display-web`.

Files actually read for this review (working tree, not the implementer's report):

- `apps/kiosk-web/src/composables/useKioskRegistration.ts` (full SEP-create path,
  lines 90–100, 194–235, 896–973)
- `apps/kiosk-web/src/lib/sepDate.ts` (P1-S02 composer, full)
- `apps/kiosk-web/src/composables/__tests__/useKioskRegistration.spec.ts`
  (full P2-S05 describe block, lines 1885–2230)
- `packages/shared-types/src/index.ts` lines 615–630 (P1-S01 contract, untouched
  by this slice)
- `git diff` / `git status` for the real change set

# Completion Criteria Verification

| Criterion (plan lines 355–363) | Result | Evidence |
|---|---|---|
| The value passed to `createSep` matches `yyyy-MM-dd HH:mm:ss` in the **Rujukan** branch | PASS | `useKioskRegistration.ts:911-919` builds the payload and `:924` passes it to `deps.createSep`. `useKioskRegistration.spec.ts:1904` asserts `sepDate: '2026-08-03 14:05:06'` on the actual `deps.createSep.mock.calls[0][0]` for the booking-Rujukan flow; `:2211-2213` asserts the exact value `'2026-08-03 22:30:09'`, asserts `toMatch(SEP_DATE_TIME_PATTERN)`, and asserts `sepCreateBodySchema.parse(payload).sepDate` equals it. |
| …matches `yyyy-MM-dd HH:mm:ss` in the **SKDP** branch | PASS | `spec.ts:1936` (SKDP booking) and `:1979` (SKDP walk-in) assert `sepDate: '2026-08-03 14:05:06'` on the captured `createSep` payload. Unit-level: `spec.ts:2149-2150` asserts the SKDP payload value and that it survives `sepCreateBodySchema.parse`. |
| The date component equals the business date in a test where the business date and the clock date differ | PASS | `spec.ts:246-247` defines `SEP_CLOCK_OTHER_DAY = new Date(2026, 7, 4, 22, 30, 9).getTime()` (clock date 2026-08-04) against business date `2026-08-03`. `spec.ts:2173` asserts the emitted value is `'2026-08-03 22:30:09'` — business date, not clock date. `spec.ts:2211` proves the same through the live Rujukan flow. |
| No date-only `sepDate` assertion or fixture remains in the kiosk SEP-create path | PASS | `rg sepDate` over `apps/kiosk-web` returns only full date-time literals (`1904`, `1936`, `1979`, `2137-2139`, `2149-2150`, `2173`, `2211-2213`) and the production producer at `useKioskRegistration.ts:220`. Zero `'yyyy-mm-dd'`-only `sepDate` values remain in the kiosk SEP-create path. |
| `pnpm --filter kiosk-web test` passes | PASS | Run as part of the plan gate: kiosk-web `Test Files 35 passed (35)`, `Tests 280 passed (280)`. |

## Plan "Required implementation output" obligations (plan lines 333–353)

| Obligation | Result | Evidence |
|---|---|---|
| 1. `buildSepPayloadPolicy` emits a `yyyy-MM-dd HH:mm:ss` `sepDate` using the P1-S02 composer, **with seconds**; no seconds-less path reachable | PASS | `useKioskRegistration.ts:220` is the **only** producer of the field and is `sepDate: composeSepDate(businessDate, clock)`. `sepDate.ts:36-37` always emits `${pad2(h)}:${pad2(m)}:${pad2(s)}` — seconds are unconditional, and the returned shape is `${businessDate} ${time}`. The `'yyyy-MM-dd HH:mm'` (minutes-only) form the receiver rejects is unreachable through this function. P1-S01's `sepCreateBodySchema` (`packages/shared-types/src/index.ts:623`) independently rejects minutes-only, so a regression would fail both the app and package suites. |
| 2. The clock is the existing injectable `KioskRegistrationDeps.now?: () => number`; no new clock dependency; default behaviour retained | PASS | The dependency is declared at `useKioskRegistration.ts:95` and is **not** in the slice's diff — `git diff` on the file touches only lines 33–36, 194–220, and 905–919. Call site `:915` is `clock: (deps.now ?? Date.now)()`, i.e. the pre-existing default `Date.now` is retained when the dependency is omitted. No new member was added to `KioskRegistrationDeps`. |
| 3. The business date remains the source of the date component; the host calendar date is never substituted | PASS | `useKioskRegistration.ts:914` passes `businessDate: businessDate.value ?? ''` — the HIS business date ref, not any host date. `sepDate.ts:26-28,37` takes the date part verbatim from the `businessDate` argument only after `/^\d{4}-\d{2}-\d{2}$/` passes; the clock contributes time only. Proven at runtime by `spec.ts:2173`. |
| 4. `deps.getBusinessDate`, `businessDateSchema`, the HIS business-date endpoint, the value of `businessDate`, and its other consumers (visit-date comparison, scheduling, age formatting) are unchanged | PASS | The slice diff to `useKioskRegistration.ts` contains no hunk touching `ensureBusinessDate` (`:379-384`), `calculateAge` (`:841`), or any scheduling/comparison code. `rg` shows no other file modified by this slice. The plan Notes prohibition (lines 367–368) is respected. |
| 5. Rujukan and SKDP branches emit the **same** composed value; the contract is not reference-specific | PASS | `buildSepPayloadPolicy` computes `sepDate` in the single shared return literal (`:220`), reached by both branches; the branch only varies `noRujukan`/`tujuanKunjunganId`/`assesmentPelayananId`/`faskesPerujukId`. `spec.ts:2137` and `:2149` assert the byte-identical `'2026-08-03 14:05:06'` for a `rujukan` and a `skdp` ref. |
| 6. Existing date-only assertions/fixtures updated to conforming values, **other assertions preserved** (no silent coverage loss) | PASS | Full `git diff` of the spec file was read. The only removed lines are the five `sepDate: '2026-08-03'` fixtures (`:1901`, `:2032`, `:2062`, `:2094`, `:2104`) and the three `const deps = makeDeps({ ... })` lines that were re-wrapped to add `now: () => SEP_CLOCK`. Every surrounding assertion (`sepId`, `noPeserta`, `noRujukan`, `pasienId`, `kelasRawatId`, `tujuanKunjunganId`, `assesmentPelayananId`, `flagProcedureId`, `penunjangId`, `faskesPerujukId`) is intact — 151 insertions, 4 net deletions, no assertion body removed. No broad find-and-replace damage found. |
| 7. New tests assert the **exact** emitted `sepDate`, including the business-date-differs case and a SKDP conforming value | PASS | Five new tests, `spec.ts:2115` (both branches, exact value + schema round-trip), `:2160` (business date vs clock date differ), `:2181` (malformed business date → `SepDateContractError`), `:2200` (live Rujukan flow, clock date differs, exact value + pattern + schema), `:2222` (unset business date → `createSep` never called, no fallback date). Both clock constants (`:241`, `:247`) are built from local-time components (`new Date(2026, 7, 3, 14, 5, 6)`), so the asserted `HH:mm:ss` is timezone-independent by construction. |
| 8. TD-005 not widened; no other SEP payload field's policy changed | PASS | The slice diff to the returned payload literal changes **only** the `sepDate` line (`:220`). `tujuanKtekstId`/`assesmentPelayananId`/`flagProcedureId`/`penunjangId`/`kelasRawatId`/`faskesPerujukId`/`rujukanId`/`caraMasukDkId` values and the missing-diagnosis throw (`:212-215`) are untouched. The plan Notes prohibition (lines 369–370) is respected. |

## Verification Gate (plan section 6)

| Check | Result | Evidence |
|---|---|---|
| `pnpm turbo run typecheck test` | PASS | `Tasks: 22 successful, 22 total` on a forced (`--force`) full re-run; kiosk-web `Test Files 35 passed (35)`, `Tests 280 passed (280)`. `lint` was not used as a gate (noop in every package, plan line 442–443). |
| Slice change set is confined to the two declared files | PASS | `git status` shows the P2-S03 modification confined to `useKioskRegistration.ts` and `useKioskRegistration.spec.ts`, matching plan "Changed Files" (lines 319–322). `apps/kiosk-web/public/global_config.json` is modified in the working tree but is **not** part of this slice's diff — confirmed absent from the reviewed diff (see RV-003). |

# Findings

## RV-001

Severity: MINOR

Description: `buildSepPayloadPolicy` — an **exported** function — had its public
input signature changed from `sepDate: string` to `businessDate: string` +
`clock: number`, moving `composeSepDate` inside the policy function rather than
having the call site compose a finished string. This is a signature change to an
exported symbol, taken on a literal reading of the plan line
"`buildSepPayloadPolicy` … emits the composed `yyyy-MM-dd HH:mm:ss` value …
using the composer from P1-S02" (plan line 335–337) versus composing at the call
site and passing the result in.

Evidence: `useKioskRegistration.ts:203-220` (signature and body) and `:911-919`
(the single production call site). Blast radius was verified by exhaustive
`rg "buildSepPayloadPolicy"` across the whole monorepo: the only consumers are
the one production call site at `:911` and nine invocations inside
`useKioskRegistration.spec.ts` (`:2032`, `:2062`, `:2094`, `:2104`, `:2129`,
`:2141`, `:2165`, `:2189`). The symbol is **not** re-exported from any package
barrel, is not imported by `display-web`, `config-web`, or any `@aq/*` package,
and is not a published API — it is an app-module export consumed only within
`apps/kiosk-web`. The type checker agrees: the forced gate run is clean, so no
unmigrated consumer exists. All nine test call sites were migrated in the same
diff (`:2032`, `:2062`, `:2094`, `:2104`).

Independent assessment, formed from the code rather than the implementer's
report:

- The reading is **defensible and, on the balance, the better one**. The
  alternative (compose at the call site, pass `sepDate: string` in) leaves a
  caller-supplied pre-formatted field on an exported function, which is exactly
  the unwrappable surface the slice objective — "Apply the TD-008 composition at
  the outbound request boundary and remove the test assumptions that encode a
  date-only `sepDate` as correct" (plan lines 324–327) — is trying to close. The
  plan names `buildSepPayloadPolicy` as the emitter, not the call site, and this
  is the only reading under which "no call site can pass an unconformed value"
  holds.
- Consistency with ARCHITECTURE TD-008/TD-009: satisfied. TD-008 places
  composition "at the outbound contract boundary" and TD-009 declares the
  constraint "in the shared client contract, not only applied at the call site"
  (ARCHITECTURE lines 235–237, 257–260). Both are upheld; the policy function
  sits at that boundary and the shared schema is the backstop.
- Blast radius is genuinely contained: one production call site, app-internal
  only, all consumers migrated, compiler-verified.
- Residual concern: the change is an API-surface change to an exported function
  with no ADR entry and no explicit plan instruction to alter the signature.
  Within `apps/kiosk-web` this is a non-breaking internal refactor with zero
  runtime impact. It is recorded for traceability and for the Architect, not as
  a required correction.

Required Correction: None. The reviewer does not require reverting to the
smaller-diff call-site composition. If the Architect later prefers a stable
exported signature, that is an architecture/plan decision outside this slice and
outside reviewer authority.

Status: OPEN (informational, non-blocking — not a slice acceptance blocker)

## RV-002

Severity: NOTE

Description: **The implementer's forward claim is partially incorrect, and the
correction matters for P2-S04's planning.** The implementer reported that
`composeSepDate` throws `SepDateContractError` synchronously inside `register()`
and that "the throw escapes the existing try/catch chain", so the flow does
**not** reach `ADMISI_FALLBACK` and instead surfaces as a raw `FAILURE` via
`mapErrorToFailureCode`. The Reviewer read the code and **refutes the
"escapes the try/catch" and "does not reach ADMISI_FALLBACK" parts**, and
**confirms the residue**.

Precise position, with evidence:

- `buildSepPayloadPolicy` is invoked at `useKioskRegistration.ts:911`, which is
  **inside** the `try` opened at `:897`, whose `catch` is at `:966`. A
  synchronous throw from a function called in a `try` block is caught by that
  `catch`. There is no rethrow, no intervening `await` boundary that would move
  the throw out of the block, and no conditional wrapping the call. The throw
  does **not** escape.
- `registrationResult.value = result` is assigned at `:900`, **before** the call
  at `:911`. Therefore `registrationResult.value` is truthy when the `catch` at
  `:967` tests it, and `enterAdmisiFallback()` at `:968` **is** called
  (`:336-345`): `postRegistrationPhase` becomes `ADMISI_FALLBACK`, the created
  `regId` is preserved (`:338`), and the existing admisi handoff notice is
  set as the failure message (`:341-344`). The flow does **not** surface as a
  generic `FAILURE` through `mapErrorToFailureCode`; that branch at `:971` is
  only reached when `registrationResult.value` is falsy, i.e. for pre-registration
  failures.
- **Confirmed residue** (true parts of the report): the throw occurs before
  `postRegistrationPhase.value = 'SEP_CREATE_ATTEMPTED'` at `:923`, so that
  marker is never set for this failure mode; and `enterAdmisiFallback()` logs
  only the `regId` (`:340`), so **no log entry names `sepDate`** and the
  rejection is not distinguishable in logs from a service error, which is
  precisely what P2-S04 must add.
- This is **not a P2-S03 defect.** P2-S03 has no acceptance criterion about
  recovery state or logging; P2-S04 owns exactly that (plan lines 392–409,
  including "the flow reaches the existing post-registration recovery state,
  preserving the created `regId`" and "the rejection is logged as a contract
  failure that names the offending field"). Recorded so the P2-S04 implementer
  is not misled: the ADMISI_FALLBACK and regId-preservation behaviour already
  works today and needs no new mechanism — only the field-naming contract log
  (and, if desired, the `SEP_CREATE_ATTEMPTED` marker) remains to be added.

Evidence: `useKioskRegistration.ts:897`, `:900`, `:911-919`, `:923`, `:966-972`,
`:336-345`; corroborated by the new test
`spec.ts:2222` ("rejects the SEP payload when the business date is
unavailable, without a fallback date"), which passes with `createSep` never
called.

Required Correction: None for P2-S03. Forward input to P2-S04.

Status: OPEN (forward finding for P2-S04 — explicitly not a P2-S03 acceptance item)

## RV-003

Severity: NOTE

Description: `apps/kiosk-web/public/global_config.json` carries an uncommitted
`jetliApiBase` retarget in the working tree that belongs to no slice and is under
owner review. Confirmed **not** part of the P2-S03 change set and **not** ruled
on by this review.

Evidence: `git diff` on the P2-S03 files shows the spec/composable diffs only;
the `global_config.json` hunk is a separate, unrelated file. Same observation
already recorded as P1-S01 RV-004.

Required Correction: None.

Status: OPEN (owner review, outside slice scope)

## RV-004

Severity: MINOR

Description: Plan-level aggregate bookkeeping is stale. The Progress Summary
table (lines 130–133) and the phase headings (P1 lines 141–142, P2 lines 278–279)
still report `NOT-STARTED` / `NOT-REVIEWED` / `0/2`, while slice-level state now
reads P1-S01 GO, P1-S02 GO, P2-S03 IMPLEMENTED + GO. This is aggregate bookkeeping
only; slice-level fields are authoritative and are correct.

Evidence: plan lines 130–133, 141–142, 278–279 vs. lines 232–233, 287–288.

Required Correction: Reconcile the phase rows and Progress Summary with the
authoritative slice state. Implementation-status fields and plan structure are not
modified by Review. Escalated to the Architect. Precedent: P3-S07-REVIEW.md
RV-001 (MINOR, non-blocking).

Status: OPEN (escalated — not a slice acceptance blocker)

# Current Decision

GO — slice objective, plan scope, architecture (TD-008 composition at the
outbound boundary, TD-009 client-side contract), the P1-S02 dependency, and all
four Completion Criteria are satisfied with concrete evidence. No BLOCKER or
MAJOR findings. Four findings recorded: RV-001 MINOR, RV-002 NOTE, RV-003 NOTE,
RV-004 MINOR.

Slice P2-S03 `Review Status` set to **GO** in the IMPLEMENTATION-PLAN. Slice
`Implementation Status` left as the Implementer wrote it (`IMPLEMENTED`).

Plan-level `Status` left **IN-PROGRESS** — it is NOT COMPLETED. P2-S04 has
Implementation Status `NOT-STARTED` and Review Status `NOT-REVIEWED`, so not
every slice is IMPLEMENTED and GO. Testing and test-package creation remain
unauthorized.

No source code was modified by this review. No plan structure was changed. No
`Execution Approval` value was touched.

# Re-Review History

## Iteration 0 (initial review)

Decision: GO

Summary: Composition of `sepDate` at the SEP payload boundary verified against
the actual code, not the implementer's report. `buildSepPayloadPolicy` emits the
value through the P1-S02 `composeSepDate` with seconds unconditionally and is the
sole producer of the field; the clock is the pre-existing `deps.now` with the
original `Date.now` default; the business date remains the sole source of the
date part; no other SEP policy field, no business-date consumer, and TD-005 were
touched. All four Completion Criteria PASS. Gate `pnpm turbo run typecheck test`
passes 22/22 (kiosk-web 35 files / 280 tests) on a forced re-run. Spec diff read
in full — no pre-existing assertion lost. Findings: RV-001 MINOR (exported
signature change; blast radius verified contained and the reading upheld),
RV-002 NOTE (implementer's ADMISI_FALLBACK claim refuted — the throw **is**
caught and **does** reach `ADMISI_FALLBACK` with `regId` preserved; the real
residue is the missing field-naming log and the un-set `SEP_CREATE_ATTEMPTED`
marker, both P2-S04's territory, not a P2-S03 defect), RV-003 NOTE
(`global_config.json` out of slice scope), RV-004 MINOR (stale plan aggregate
bookkeeping, precedent P3-S07 RV-001).
