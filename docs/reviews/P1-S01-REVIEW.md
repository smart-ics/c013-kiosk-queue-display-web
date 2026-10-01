---

Code: KIOSK-SEP-SKDP
Artifact: REVIEW
Slice: P1-S01
ReviewIteration: 0
Decision: GO
---

# Scope Reviewed

Slice P1-S01 — "Constrain `sepDate` in the shared `POST /sep` request contract"
(IMPLEMENTATION-PLAN `c013-kiosk-queue-display-web/docs/plans/KIOSK-SEP-SKDP-DEF-001-IMPLEMENTATION-PLAN.md`,
section 5, lines 148–226).

Repository: `c013-kiosk-queue-display-web`.

Depends On: None. Dependency satisfaction is trivially satisfied.

Authorities applied:

- IMPLEMENTATION-PLAN v1.0 (DEF-001 replacement), slice "Required implementation output"
  and "Completion Criteria".
- ARCHITECTURE v1.1 — TD-008 (SEP date-time composition), TD-009 (SEP request contract
  validated at the shared client boundary), TD-010 (request-direction contract
  conformance is verifiable), §5 Component Responsibilities ("Shared `POST /sep`
  request contract"), §6 API interactions row for `POST Sep`, §9 Contract validation
  observability.
- BUG-INVESTIGATION v1.0 — supplies the defect evidence and OQ-BI-04 scope exclusion.
- `c013-kiosk-queue-display-web/AGENTS.md` — verification gate
  `pnpm turbo run typecheck test`; `lint` explicitly not a gate.

Verified change set actually present in the working tree (`git status --porcelain`):

```
 M packages/api-client/src/__tests__/his.spec.ts
 M packages/shared-types/src/__tests__/hisSchemas.spec.ts
 M packages/shared-types/src/index.ts
```

(`apps/kiosk-web/src/lib/sepDate.ts` and its spec are untracked additions produced by
the parallel P1-S02 execution; `docs/architecture/…` is the Architect's v1.1 update;
`apps/kiosk-web/public/global_config.json` is an unattributed working-tree change —
see RV-004. None of these are P1-S01 output.)

Not re-implemented. All conclusions below are drawn from reading the code and running
the gates myself.

# Completion Criteria Verification

| Criterion | Result | Evidence |
|---|---|---|
| `sepCreateBodySchema` rejects a date-only, minutes-only, ISO-`T`, empty, and absent `sepDate` | PASS | `packages/shared-types/src/index.ts:623` declares `sepDate: z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)` with no `.optional()`. Rejection proven by `hisSchemas.spec.ts:217` (date-only `'2026-08-03'`), `:223` (minutes-only `'2026-08-03 09:15'`), `:229` (ISO-`T` `'2026-08-03T09:15:42'`), `:235` (empty `''`), `:239` (field absent). All pass. |
| `sepCreateBodySchema` accepts a conforming `yyyy-MM-dd HH:mm:ss` value | PASS | `hisSchemas.spec.ts:208` `'accepts a SEP-create sepDate in yyyy-MM-dd HH:mm:ss'` parses `'2026-08-03 09:15:42'` and asserts round-trip `expect(parsed.sepDate).toBe('2026-08-03 09:15:42')` (line 214). Passes. |
| Seconds component is present; no `HH:mm`-only pattern slipped in | PASS | The only declared pattern is at `packages/shared-types/src/index.ts:623` and carries `\d{2}:\d{2}:\d{2}`. `git grep -nE "d\{2\}:\\d\{2\}" -- packages apps` filtered to exclude the seconds-bearing form returns zero matches. The sole other declaration, `apps/kiosk-web/src/lib/sepDate.ts:3` `SEP_DATE_TIME_PATTERN`, is also seconds-bearing (P1-S02 output, not this slice). |
| `hisSchemas.spec.ts` and `his.spec.ts` contain explicit tests for each of those cases and pass | PASS | Six explicit `it(...)` blocks in `hisSchemas.spec.ts` at lines 208, 217, 223, 229, 235, 239. `pnpm --filter @aq/shared-types test` → 2 files / 25 tests passed, `hisSchemas.spec.ts` 21 tests. `pnpm --filter @aq/api-client test` → 4 files / 31 tests passed, `his.spec.ts` 15 tests. |
| No response schema is modified | PASS | `git diff -- packages/shared-types/src/index.ts` contains exactly one hunk, at lines 619–623, inside `sepCreateBodySchema` (lines 618–644). No response schema (`responseCreateSepSchema` line 655, `responseSepByNoPesertaSchema`, `responseUploadSepSchema`) is touched. |
| No response fixture is modified | PASS | `git diff` of the two spec files touches only `hisSchemas.spec.ts:187-244` and `his.spec.ts:349-368`. The `sepItem` response fixtures are outside both hunks: `hisSchemas.spec.ts:19-28` and `his.spec.ts:289-298`, both still carrying the response-side `sepDate: '2026-08-06'`, byte-identical to HEAD. |
| `.passthrough()` and every other field of `sepCreateBodySchema` are unchanged (OQ-BI-04 out of scope) | PASS | `git diff` of `index.ts` shows the sole changed line is the `sepDate` declaration; the surrounding 21 sibling fields (`sepId`, `noPeserta`, `noRujukan` … `userId`, lines 620–642) and the `.passthrough()` call (line 644) are untouched. No new validation was introduced on any other request field, per the plan's OQ-BI-04 exclusion. |
| The pre-existing `sepCreateBodySchema.parse` test that used a date-only `sepDate` is updated to a conforming value, other assertions preserved | PASS | `hisSchemas.spec.ts:190` changed from `sepDate: '2026-08-03'` to `'2026-08-03 09:15:00'`. The surrounding assertions (`parsed.noPeserta`, `parsed.noRujukan` at lines 205–206) are preserved unchanged per the diff. |
| The `createSep` api-client test with no `sepDate` is updated to assert rejection, and no fetch is expected to be issued | PASS | New test `his.spec.ts:352` `'rejects a SEP create without a conforming sepDate and issues no request'` asserts `expect(() => api.createSep({ noPeserta, userId })).toThrow()` (line 354) and `expect(fetchImpl).not.toHaveBeenCalled()` (line 355). The no-request property is structurally guaranteed: `packages/api-client/src/his.ts:341-342` runs `sepCreateBodySchema.parse(body)` before `client.postJson(...)`. |
| Repository verification gate passes | PASS | `pnpm turbo run typecheck test --force` from `c013-kiosk-queue-display-web` → **22 successful, 22 total**; `kiosk-web` 35 test files / 275 tests passed. `lint` was not used as a gate. |

## Plan obligations explicitly checked

1. **Seconds component required** — satisfied; see criterion row 3. The plan Notes
   warn against substituting `yyyy-MM-dd HH:mm`; the implemented pattern matches
   ARCHITECTURE TD-008 verbatim and is identical to the P1-S02 composer pattern.
2. **`.passthrough()` and all other fields unchanged** — satisfied; see criterion row 7.
   OQ-BI-04 was not silently pulled into scope.
3. **No response schema / fixture modified** — proven by `git diff`, criterion rows 5–6.
   This plan-explicit prohibition is respected.
4. **Explicit tests for each rejection case plus acceptance** — satisfied; criterion row 4.
5. **`createSep` test asserts rejection *and* no fetch** — satisfied; criterion row 9.
6. **Non-`POST /sep` request-side code not touched, and the downstream slices not
   prematurely implemented** — satisfied. `git status` shows no modification to
   `apps/kiosk-web/src/composables/useKioskRegistration.ts`; `buildSepPayloadPolicy`
   still passes `sepDate: businessDate.value ?? ''` at line 908, i.e. the P2-S03
   composition wiring is correctly *not* implemented. No contract-failure code path and
   no contract-rejection logging were added, so the P2-S04 scope is intact and undamaged.
   Consequence recorded as RV-002.
7. **`businessDate` semantics and its other consumers untouched** — satisfied.
   `git status` shows no modification to any visit-date, scheduling, age-formatting, or
   `businessDateSchema` file; no `businessDate` / `getBusinessDate` reference appears in
   the `git diff` for any changed file. The date-only business date is unchanged
   everywhere, as ARCHITECTURE TD-008 requires.

# Findings

## RV-001

Severity: MINOR

Description: Plan-level aggregate bookkeeping in the Progress Summary table and the P1
phase heading is stale relative to the actual slice state. The table still reads
`P1 | NOT-STARTED | NOT-REVIEWED | 0/2` while P1-S01 is IMPLEMENTED and (after this
review) GO and P1-S02 is IMPLEMENTED. The P1 phase heading still reads
`Implementation Status: NOT-STARTED` / `Review Status: NOT-REVIEWED`.

Evidence: `KIOSK-SEP-SKDP-DEF-001-IMPLEMENTATION-PLAN.md` lines 130–133 (Progress
Summary table) and lines 141–142 (P1 phase heading) versus the slice-level statuses at
lines 152–153 and 232–233. The Implementer correctly declined to write these fields;
phase aggregate implementation status is not owned by the Implementer or the Reviewer.

Required Correction: Reconcile the Progress Summary table and the P1 phase heading
aggregate rows with the authoritative slice-level statuses once the phase's slices have
all been reviewed. This is aggregate bookkeeping only. Escalated to the Architect.
Precedent: `docs/reviews/P3-S07-REVIEW.md` RV-001.

Status: OPEN (escalated — not a slice acceptance blocker)

## RV-002

Severity: NOTE

Description: `createSep` raises the `sepDate` contract failure **synchronously** as a
`ZodError` rather than returning a rejected promise, because `packages/api-client/src/his.ts:341`
evaluates `sepCreateBodySchema.parse(body)` before the returned promise is constructed
and the method is not declared `async`. The Implementer reported this and it is verified
correct.

This is **not** a defect of this slice and requires no correction. It is the pre-existing
convention of the API client — `uploadSep` at `his.ts:345-348` has the identical
shape — and ARCHITECTURE TD-009 specifies only the observable outcome ("rejected by the
client contract before any request is issued"), which is satisfied. At the current sole
production call site, `await deps.createSep(sepPayload)` at
`apps/kiosk-web/src/composables/useKioskRegistration.ts:917` is inside a `try` block in
an async function, so a synchronous throw is caught identically to a rejection.

The observation is recorded for the P2-S04 implementer, who must handle this path: a
`.catch()` chained onto the `createSep` call, or a `catch` that is scoped outside the
`await`, will not observe a contract failure. The `try`/`catch` must enclose the call
expression itself.

Evidence: `packages/api-client/src/his.ts:340-343`; test form at
`packages/api-client/src/__tests__/his.spec.ts:354` uses `expect(() => …).toThrow()`
rather than `await expect(…).rejects`, which is the correct assertion for this behaviour.
Related interim-state observation: until P2-S03 lands, the flow at
`useKioskRegistration.ts:908` still passes a date-only `sepDate`, so the live SEP-create
call now fails the contract. This is the expected and planned intermediate state of the
slice sequence (P2-S03 is the slice that wires the composer) and is not a finding
against P1-S01; it does mean the kiosk SEP path is non-functional on the current working
tree until P2-S03 and P2-S04 are implemented and reviewed.

Status: OPEN (informational — no correction required for P1-S01 acceptance)

## RV-003

Severity: NOTE

Description: The `yyyy-MM-dd HH:mm:ss` contract pattern is now declared in two places —
`packages/shared-types/src/index.ts:623` (P1-S01) and `apps/kiosk-web/src/lib/sepDate.ts:3`
as `SEP_DATE_TIME_PATTERN` (P1-S02). Neither file imports the other.

Assessed as an acceptable, non-blocking duplication for this slice, on the following
grounds. The dependency direction is one-way: `apps/kiosk-web/package.json` declares
`@aq/shared-types: workspace:*`, while `packages/shared-types/package.json` has no
workspace dependencies at all. `apps/kiosk-web` *can* import from `@aq/shared-types`, so
P1-S02 could have imported a single exported constant; `@aq/shared-types` cannot import
from the app, and must therefore declare the pattern itself. The duplication is a
consequence of the monorepo boundary, not a defect in P1-S01's implementation, and
P1-S01's plan text explicitly specifies the schema declaring the constraint inline.

Risk: the two declarations can drift, and a drift would make P2-S03's composed value fail
P1-S01's schema with a runtime `ZodError` rather than at build time. Both currently match
exactly. No verdict is rendered here on P1-S02, which is under separate review. Suggested
follow-up for the Architect: either export the pattern from `@aq/shared-types` and have
P2-S03 / the composer consume it, or record the duplication as accepted in ARCHITECTURE
so a future reader does not treat it as an oversight.

Status: OPEN (cross-slice concern — recorded for the Architect and the P2-S03
implementer; not a P1-S01 acceptance blocker)

## RV-004

Severity: MINOR

Description: The working tree contains a modification to
`apps/kiosk-web/public/global_config.json` that is not part of P1-S01's declared
Changed Files and is not attributable to any slice in this plan. It redirects the kiosk
runtime's Jetli base URL from `:8089/JetliAPi/api` to `:8888/JknTrustedLink/api`.

Evidence: `git diff -- apps/kiosk-web/public/global_config.json` — one line changed, the
`jetliApiBase` value. The P1-S01 slice "Changed Files" list is limited to
`packages/shared-types/src/index.ts`, `packages/shared-types/src/__tests__/hisSchemas.spec.ts`,
and `packages/api-client/src/__tests__/his.spec.ts`.

The change is uncommitted, so no per-slice attribution is recoverable from git. It is
reported because it alters the kiosk's runtime service target and would ship with any
commit made from this working tree. It does not affect any P1-S01 completion criterion
and is not a blocker for this slice.

Required Correction: Confirm the provenance and intended disposition of this change
before it is committed with P1-S01 work. If it is a local dev-environment
accommodation for reproducing DEF-001, it should be reverted or kept out of the P1-S01
commit; if it is an intended infrastructure correction, it should be raised as its own
change with its own justification. This is a repository-hygiene question for the
Developer, not a slice acceptance item.

Status: OPEN (raised to the ica-developer orchestrator)

# Current Decision

**GO.**

Slice objective satisfied: the `sepDate` format constraint of ARCHITECTURE TD-008 is now
declared in the shared `POST /sep` request contract per TD-009, and the format is covered
by request-direction conformance tests per TD-010, replacing the v1.0 state in which both
schema and tests encoded an unconstrained string.

All four Completion Criteria verified PASS with concrete file/line evidence. All seven
explicit plan obligations verified, including the three plan-explicit prohibitions
(no response schema change, no response fixture change, no widening of validation to
other request fields). Both named per-package test commands pass, and the repository
verification gate `pnpm turbo run typecheck test --force` passes 22/22 tasks with
kiosk-web at 35 files / 275 tests. `lint` was not used as a gate.

No BLOCKER and no MAJOR findings. RV-001 and RV-004 are MINOR and non-blocking
aggregate/hygiene items; RV-002 and RV-003 are NOTEs, one forward-looking for P2-S04 and
one a cross-slice duplication concern for the Architect.

**Deviation assessment (the two points flagged by the Implementer):**

- *Deviation 1 — the added sibling `createSep` test.* Judged **legitimate scope
  discipline, not creep.** The plan required the no-`sepDate` test to become a rejection
  test. Had the Implementer stopped there, the pre-existing "tolerates a plain-string
  business error" coverage of `responseCreateSepUnionSchema` would have been destroyed
  and the repository verification gate would have lost a JSend response-direction
  assertion. The added test is confined to `packages/api-client/src/__tests__/his.spec.ts`,
  changes no production code, and adds a conforming `sepDate` — the minimum edit
  consistent with the mandated contract change. Recording it here for transparency, not
  as a finding.
- *Deviation 2 — synchronous `ZodError`.* Verified true against the source and judged
  **consistent with ARCHITECTURE TD-009 and with the API client's pre-existing
  convention** (`uploadSep` is structurally identical). Not a defect. Recorded as RV-002
  for the P2-S04 implementer, who must wrap the call expression in `try`/`catch` rather
  than chaining `.catch()`.

Plan-level `Status` in the frontmatter was set to **IN-PROGRESS** by this review
(was `NOT-STARTED`). It is **not** COMPLETED: P1-S02, P2-S03, and P2-S04 are not all
IMPLEMENTED-and-GO, and testing must not begin until the plan is COMPLETED. `Execution
Approval` was not modified. No slice structure was split, merged, reordered, added, or
reinterpreted, and no `Implementation Status` was written by this review.

No STRUCTURAL plan defect was identified; no Architect escalation is required beyond the
aggregate-bookkeeping and duplication items recorded above.

# Re-Review History

## Iteration 0 (initial review)

Decision: GO

ReviewIteration: 0

Summary: Slice objective met. `sepCreateBodySchema.sepDate` is required and constrained to
`^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$` with the seconds component, all five rejection
cases plus acceptance have explicit named tests, and the `createSep` client test asserts
both rejection and that `fetch` is never called. Verified by `git diff` that no response
schema, no `sepItem` response fixture, no other `sepCreateBodySchema` field, and no
`.passthrough()` behaviour was altered, and that the out-of-scope P1-S02/P2-S03/P2-S04
work was not prematurely implemented nor damaged. Gate `pnpm turbo run typecheck test`
passes 22/22. Findings: 2 MINOR (stale plan aggregate bookkeeping RV-001; unattributed
`global_config.json` change RV-004) and 2 NOTE (synchronous `ZodError` semantics handed to
P2-S04 RV-002; cross-slice contract-pattern duplication RV-003). No BLOCKER, no MAJOR.
Plan Status set to IN-PROGRESS, not COMPLETED.
