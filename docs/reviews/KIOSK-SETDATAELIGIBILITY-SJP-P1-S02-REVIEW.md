---
Code: KIOSK-SETDATAELIGIBILITY-SJP
Artifact: REVIEW
Slice: P1-S02
ReviewIteration: 0
Decision: GO
---

# Scope

Independent review of slice **P1-S02** — "Guard invalid upload identity to admisi fallback with parity coverage" —
of `docs/plans/KIOSK-SETDATAELIGIBILITY-SJP-IMPLEMENTATION-PLAN.md` (Execution Approval APPROVED), against
`docs/architecture/KIOSK-SETDATAELIGIBILITY-SJP-ARCHITECTURE.md` v1.0 (TD-SJP-01 non-regression, TD-SJP-02,
TD-SJP-03, §9 Cross-Cutting, §10 Implementation Constraints, §11 Acceptance Conditions).

Note: `docs/reviews/P1-S02-REVIEW.md` belongs to the older completed `KIOSK-SEP-SKDP-DEF-001` plan. It was
neither read nor modified as this slice's review record. `docs/reviews/P1-S01-REVIEW.md` (same, older plan) was
likewise untouched. `docs/reviews/KIOSK-SETDATAELIGIBILITY-SJP-P1-S01-REVIEW.md` was read for context only.

# Verification Performed

## TD-SJP-02 — guard definition

`apps/kiosk-web/src/lib/uploadIdentity.ts` L19–23:

```ts
export function isValidUploadSepNo(value: unknown): boolean {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  return trimmed.length > 0 && trimmed !== UPLOAD_IDENTITY_PLACEHOLDER
}
```

Logically identical to the architecture predicate
`typeof v === 'string' && v.trim().length > 0 && v.trim() !== '-'` (written with an early return, same
semantics). `UPLOAD_IDENTITY_PLACEHOLDER = '-'` (L9). Non-string, `undefined`, `null`, and object inputs are
rejected by construction, so the union-typed call site is safe. The signature takes `unknown`, which widens
acceptably against `ResponseUploadSep` (`z.union([responseUploadSepSchema, z.string()])`,
`packages/shared-types/src/index.ts` L666–675) — at the call site the union is already narrowed by the
`typeof res === 'string'` throw inside the upload attempt closure, and `vue-tsc` confirms (see gate below).

## Guard placement — prevents eligibility call, session `sepNo` assignment, and create-value reads

`apps/kiosk-web/src/composables/useKioskRegistration.ts` `register()`:

- L942–953: `const uploadRes: ResponseUploadSep = await withAttemptLimit(...)` — the upload attempt block,
  budget `MAX_POST_REGISTRATION_ATTEMPTS = 3` (L256). Unchanged by this slice.
- L954: `postRegistrationPhase.value = 'SEP_UPLOADED'`.
- L960–963: `if (!isValidUploadSepNo(uploadRes.sepNo)) { reportInvalidUploadIdentity(result.regId); throw new Error('Identitas SEP hasil upload tidak valid.') }`.
- L964: `sepNo.value = uploadRes.sepNo` — **after** the guard.
- L966–977: `withAttemptLimit(() => deps.setDataEligibility({ regId, sjpNo: uploadRes.sepNo, pesertaJaminanId: noPeserta, sjpId: uploadRes.sepId }), 3, ...)` — **after** the guard.

Every invalid case, including whitespace-padded `"  -  "` (trimmed to `-`, rejected), reaches the throw
before the session assignment and before the eligibility call. `printContext` `noSep` is read from
`sepNo.value` at L1113, so an invalid identity can never reach print context either; the invalid tests assert
`printRegistration` is not called at all (the fallback path prints only the admisi notice).

Whole-file `sepRes.*` / `sepNo.value` audit: `sepRes` appears only at L914 (declaration), L929 (assignment),
L934–935 (string-union create business error), and L944 as the `Sep/upload` request key `sepId` — the single
role TD-SJP-01 permits. `sepNo.value` appears only at L363 (`goHome` reset), L964 (post-guard assignment),
L1113 (print context read). **No path can send or print a create-sourced `sepNo`/`sjpId`.**

## TD-SJP-02 — guard is outside the upload attempt budget

The guard (L960) is a sibling statement after the `withAttemptLimit` call (L942–953), not inside the closure.
An invalid identity therefore consumes **zero** upload attempts and emits no
`[kiosk] SEP upload gagal (percobaan n/3)` line. Observable proof in the tests:
`uploadSep` is called exactly once for every invalid-identity case (spec L2732), whereas the string
business-error case still calls it three times (spec L2779) — the string throw remains inside the closure
(`if (typeof res === 'string') throw new Error(...)`, L946–947), preserving the TD-006/TD-007 retry
semantics exactly as TD-SJP-02 requires. Retry budgets are otherwise untouched: create one-time (no retry
wrapper, L928–929), upload 3, eligibility 3 — no new budget, no second registration, no second SEP.

## TD-SJP-03 — recovery unchanged

The guard throw propagates to the existing `catch` (L987–993), which calls `enterAdmisiFallback()` whenever
`registrationResult.value` is set. `enterAdmisiFallback()` (L337–346) is unmodified: phase
`'ADMISI_FALLBACK'`, `regId` from `registrationResult.value`, existing message
`Pendaftaran berhasil (${regId}), namun pemrosesan SEP belum selesai…`. No new fallback function, no new
state, no new retry, no per-mode branching — booking and walk-in both execute this same `register()` body.

## Shared contract and out-of-scope files unchanged

- `packages/shared-types/src/index.ts` — `payloadSetDataEligibilitySchema` L403–408 is
  `{ regId, sjpNo: z.string().min(1), pesertaJaminanId, sjpId }`, unchanged. `git diff` on that file shows a
  single hunk at L619–625 (`sepDate` optional → regex), mtime 28/09 13:32 — belonging to the earlier
  KIOSK-SEP-SKDP plan, not this slice. Placeholder rejection indeed lives at the orchestration boundary.
- `responseUploadSepSchema` / `responseUploadSepUnionSchema` (L666–675) unchanged.
- `apps/kiosk-web/src/lib/sepContract.ts` (28/09 13:54), `lib/sepDate.ts` (28/09 13:32) unchanged; both
  still untracked/new from the earlier plan, untouched here.
- No `b09-bilreg-api` or `b12` source change: a recursive mtime sweep over `b09-bilreg-api` for the last day
  returns nothing.
- Source mtime sweep of `c013` for the slice window shows exactly four touched files, matching the declared
  scope: `lib/uploadIdentity.ts` (new), `lib/__tests__/uploadIdentity.spec.ts` (new),
  `composables/useKioskRegistration.ts`, `composables/__tests__/useKioskRegistration.spec.ts`. Every other
  dirty file in `git status` (`global_config.json`, `his.spec.ts`, `hisSchemas.spec.ts`,
  `KIOSK-SEP-SKDP-ARCHITECTURE.md`, docs) has a 28/09 mtime and predates this slice.

## §9 Cross-Cutting — logging

`reportInvalidUploadIdentity(regId)` (uploadIdentity.ts L30–35) emits exactly:

```
[kiosk] upload identity invalid: missing/placeholder regId=<regId> rejected before Reg/setDataEligibility; no SEP identity was sent
```

- Distinguishable from service error text: the prefix `[kiosk] upload identity invalid: missing/placeholder`
  cannot be confused with the retry line `[kiosk] <label> gagal (percobaan n/3)` (L272) nor with any
  server-supplied business-error text. The spec asserts zero guard log lines on the string business-error
  path (L2784), which is the executable form of that distinction.
- Correlation-safe: carries `regId` only.
- Leaks nothing: no rejected value, no `noPeserta`, no `namaPeserta`, no body, no credential. Two tests
  cover this: the unit test asserts the line starts with the constant and contains `regId=R1`
  (uploadIdentity.spec L48–52), and the orchestration test asserts the line does **not** contain the create
  number `0112CREATE` that a substitution bug would have leaked (spec L2742). Architecture §9 satisfied.

## Test coverage vs. the five required cases

`useKioskRegistration.spec.ts` "P1-S02 invalid upload identity guard" (L2669–2861), all observed passing:

| Required | Test | Assertions beyond "it threw" |
|---|---|---|
| (a) `"-"` → no eligibility + fallback | L2715 placeholder case | `setDataEligibility` not called; `uploadSep` ×1; `printRegistration` not called; `flow === 'FAILURE'`; `postRegistrationPhase === 'ADMISI_FALLBACK'`; `regId 'R1'` preserved; message contains `Pendaftaran berhasil (R1)`; exactly one guard log line, not containing `0112CREATE` |
| (b) missing/blank → no eligibility + fallback | L2715 blank / empty / missing cases (plus padded `"  -  "`) | same assertion set; the `missing` case supplies an object with no `sepNo` at all, cast through `unknown` |
| (c) string business-error → no eligibility + fallback | L2771 | `uploadSep` ×3 (budget intact), no eligibility, `ADMISI_FALLBACK`, `regId 'R1'`, **zero** guard log lines |
| (d) walk-in parity, placeholder | L2788 | `registerWalkin` ×1, `createSep` ×1, `uploadSep` ×1, no eligibility, `ADMISI_FALLBACK`, `regId 'R2'`, one guard line with `regId=R2` |
| (e) success-path print context carries upload `sepNo` | L2813 | eligibility body asserted exactly (`sjpNo: '0112UPLOAD'`, `sjpId: 'sep-upload'`, create had returned `0112CREATE`), `ELIGIBILITY_RECORDED`, `REGISTRATION_SUCCESS`, `printRegistration` receives `noSep: '0112UPLOAD'` |

Plus: L2747 asserts the existing configured fallback intake actually works from this state
(`confirmAssistance('ADMISI')` → `bookingAssistance` with `servicePointId: 'ADMISI'`, `printQueueTicket`
with `ADMISI_FALLBACK_NOTICE_TEXT` and `regId: 'R1'`), and L2848 asserts a whitespace-padded **valid**
number is still accepted (guards against an over-eager trim-rejection).

`uploadIdentity.spec.ts` — 7 unit tests: real number, padded real number, `"-"`, `"  -  "`, `""`, `"   "`,
and `undefined`/`null`/number/object. Passing.

## No pre-existing expectation weakened

`git diff -U0` on the spec file shows only 11 removed lines, all attributable to the earlier plans, not to
P1-S02: one import statement reflow, two `new Promise<...>` generic annotations, and six
`sepDate: '2026-08-03'` → composed-date fixture values (the earlier sepDate contract work). No `expect(...)`
line, assertion, or fixture count was removed or relaxed by this slice. Pre-existing retry tests (L2528–2535,
three eligibility attempts carrying the same body; L2554–2563) remain intact and pass.

## Gate — re-run independently

Canonical gate from `c013-kiosk-queue-display-web` (`lint` is a repo noop and was not used):

1. `pnpm turbo run typecheck test` → **22/22 successful but FULL TURBO (all cached)** — not accepted as
   evidence on its own.
2. `pnpm turbo run typecheck test --force` (whole repo at once) → `Tasks: 16 successful, 22 total; Failed:
   kiosk-web#typecheck`, with `FATAL ERROR: Zone Allocation failed - process out of memory` and exit code
   134 from the `vue-tsc` worker. No failing assertion was reported by any task; the six `@aq/*` packages and
   `config-web` test tasks all passed in the same run. Same environmental signature as recorded for P1-S01
   (RV-002 there): forced concurrent workers exhaust memory on this machine.
3. Per-package `--force --concurrency=1`:

| Package | Result |
|---|---|
| `@aq/shared-types` | 2/2 tasks, 2 files / 25 tests passed |
| `@aq/api-client` | 4/4 tasks, 4 files / 33 tests passed |
| `@aq/app-config` | 1/1 task, 1 file / 10 tests passed |
| `@aq/device-config` | 3/3 tasks, 3 files / 17 tests passed |
| `@aq/auth` | 2/2 tasks, 2 files / 12 tests passed |
| `@aq/signalr-client` | 2/2 tasks, 1 file / 3 tests passed |
| `kiosk-web` | **6/6 tasks, 37 files / 306 tests passed** (includes `vue-tsc` typecheck) |
| `display-web` | 7/7 tasks, 9 files / 56 tests passed |
| `config-web` | 5/5 tasks, 4 files / 12 tests passed |

4. Targeted verbose re-run of the two slice files — all 7 `uploadIdentity.spec.ts` tests and all 10
   `P1-S02 invalid upload identity guard` tests pass individually (10/10, no skips, no `.only`).

The implementer's reported gate result (22/22 tasks; kiosk-web 37 files / 306 tests) is corroborated.

# Findings

## RV-001

Severity: NOTE

Description: The guard validates `uploadRes.sepNo` but forwards the **untrimmed** value to both the session
`sepNo` and the eligibility body. A padded valid number such as `" 0112R "` is accepted by
`isValidUploadSepNo` and then sent verbatim as `sjpNo`, and printed verbatim as `noSep`.

Evidence: `useKioskRegistration.ts` L964 `sepNo.value = uploadRes.sepNo`, L970 `sjpNo: uploadRes.sepNo`
(trimmed only inside the predicate); `uploadIdentity.spec.ts` L13–15 accepts a padded number; orchestration
spec L2848–2860 asserts the padded number reaches eligibility. The shared contract
`sjpNo: z.string().min(1)` (L405) accepts it, and Bilreg owns trimming semantics.

Assessment: ARCHITECTURE TD-SJP-01 specifies `sjpNo = upload.sepNo` — the upload value as received. The
architecture mandates no normalization, and inventing a canonicalization would be a contract decision
(Bilreg-side) that this slice must not make. Acceptance criteria are met as written; this is an
observation for the Architect/Bilreg owners, not a correction for this slice.

Required Correction: None for this slice. Recorded for future planning if padded `sepNo` is ever observed
from Jetli.

Status: CLOSED (no code defect)

---

## RV-002

Severity: NOTE

Description: `pnpm turbo run typecheck test --force` across the whole repo aborts on this machine with
`Zone Allocation failed - process out of memory` (exit 134) in the `kiosk-web#typecheck` `vue-tsc` worker.
Re-running per package with `--concurrency=1` makes every workspace green.

Evidence: Whole-repo `--force` run reported `Tasks: 16 successful, 22 total; Failed: kiosk-web#typecheck`
with zero failing test assertions; the per-package forced sweep (table above) passed 32/32 tasks including
the 306-test kiosk-web suite and its `vue-tsc` typecheck. Identical to P1-S01 RV-002.

Required Correction: None for this slice. The per-package `--force --concurrency=1` invocation is the local
recipe for a non-cached gate on this machine.

Status: CLOSED (environmental, not a slice defect)

---

## RV-003

Severity: NOTE

Description: The working tree carries unrelated uncommitted changes (`apps/kiosk-web/public/global_config.json`
Jetli base URL, `packages/api-client/src/__tests__/his.spec.ts`,
`packages/shared-types/src/__tests__/hisSchemas.spec.ts`, the `sepDate` regex in
`packages/shared-types/src/index.ts`, and documentation files). None is attributable to P1-S02, but the
uncommitted `jetliApiBase` redirect to a JKN Trusted Link host is a runtime-configuration change with no
review gate in this plan.

Evidence: mtimes of 28/09 11:04–13:54, all predating the P1-S02 window (14:09–14:12); `git diff` for
`global_config.json` is a one-line `jetliApiBase` change.

Required Correction: None for this slice. Flagged so the Architect knows the kiosk runtime config is
diverged from HEAD for reasons unrelated to `KIOSK-SETDATAELIGIBILITY-SJP`.

Status: CLOSED (pre-existing, out of slice scope)

# Current Decision

GO

All four P1-S02 completion criteria are satisfied:

1. `isValidUploadSepNo` is implemented exactly as TD-SJP-02 specifies and is applied to the captured upload
   `sepNo` before `setDataEligibility`; invalid identity throws with no eligibility call and no create-value
   read (`uploadIdentity.ts` L19–23; `useKioskRegistration.ts` L960–964). ✓
2. Observable fallback is proven, not asserted by proxy: `postRegistrationPhase === 'ADMISI_FALLBACK'`,
   preserved `regId`, the existing `Pendaftaran berhasil (regId)…` message, and the existing configured
   `ADMISI` intake path all verified (spec L2715–2811). ✓
3. All five required test cases (a)–(e) present and passing, plus padded-placeholder, padded-valid,
   configured-intake, and non-string coverage. ✓
4. `pnpm turbo run typecheck test` passes (per-package `--force --concurrency=1`: 32/32 tasks, kiosk-web 37
   files / 306 tests); `payloadSetDataEligibilitySchema` and all cross-repo sources verifiably unchanged. ✓

TD-SJP-01 does not regress (session `sepNo` still upload-sourced and now additionally guard-gated); TD-SJP-03
recovery semantics are unchanged; §9 logging constraint is satisfied and covered by a negative assertion.
No BLOCKER or MAJOR findings — three NOTE findings, none requiring correction.

# Testing Gate

This GO applies to **P1-S02 only** and does not itself authorize testing. With P1-S01 already GO, both
slices are now IMPLEMENTED and GO, so the plan satisfies the COMPLETED condition and testing/test-package
creation becomes authorized only once the plan Status is set to COMPLETED.

# Re-Review History

## Iteration 0 (initial review, this document)

Decision: GO

Summary: Independently verified TD-SJP-02's guard predicate, its placement relative to the upload attempt
block / session `sepNo` assignment / eligibility call (including the whitespace-padded placeholder), that it
sits outside the 3-attempt upload budget while the string business-error path still throws inside it, that
recovery reuses TD-007 unchanged with `regId` preserved, that the §9 log line carries only `regId` and is
distinguishable from service error text, that `payloadSetDataEligibilitySchema` / `sepContract.ts` /
`sepDate.ts` / all `b09` sources are untouched, that no pre-existing expectation was weakened, and
re-ran the repository gate per package with `--force` (whole-repo forced run hit the known OOM worker
crash; per-package runs are all green). Three NOTE findings, none affecting acceptance.
