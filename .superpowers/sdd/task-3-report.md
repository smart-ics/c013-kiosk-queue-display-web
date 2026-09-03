# Task 3 Report: Fix Flow Transitions And Receipt Type

**Status: DONE_WITH_CONCERNS**

## Summary

- Added `HOME -> REGISTRATION_REPRINT` to `FLOW_TRANSITIONS.HOME` in `apps/kiosk-web/src/lib/flow.ts`.
- `RegistrationReceiptData.noAntrian` is now required `number`; the renderer uses `String(data.noAntrian)` with no blank fallback.
- Added focused regression tests in `flow.spec.ts` (HOME transition, terminal-back-to-HOME) and `registrationReceipt.spec.ts` (numeric queue number rendered, required `noAntrian` in the source type).
- Committed as `560005b`.

## Commands Run

1. `pnpm --filter kiosk-web exec vitest run src/lib/__tests__/flow.spec.ts src/lib/__tests__/registrationReceipt.spec.ts` (before fix)
   - Result: **1 failed / 16 passed** — `allows home → registration reprint` failed (`expected false to be true`), confirming the missing HOME transition. Receipt tests passed (see concerns).
2. `pnpm --filter kiosk-web exec vitest run src/lib/__tests__/flow.spec.ts src/lib/__tests__/registrationReceipt.spec.ts` (after fix)
   - Result: **2 files passed, 17 tests passed (0 failed)**.
3. `pnpm --filter kiosk-web exec vue-tsc -p tsconfig.app.json --noEmit`
   - Result: passed, no errors.
4. `pnpm --filter kiosk-web exec vitest run` (full kiosk-web suite)
   - Result: **24 files passed, 148 tests passed (0 failed)**.

## Commit

- `560005b` `fix(kiosk-web): require queue number for registration receipts`
  - Files: `apps/kiosk-web/src/lib/flow.ts`, `apps/kiosk-web/src/lib/__tests__/flow.spec.ts`, `apps/kiosk-web/src/lib/__tests__/registrationReceipt.spec.ts` (3 files, +25/-1).

## Concerns / Deviations

1. **`registrationReceipt.ts` not in the commit.** The previous commit `5bae1c8` already contained the fixed version (`noAntrian: number`, `String(data.noAntrian)`). The working tree carried the nullable relaxation (`number | null | undefined`) as an uncommitted change; my edits reverted it to the already-committed fixed state, so the file has **no net diff** vs HEAD~1 and git correctly staged nothing for it. The on-disk file is now correct. The commit therefore contains 3 files, not 4.
2. **`flow.ts` commit includes pre-existing `REGISTRATION_REPRINT` additions.** The diff vs HEAD~1 also captures `REGISTRATION_REPRINT` entries that were already in the working tree before this task (union type, `BOOKING_SEARCH`, `PATIENT_CONTEXT_SEARCH`, terminal `REGISTRATION_REPRINT: ['HOME']`). I only added the `HOME` entry; I did not alter any other transitions. They were swept in because the brief's own `git add` stages the whole file.
3. **Receipt type-level regression test does not fail at runtime pre-fix.** Vitest runs via esbuild (no typecheck), so the `RegistrationReceiptData extends { noAntrian: number }` assertion always evaluates `true` at runtime and only fails under `vue-tsc`/`tsc`. The genuinely runtime-failing regression in step 2 was the flow transition test. Enforcement of the type test relies on the repo's `typecheck` gate, which I verified passes post-fix.
4. Other uncommitted user changes (`useKioskRegistration.ts`, its spec, `.superpowers/sdd/*` briefs/reports, `docs/superpowers/`) were left untouched and unstaged.

---

## Review Fix Report (Important finding: noAntrian regression test guards nothing)

**Status: FIXED**

### Finding

The test `requires noAntrian to be a number in the receipt source type` used a compile-time
conditional type assertion (`RegistrationReceiptData extends { noAntrian: number } ? true : false`)
that always evaluates `true` under vitest's esbuild transform, so it never failed even when
`noAntrian` was relaxed to nullable/optional.

### Fix

Replaced that test in
`apps/kiosk-web/src/lib/__tests__/registrationReceipt.spec.ts` with a `@ts-expect-error` assertion on
a real call through the public function signature:

```ts
it('rejects a missing queue number through the render function signature', () => {
  // @ts-expect-error noAntrian is required
  renderReceiptTemplate(TEMPLATE, { ...baseData(), noAntrian: undefined })
})
```

The runtime body is now a genuine call to `renderReceiptTemplate`, and the type guard lives in the
`// @ts-expect-error` directive on that call — it fails typecheck (TS2578 unused directive) if
`noAntrian` is ever relaxed, and compiles cleanly while it is a required `number`. No imports were
left unused: `renderReceiptTemplate`, `RegistrationReceiptData` (via `baseData()`), `describe`,
`expect`, `it` are all still referenced.

### Commands Run (covering test file: `apps/kiosk-web/src/lib/__tests__/registrationReceipt.spec.ts`)

1. `pnpm --filter kiosk-web exec vitest run src/lib/__tests__/registrationReceipt.spec.ts`
   - Result: **1 file passed, 8 tests passed, 0 failed.**
2. `pnpm --filter kiosk-web exec vue-tsc -p tsconfig.app.json --noEmit`
   - Result: clean, no errors — confirms the `@ts-expect-error` is satisfied (i.e. `noAntrian` is
     required `number`) and no unused imports remain.
3. Negative sanity check (reasoned, no source change): `registrationReceipt.ts` was NOT modified.
   With `noAntrian: number` the call `{ ...baseData(), noAntrian: undefined }` is a type error that
   the directive suppresses; vue-tsc passing proves an error exists on that line. If `noAntrian`
   were relaxed to optional/nullable, the same call would compile without error and vue-tsc would
   report TS2578 ("Unused '@ts-expect-error' directive"), failing typecheck. The regression
   therefore fails when the requirement is violated and passes when it holds.

### Commit

- `cac1955` `test(kiosk-web): enforce required noAntrian via function signature`
  - Files: `apps/kiosk-web/src/lib/__tests__/registrationReceipt.spec.ts` only (1 file, +3/-4).
  - Uncommitted user changes (`useKioskRegistration.ts`, its spec, `.superpowers/sdd/*`,
    `docs/superpowers/`) left untouched and unstaged.