---

Code: KIOSK-SEP-SKDP
Artifact: REVIEW
Slice: P1-S02
ReviewIteration: 0
Decision: GO
---

# Scope Reviewed

Slice P1-S02 — "SEP date-time composer" (IMPLEMENTATION-PLAN
`c013-kiosk-queue-display-web/docs/plans/KIOSK-SEP-SKDP-DEF-001-IMPLEMENTATION-PLAN.md`,
section "### P1-S02", lines 228–272).

Dependencies: `Depends On: None` — none to verify.

Repository: `c013-kiosk-queue-display-web`.

Change set actually observed for this slice (independent `git status` / `git diff`,
not the implementer's report):

- NEW `apps/kiosk-web/src/lib/sepDate.ts`
- NEW `apps/kiosk-web/src/lib/__tests__/sepDate.spec.ts`
- `apps/kiosk-web/src/composables/` — **no modifications** (`git status --porcelain
  -- apps/kiosk-web/src/composables` returns empty).
- `packages/**` — modified only by the parallel P1-S01 execution
  (`packages/shared-types/src/index.ts`, `packages/shared-types/src/__tests__/hisSchemas.spec.ts`,
  `packages/api-client/src/__tests__/his.spec.ts`); no kiosk-web package file is
  part of this slice's change set.

Authority consulted: ARCHITECTURE v1.1 TD-008 (lines 225–253), §9 Clock discipline
(lines 395–408), TD-009 (lines 255–269). Plan P1-S02 notes (lines 268–272).

Reviewed API surface as verified in code:

```ts
export const SEP_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/
export class SepDateContractError extends Error {
  readonly field = 'sepDate'          // sepDate.ts:6
  constructor(message: string)       // sepDate.ts:8
}
export function composeSepDate(businessDate: string, clock: number): string  // sepDate.ts:25
```

# Completion Criteria Verification

| Criterion | Result | Evidence |
|---|---|---|
| Composer is importable from `apps/kiosk-web/src/lib/` | PASS | `apps/kiosk-web/src/lib/sepDate.ts` exists (38 lines); imported by its spec at `src/lib/__tests__/sepDate.spec.ts:2`. Typecheck via `vue-tsc` passes in the gate. |
| Composer is a pure function with no dependency on the registration composable, the API client, or the shared schemas | PASS | `sepDate.ts` contains **zero** `import` statements (verified by reading the whole 38-line file; the only constructs are two regex literals, a class, a `pad2` helper, and the exported function). No reference to `useKioskRegistration`, `@aq/api-client`, or `@aq/shared-types`. Repo-wide grep for `composeSepDate` returns hits only in `sepDate.ts` and `sepDate.spec.ts`. |
| Function does not read the wall clock itself; the clock is always passed in | PASS | The only `Date` construction is `new Date(clock)` (`sepDate.ts:32`) — argument supplied. No `Date.now()` and no argument-less `new Date()` anywhere in the file. Clock validation rejects non-finite and invalid values (`sepDate.ts:29–35`). |
| Date component from the business-date argument; time component from the clock argument; all components zero-padded | PASS | `sepDate.ts:36–37`: ``const time = `${pad2(at.getHours())}:${pad2(at.getMinutes())}:${pad2(at.getSeconds())}`; return `${businessDate} ${time}` `` with `pad2` = `String(v).padStart(2,'0')` (`sepDate.ts:14–16`). Business date is verified `yyyy-MM-dd` (already zero-padded) and passed through verbatim. |
| Returns `yyyy-MM-dd HH:mm:ss`; output always matches `^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$` **with seconds**; no `HH:mm`-only output is possible | PASS | The template literal at `sepDate.ts:37` is a fixed 3-component time; there is no code path that emits 2 components. Test `"keeps the seconds component of the contract pattern"` (`sepDate.spec.ts:21–25`) asserts `SEP_DATE_TIME_PATTERN.test(value) === true` and the exact value `'2026-09-28 09:08:07'`. All 19 tests pass. |
| A business-date argument that is not `yyyy-MM-dd` is rejected, not silently repaired | PASS | `sepDate.ts:1` `BUSINESS_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/`; `sepDate.ts:26–28` throws `SepDateContractError` on any non-conforming value — no coercion, no slicing, no fallback. Covered by the 6-case `it.each` rejection table (`sepDate.spec.ts:57–68`) and by `"does not repair a business date that carries a time component"` (`:70–73`). |
| All listed test cases have a test and pass — normal case, `00:00:00`, padded single-digit month/day/hour/minute/second, leap day, business date differing from the clock's own date, malformed business date | PASS | Normal: `sepDate.spec.ts:16–19`. `00:00:00` without flooring: `:27–30`. Padded single digits: `:32–35`. Leap day `2024-02-29`: `:37–40`. Business date ≠ clock date (`2025-12-31` with a 2026 clock; and `2027-06-30` with a 2026 clock): `:42–50`. Malformed business date: `:57–68`, `:70–73`. Additional coverage: determinism (`:52–55`), invalid clock (`:75–81`), error `field` value (`:83–92`). `pnpm --filter kiosk-web test` → `src/lib/__tests__/sepDate.spec.ts (19 tests)` passed; suite total 35 files / 275 tests passed. |
| Time is not normalised or floored to midnight | PASS | No rounding/zeroing logic exists; `getHours/getMinutes/getSeconds` are read directly (`sepDate.ts:36`). `"emits 00:00:00 without normalising or flooring the value"` (`sepDate.spec.ts:27–30`) shows a genuine `00:00:00` clock passes through unchanged, and every other case emits a non-midnight time verbatim (`:24`, `:34`, `:39`, `:44`). |
| The composer is not yet called from the registration flow; wiring is P2-S03 | PASS | Repo-wide grep for `composeSepDate` / `SepDateContractError` finds no consumer outside `sepDate.ts` and its spec. `useKioskRegistration.ts` still passes `sepDate: businessDate.value ?? ''` (`useKioskRegistration.ts:908`) and the file is unmodified in git. P2-S03 remains `Implementation Status: NOT-STARTED`. |
| Nothing under `packages/` was modified by this slice; other `businessDate` consumers untouched | PASS | `git status` shows `packages/**` changes attributable to P1-S01 only. `businessDate` consumers `useKioskRegistration.ts`, `serviceCatalog.ts`, `KioskHeader.vue`, `KioskHome.vue`, `KioskPage.vue` are all unmodified (no `git status` entry). |
| Verification gate passes (`lint` not used) | PASS | `pnpm turbo run typecheck test` → **Tasks: 22 successful, 22 total**. `pnpm --filter kiosk-web test` → 35 files / 275 tests passed, `sepDate.spec.ts` 19 tests passed. |
| TD-008 time source: kiosk host **local** clock | PASS (see RV-note below) | ARCHITECTURE TD-008 line 233 ("Time part — Kiosk host local clock") and line 246 ("The time component is the kiosk host's local time"); §9 Clock discipline (lines 395–405) states the contract carries no time zone and the host/Jetli time-base agreement is a deployment prerequisite, not an application mechanism. `Date.getHours/getMinutes/getSeconds` are the local-time accessors, so the implementation matches the mandated source. No UTC or fixed-offset mandate exists anywhere in TD-008 or §9. |

# Findings

## RV-001

Severity: MINOR

Description: The TD-008 contract pattern is now expressed in two places —
`apps/kiosk-web/src/lib/sepDate.ts:3` (`SEP_DATE_TIME_PATTERN`) and
`packages/shared-types/src/index.ts:622` (added by the parallel P1-S01 execution).
Neither package can import the other under the current workspace boundaries
(`kiosk-web` may not depend on `shared-types`'s internals from `src/lib` in a way
that creates a cycle with the composable layer, and `shared-types` must not depend
on an app), so the duplication cannot be removed within this slice's scope.

Evidence: `git diff packages/shared-types/src/index.ts` —
`sepDate: z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)`, vs
`apps/kiosk-web/src/lib/sepDate.ts:3` — same pattern. A future change to the
contract would have to be applied in both locations; drift is possible.

Required Correction: None for this slice. The plan assigns the shared-schema
constraint to P1-S01 and the composition rule to P1-S02, so the duplication is a
consequence of the approved slice boundary, not an implementation defect. The
Architect should consider whether a follow-up slice (or an Architect note in
ARCHITECTURE TD-009) should designate one location as the single source of the
pattern, or add a conformance test that asserts the two literals agree so that
drift fails the gate. Recorded as a cross-slice concern only; P1-S01 is reviewed
separately and no verdict is rendered on it here.

Status: OPEN (cross-slice concern — non-blocking; escalated to Architect)

## RV-002

Severity: NOTE

Description: `useKioskRegistration.ts:908` currently passes
`sepDate: businessDate.value ?? ''`. Once P2-S03 wires the composer, a null
business date will surface as a thrown `SepDateContractError` (the empty string
fails `BUSINESS_DATE_PATTERN` at `sepDate.ts:26–28`) instead of a silently empty
value. This is the correct TD-009 path — contract violation is a local contract
failure, no request is issued, no value is substituted, nothing is retried — and it
is strictly stronger than the current behaviour, which would already be rejected by
the P1-S01 schema before any HTTP request. The throw is therefore a forward-looking
property of this slice's contract, not a latent defect introduced here.

Evidence: `useKioskRegistration.ts:908` (`sepDate: businessDate.value ?? ''`,
file unmodified by this slice); `sepDate.ts:26–28`; ARCHITECTURE TD-009 lines
262–268.

Required Correction: None for P1-S02. P2-S03 must ensure the thrown
`SepDateContractError` is routed through the P2-S04 contract-failure handling
(no request, no retry, no substitution, logged as a contract failure naming
`sepDate`). Flagged here so the orchestrator carries it into P2-S03/P2-S04.

Status: OPEN (informational — handed forward to P2-S03 / P2-S04)

## RV-003

Severity: MINOR

Description: Plan-level aggregate status fields are stale. The Progress Summary
table (section 4) still reads `| P1 | NOT-STARTED | NOT-REVIEWED | 0/2 |` and the
`## P1` phase heading still reads `Implementation Status: NOT-STARTED` /
`Review Status: NOT-REVIEWED`, while the slice-level entries now show P1-S01
`IMPLEMENTED` and P1-S02 `IMPLEMENTED` + `GO` (after this review). The plan
frontmatter `Status` is corrected to `IN-PROGRESS` by this review.

Evidence: IMPLEMENTATION-PLAN lines 132–133 (table), lines 141–142 (phase heading),
versus lines 152–153 and 232–233 (slice level).

Required Correction: Reconcile the phase-level and Progress Summary aggregate
fields with the authoritative slice-level state. Per reviewer boundaries,
implementation-status fields and plan structure are not modified by Review. This
is aggregate bookkeeping, not a slice acceptance blocker. Same precedent as
P3-S07-REVIEW RV-001. Escalated to the Architect.

Status: OPEN (escalated — not a slice acceptance blocker)

## RV-004

Severity: NOTE

Description: `SEP_DATE_TIME_PATTERN` is exported but is referenced only by
`sepDate.spec.ts:23`. No production caller uses it today; P2-S03 will obtain its
conformance guarantee from the P1-S01 shared schema at the request boundary. The
export is a deliberate, harmless affordance for the caller P2-S03 may want, and
the plan does not forbid it, but it is currently an unused public symbol.

Evidence: `sepDate.ts:3`; repo-wide grep for `SEP_DATE_TIME_PATTERN` returns only
`sepDate.ts:3` and `sepDate.spec.ts:2,23`.

Required Correction: None. Consider narrowing the export to module-local if the
final plan state leaves it unconsumed, to keep the `lib` surface minimal.

Status: OPEN (informational)

## RV-005

Severity: NOTE

Description: The working tree contains one modification outside every slice of this
plan: `apps/kiosk-web/public/global_config.json` changes `jetliApiBase` from
`http://dev.smart-ics.com:8089/JetliAPi/api` to
`http://dev.smart-ics.com:8888/JknTrustedLink/api`. It is not part of P1-S02's
change set, but it is a runtime deployment configuration change sitting uncommitted
in the same tree, which could be mistaken for slice output. Recorded for
orchestrator awareness; no verdict is rendered on it here.

Evidence: `git diff apps/kiosk-web/public/global_config.json` (1 line changed).

Required Correction: None for this slice. The orchestrator should confirm the
change is intentional and track it outside this plan.

Status: OPEN (informational)

# Current Decision

**GO.**

The slice objective — a single, testable, pure implementation of the TD-008
composition rule, independent of the schema and of the registration flow — is
satisfied. The composer is genuinely pure (no imports, no ambient clock read),
takes the HIS business date and an injected clock timestamp, returns a
`yyyy-MM-dd HH:mm:ss` value with the seconds component that the Jetli receiver
requires, rejects a non-`yyyy-MM-dd` business date as a contract failure without
repair, and does not floor or normalise the time. All required test cases exist and
pass. The composer is not yet wired into the registration flow, and no `packages/`
file or other `businessDate` consumer was touched by this slice.

Time-zone question, resolved independently: ARCHITECTURE TD-008 line 233 and line
246 mandate the **kiosk host local** clock, and §9 Clock discipline states the
contract carries no time zone and that host/Jetli time-base agreement is a
deployment prerequisite rather than an application mechanism. Local-time accessors
are therefore the mandated source, not a deviation — no MAJOR finding. I also
verified the test suite is genuinely time-zone-robust rather than merely appearing
so, by re-running `sepDate.spec.ts` under five host time zones including a
UTC+14 zone and a half-hour-offset zone: **19/19 passed in every zone** (UTC,
Pacific/Kiritimati, America/Los_Angeles, Asia/Jakarta, Australia/Lord_Howe). The
tests build expected clocks with the local `Date` constructor and read local
accessors, so the round-trip holds under any host offset.

Findings: 5 total — 0 BLOCKER, 0 MAJOR, 2 MINOR (both aggregate-bookkeeping /
cross-slice duplication, both non-blocking and escalated), 3 NOTE.

Plan-level `Status` set to `IN-PROGRESS`, **not** COMPLETED: P1-S01, P2-S03 and
P2-S04 are not all `IMPLEMENTED` + `GO`, so the COMPLETED condition is not
satisfied and testing remains unauthorised.

# Re-Review History

## Iteration 0 (initial review)

Decision: GO

Summary: Independent review of the actual code, not the implementer's report.
Change set confirmed to be exactly two new files; the registration composable and
all other `businessDate` consumers are unmodified, and the composer has no
production caller yet as required (wiring is P2-S03). `sepDate.ts` has zero
imports and never reads the wall clock. The date component comes from the
business-date argument, the time component from the injected clock, all components
zero-padded, and the seconds component is structurally always present — no
`HH:mm`-only output path exists. A malformed business date throws
`SepDateContractError` (with `field: 'sepDate'`) and is never repaired. 19 unit
tests cover every case the plan lists, plus determinism, invalid-clock, and
error-field coverage. `pnpm --filter kiosk-web test` (35 files / 275 tests, of
which `sepDate.spec.ts` = 19) and the gate `pnpm turbo run typecheck test`
(22/22 tasks successful) both pass; `lint` was not used as a gate. Local-time
composition was confirmed as architecturally mandated (TD-008) and the test suite
was empirically confirmed time-zone-robust across five zones. Two MINOR findings
(RV-001 cross-slice pattern duplication, RV-003 stale aggregate plan bookkeeping)
and three NOTEs (RV-002 forward-looking null business-date contract failure for
P2-S03/P2-S04, RV-004 unused export, RV-005 unrelated working-tree config
change). No BLOCKER or MAJOR finding; no remediation cycle required.
