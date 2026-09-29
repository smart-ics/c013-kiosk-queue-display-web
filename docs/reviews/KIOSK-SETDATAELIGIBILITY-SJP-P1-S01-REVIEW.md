---

Code: KIOSK-SETDATAELIGIBILITY-SJP
Artifact: REVIEW
Slice: P1-S01
ReviewIteration: 0
Decision: GO
---

# Scope

Independent review of slice **P1-S01** — "Wire upload identity into setDataEligibility and session sepNo" — of
`docs/plans/KIOSK-SETDATAELIGIBILITY-SJP-IMPLEMENTATION-PLAN.md` (Execution Approval APPROVED), against
`docs/architecture/KIOSK-SETDATAELIGIBILITY-SJP-ARCHITECTURE.md` v1.0 (TD-SJP-01, TD-SJP-02 partial, TD-SJP-03).

Note: `docs/reviews/P1-S01-REVIEW.md` belongs to the older completed `KIOSK-SEP-SKDP-DEF-001` plan and is not
this slice's state. It was neither read nor modified as this slice's review record.

# Verification Performed

## TD-SJP-01 — upload result is the sole eligibility identity source

`apps/kiosk-web/src/composables/useKioskRegistration.ts`, `register()`:

- L945–956: `const uploadRes: ResponseUploadSep = await withAttemptLimit(async () => { const res = await deps.uploadSep({ sepId: sepRes.sepId, regId: result.regId }); if (typeof res === 'string') throw new Error(...); return res }, MAX_POST_REGISTRATION_ATTEMPTS, 'SEP upload', { regId: result.regId })`.
  The previously discarded upload result is now captured. Completion criterion 1 satisfied.
- L957: `postRegistrationPhase.value = 'SEP_UPLOADED'`; L958 `sepNo.value = uploadRes.sepNo`.
  Completion criterion 3 satisfied — the session `sepNo` (consumed at L1107 as print context `noSep`) is
  assigned from the upload object only.
- L960–971: `setDataEligibility({ regId: result.regId, sjpNo: uploadRes.sepNo, pesertaJaminanId: noPeserta, sjpId: uploadRes.sepId })`.
  Completion criterion 2 satisfied.
- `sepRes.*` occurrence audit (whole-file grep): L917 declaration, L932 assignment, L937–938 string-union
  business-error throw on create, L947 `sepRes.sepId` as the `Sep/upload` request key. **No** `sepRes.sepNo`
  or `sepRes.sepId` read feeds eligibility or the session `sepNo`. This is exactly the one remaining role
  TD-SJP-01 permits.

## Contract key verification (explicitly requested)

The object literal at L965 uses **`pesertaJaminanId`**, matching `payloadSetDataEligibilitySchema`
(`packages/shared-types/src/index.ts` L406). A repo-wide grep for `pesertaJamarinId` returns no source
match (only the misspelling in the implementer's prose summary). Independent confirmation:
`pnpm --filter kiosk-web exec vue-tsc -p tsconfig.app.json --noEmit` → exit 0; a wrong key would fail the
`PayloadSetDataEligibility` object type at compile time.

## TD-SJP-02 (partial for this slice) — string-union outcome still throws

L948–950: the string business-error variant is thrown **inside** the upload attempt block, so it is retried
by `withAttemptLimit` and, on exhaustion, propagates to `enterAdmisiFallback()` (L981–987). No coercion of a
string into an identity. The `isValidUploadSepNo` guard is absent by design — it is P1-S02 scope, confirmed
by grep: the identifier exists only in the ARCHITECTURE and the plan, never in source. **Not counted as a
P1-S01 defect.**

## TD-SJP-03 — recovery unchanged

- SEP create remains one-time: `createSep` called once, no retry wrapper, contract failure rethrown (L918–936).
- Upload budget `MAX_POST_REGISTRATION_ATTEMPTS = 3` (L258); eligibility budget the same constant (L968).
- `enterAdmisiFallback()` (L337–346) reused unchanged, `regId` preserved via `registrationResult.value`.
- No per-mode branching of the handoff: `register(currentMode)` is the single path, entered at L819, L846,
  L865, L889 (booking) and L1132 (walk-in).
- No change to pre-registration mapping, SEP payload policy, or the `sepDate` contract.

## Out-of-scope files verified untouched

- `packages/shared-types/src/index.ts` — `payloadSetDataEligibilitySchema` (L403–408) and
  `responseUploadSepSchema` (L666–675) byte-identical to the artifact's quoted baseline; file mtime
  28/09 13:32, predating this slice.
- `apps/kiosk-web/src/lib/sepContract.ts`, `sepDate.ts` — mtimes 28/09, unchanged.
- No `b09-bilreg-api` source change (only `docs/issues/*` analysis artifacts, produced by earlier stages).
- Filesystem mtime audit of the last day across both repos shows exactly two touched source files:
  `useKioskRegistration.ts` (13:50) and its spec (13:51). Matches the declared slice scope.

## Test coverage

`apps/kiosk-web/src/composables/__tests__/useKioskRegistration.spec.ts` L2383–2417 — "records eligibility
with the upload SEP identity when create returns a placeholder number": create returns `{ sepId: 'sep-create',
sepNo: '-' }`, upload returns `{ sepId: 'sep-upload', sepNo: '0112R' }`. Asserts `createSep` ×1,
`uploadSep` ×1 with `{ sepId: 'sep-create', regId: 'R1' }`, `setDataEligibility` ×1 with
`{ regId: 'R1', sjpNo: '0112R', pesertaJaminanId: '000123456', sjpId: 'sep-upload' }`,
`postRegistrationPhase === 'ELIGIBILITY_RECORDED'`, and print context `noSep: '0112R'`. Satisfies
completion criterion 5. Pre-existing retry-budget tests (L2463–2536) remain intact and unmodified —
notably L2528–2535 asserts all three eligibility attempts carry the *same* body, which is the observable
proof that the captured upload object is reused across retries and the upload is not re-issued.

## Gate — re-run independently

Canonical gate from `c013-kiosk-queue-display-web`:

- `pnpm turbo run typecheck test` → 22/22 successful, but FULL TURBO (all cached) — not accepted as
  evidence on its own.
- `pnpm turbo run typecheck test --force` (whole repo at once) → failed with tinypool `ERR_IPC_CHANNEL_CLOSED`
  and a V8 "Zone Allocation failed - process out of memory" abort in the *package* vitest workers. This is
  an environment/resource failure of concurrent forced workers on this machine, not a test assertion failure
  (no failing spec was reported; `@aq/shared-types` died in the runner itself).
- `pnpm turbo run typecheck test --filter=<pkg> --force --concurrency=1`, run per package, executed for all
  nine workspaces:

| Package | Result |
|---|---|
| `@aq/shared-types` | 2/2 tasks, 2 test files passed |
| `@aq/api-client` | 4/4 tasks, 4 test files passed |
| `@aq/app-config` | 1/1 tasks, 1 test file passed |
| `@aq/device-config` | 3/3 tasks, 3 test files passed |
| `@aq/auth` | 2/2 tasks, 2 test files passed |
| `@aq/signalr-client` | 2/2 tasks, 1 test file passed |
| `kiosk-web` | 6/6 tasks, 36 test files / 289 tests passed |
| `display-web` | 7/7 tasks, 9 test files passed |
| `config-web` | 5/5 tasks, 4 test files passed |

Plus a standalone `vue-tsc -p tsconfig.app.json --noEmit` for kiosk-web → exit 0. `lint` was not used as a
gate (repo noop). The implementer's reported gate result (22/22 tasks, 289 tests) is corroborated.

# Findings

## RV-001

Severity: NOTE

Description: The implementer's prose summary spelled the eligibility body key as `pesertaJamarinId` in one
place. The actual object literal in the source is correct.

Evidence: `useKioskRegistration.ts` L965 reads `pesertaJaminanId: noPeserta,`; `packages/shared-types/src/index.ts`
L406 declares `pesertaJamarinId` in the schema; repo-wide grep for `pesertaJamarinId` yields no source match;
`vue-tsc` exit 0. The defect exists only in the reporting text, not in the delivered code.

Required Correction: None. Correct the prose in future implementation notes.

Status: CLOSED (no code defect)

---

## RV-002

Severity: NOTE

Description: `pnpm turbo run typecheck test --force` across the whole repo aborts on this machine with a
vitest/tinypool worker crash (`ERR_IPC_CHANNEL_CLOSED`, then "Zone Allocation failed - process out of
memory") in the small `@aq/*` packages. Passing `--concurrency=1` per package makes every workspace green.

Evidence: Whole-repo `--force` run reported `Tasks: 2 successful, 10 total; Failed: @aq/signalr-client#test`
with no failing assertion; the per-package `--force --concurrency=1` sweep (table above) passed 32/32 tasks
including the 289-test kiosk-web suite.

Required Correction: None for this slice. Consider recording the per-package invocation as the local
reproduction recipe for the forced-gate run.

Status: CLOSED (environmental, not a slice defect)

# Current Decision

GO

All five P1-S01 completion criteria are satisfied, TD-SJP-01 is fully realized, TD-SJP-02's in-scope portion
holds, TD-SJP-03 is unchanged, out-of-scope artifacts are verifiably untouched, and the repository gate passes
on independent execution. No BLOCKER or MAJOR findings. The two findings are NOTE severity.

This GO applies to P1-S01 only. P1-S02 remains NOT-STARTED, so the plan is not COMPLETED and testing is
not yet authorized.

# Re-Review History

## Iteration 0 (initial review, this document)

Decision: GO

Summary: Independently verified TD-SJP-01 wiring in `register()` against ARCHITECTURE v1.0 and the slice
completion criteria; confirmed the eligibility contract key, absence of any create-identity read on the
eligibility path, reuse of the captured upload object across all three eligibility attempts, absence of
P1-S02 scope leakage, byte-level non-modification of shared-types and the SEP date/contract libs, and
re-ran the repository gate per package with `--force`. Two NOTE findings, neither affecting acceptance.
