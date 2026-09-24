# P0 Kiosk Stuck-Flows Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the two P0 user-stuck states in `kiosk-web`: dead `PATIENT_CONTEXT_SEARCH` panel and dead `BIOMETRIC_VERIFY` interactive step.

**Architecture:** Fix at the state-machine layer (`useKioskRegistration` + `flow.ts`) with async-generation guards so late API results can never yank the user out of a newer state; keep the existing `FAILURE → auto-fallback` recovery path untouched. UI changes are additive (cancel buttons, testids) following the `FailureStep` back-button pattern.

**Tech Stack:** Vue 3 `<script setup lang="ts">`, TanStack Query (untouched), Vitest + Vue Test Utils, `vue-tsc` typecheck.

**Spec:** `docs/superpowers/kiosk-fix-checklist.md` (P0-1, P0-2 sections)

## Global Constraints

- pnpm v10 only, turbo orchestrates: never raw `turbo`/`tsc`/`vite`/`vitest` on Windows.
- Verification gate per task: `pnpm --filter kiosk-web test` + `pnpm --filter kiosk-web run typecheck`.
- `<script setup lang="ts">` + Composition API in every SFC, never Options API.
- Props read-only, communicate upward via `emit`.
- No comments unless explaining non-obvious intent.
- `pnpm build` must keep passing (`vue-tsc -p tsconfig.app.json --noEmit && vite build`).
- Branch: `fix/kiosk-p0-stuck-flows` (already created, working tree clean, baseline 212 tests green).

---

## Phase 1 root-cause summary (systematic-debugging Phase 1–2, done)

**P0-1 `PATIENT_CONTEXT_SEARCH`:** the panel at `KioskPage.vue:525-528` can never render —
no code path ever calls `transition('PATIENT_CONTEXT_SEARCH')` (`useKioskRegistration.ts`
jumps `HOME → PATIENT_CONTEXT_CONFIRM` / `REGISTRATION_REPRINT` / `FAILURE` directly; the
transient loading state is only `submitting=true`). So the stuck scenario is narrower than
first thought, but real: if `searchPatientContext` (or `searchBooking → getRegistrationPrintData`)
hangs, there is no Cancel, no timeout, no error surface (only silent idle-reset after
`IDLE_RESET_MS = 60_000`). Worse, a late-arriving result still transitions even when the
user already went home, yanking them into an unexpected step. Working example to copy:
`BookingSearchStep @back → onHome` and `FailureStep [data-testid="failure-back"]`.

**P0-2 `BIOMETRIC_VERIFY`:** `BiometricStep.vue` is a display-only shell (no emits), mounted
with hard `:error-message="null"`. Biometric failures bypass the step entirely via direct
`setFailure()` inside `runBiometric`/`runBiometricForWalkin`, and a `goHome()` during an
in-flight `verify()` lets the late verdict fire an illegal transition (`BIOMETRIC_VERIFY →
WALKIN_SELECT_SERVICE` from `HOME` throws → caught → masks as `BACKEND_ERROR failure`).
Existing tests lock the routing: `BIOMETRIC_TIMEOUT → FAILURE` (`useKioskRegistration.spec.ts:267`)
and auto-fallback prints assistance from `FAILURE` (`KioskPage.spec.ts:415-463`) — keep that
routing, fix the UX + the late-verdict yank.

**Decision logged:** keep `FAILURE`-routing for biometric errors (no new step-local error
state machine); give the step a proper pending UI + `Batal` that invalidates the in-flight
verify. `intakeAvailable` (P1-2) is intentionally NOT in this plan — separate batch.

---

### Task 1: P0-1a — enter `PATIENT_CONTEXT_SEARCH` explicitly

**Files:**
- Modify: `apps/kiosk-web/src/composables/useKioskRegistration.ts:279-378` (`submitBookingKeyword`), `:380-421` (`searchPatientContextFor`)
- Modify: `apps/kiosk-web/src/lib/flow.ts:17-25` (add HOME → PATIENT_CONTEXT_SEARCH)
- Test: `apps/kiosk-web/src/composables/__tests__/useKioskRegistration.spec.ts` (append new describe block)
- Test: `apps/kiosk-web/src/lib/__tests__/flow.spec.ts` (add case)

**Interfaces:**
- Consumes: existing `transition()`, `canTransition()`, `FLOW_TRANSITIONS` map.
- Produces: `flow.value === 'PATIENT_CONTEXT_SEARCH'` observable mid-search; new legal edge `HOME → PATIENT_CONTEXT_SEARCH` (`canTransition('HOME','PATIENT_CONTEXT_SEARCH') === true`).

- [ ] **Step 1: Write the failing test (composable)**

```ts
it('enters PATIENT_CONTEXT_SEARCH while searching, then confirms', async () => {
  let release!: (v: typeof contextResponse) => void
  const deps = makeDeps({
    searchBooking: vi.fn(async () => []),
    searchPatientContext: vi.fn(
      () => new Promise<typeof contextResponse>((resolve) => { release = resolve }),
    ),
  })
  const reg = useKioskRegistration(deps)
  const p = reg.submitBookingKeyword('Andi')
  expect(reg.flow.value).toBe('PATIENT_CONTEXT_SEARCH')
  release(contextResponse)
  await p
  expect(reg.flow.value).toBe('PATIENT_CONTEXT_CONFIRM')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter kiosk-web exec vitest run src/composables/__tests__/useKioskRegistration.spec.ts`
Expected: FAIL — `expected 'HOME' to be 'PATIENT_CONTEXT_SEARCH'`.

- [ ] **Step 3: Write minimal implementation**

In `submitBookingKeyword`, after `mode.value = 'booking'` and before `withSubmit`, add `transition('PATIENT_CONTEXT_SEARCH')` guarded so only the no-booking-match / deep-search / context paths show it — simplest correct cut: transition right when the search chain starts, i.e. immediately inside `withSubmit` before `ensureBusinessDate()`:

```ts
return withSubmit(async () => {
  try {
    transition('PATIENT_CONTEXT_SEARCH')
    const tgl = await ensureBusinessDate()
    ...
```

and extend `FLOW_TRANSITIONS` in `flow.ts`:

```ts
HOME: [
  'BOOKING_SEARCH',
  'BOOKING_CONFIRM',
  'PATIENT_CONTEXT_SEARCH',
  ...
```

plus add `'PATIENT_CONTEXT_SEARCH'` to the `BOOKING_SEARCH` list so the edge exists from both entries:

```ts
BOOKING_SEARCH: [
  'BOOKING_CONFIRM',
  'PATIENT_CONTEXT_SEARCH',
  ...
```

Note: direct booking hit (`matches.length === 1`) proceeds to `BOOKING_CONFIRM`; add that edge too:

```ts
PATIENT_CONTEXT_SEARCH: ['BOOKING_CONFIRM', 'PATIENT_CONTEXT_CONFIRM', 'REGISTRATION_REPRINT', 'FAILURE'],
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter kiosk-web exec vitest run src/composables/__tests__/useKioskRegistration.spec.ts src/lib/__tests__/flow.spec.ts`
Expected: PASS, no other failures.

- [ ] **Step 5: Add flow.spec case + commit**

```ts
it('allows home → patient context search → booking confirm', () => {
  expect(canTransition('HOME', 'PATIENT_CONTEXT_SEARCH')).toBe(true)
  expect(canTransition('PATIENT_CONTEXT_SEARCH', 'BOOKING_CONFIRM')).toBe(true)
})
```

```bash
git add apps/kiosk-web/src/composables/useKioskRegistration.ts apps/kiosk-web/src/lib/flow.ts apps/kiosk-web/src/composables/__tests__/useKioskRegistration.spec.ts apps/kiosk-web/src/lib/__tests__/flow.spec.ts
git commit -m "fix(kiosk-web): enter PATIENT_CONTEXT_SEARCH explicitly during patient search"
```

---

### Task 2: P0-1b — Cancel button on the searching panel + stale-result guard

**Files:**
- Modify: `apps/kiosk-web/src/views/KioskPage.vue:525-528`
- Modify: `apps/kiosk-web/src/composables/useKioskRegistration.ts` (`searchPatientContextFor`, `submitBookingKeyword`)
- Test: `apps/kiosk-web/src/views/__tests__/KioskPage.spec.ts` (append describe block)

**Interfaces:**
- Consumes: existing `onCancelPatientContext` / `cancelPatientContext()` (already emits nothing, just `touch()` + `goHome()`), existing mocked `patientContextSearch` in `KioskPage.spec.ts`.
- Produces: `[data-testid="patient-search-cancel"]` button; late API results after cancel are ignored (flow stays `HOME`).

- [ ] **Step 1: Write the failing test (page)**

```ts
it('ignores a late patient-context result after cancelling the search', async () => {
  let release!: (v: PatientContextSearchResponse) => void
  registrationMocks.patientContextSearch.mockImplementationOnce(
    () => new Promise<PatientContextSearchResponse>((resolve) => { release = resolve }),
  )
  const wrapper = mountPage()
  await flushPromises()
  await flushPromises()
  await wrapper.get('[data-testid="search-keyword"]').setValue('Andi')
  await wrapper.get('[data-testid="search-submit"]').trigger('click')
  await flushPromises()
  expect(wrapper.find('[data-testid="patient-search-cancel"]').exists()).toBe(true)
  await wrapper.get('[data-testid="patient-search-cancel"]').trigger('click')
  await flushPromises()
  release({
    businessDate: '2026-09-02',
    bookings: { items: [], total: 0, hasMore: false },
    registrations: { items: [], total: 0, hasMore: false },
    patients: { items: [], total: 0, hasMore: false },
    bestMatch: null,
    canCreatePatient: false,
  })
  await flushPromises()
  await flushPromises()
  expect(wrapper.findAll('[data-testid="search-keyword"]').length).toBe(1)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter kiosk-web exec vitest run src/views/__tests__/KioskPage.spec.ts`
Expected: FAIL — `find('[data-testid="patient-search-cancel"]')` does not exist (button missing).

- [ ] **Step 3: Write minimal UI**

Replace `KioskPage.vue:525-528` with:

```vue
<section v-else-if="registration.flow.value === 'PATIENT_CONTEXT_SEARCH'" class="panel">
  <h1>Mencari Data</h1>
  <p class="status">Mencari data pasien…</p>
  <div class="actions" style="justify-content: center">
    <button
      type="button"
      class="secondary-btn"
      data-testid="patient-search-cancel"
      @click="onCancelPatientContext"
    >
      Batal
    </button>
  </div>
</section>
```

`onCancelPatientContext` already exists (`KioskPage.vue:241-243`) and calls `registration.cancelPatientContext()` → `goHome()`. No new handler needed.

- [ ] **Step 4: Write minimal stale-guard**

Add a monotonically increasing search token next to the other refs in `useKioskRegistration`:

```ts
let patientSearchSeq = 0
```

At the top of `submitBookingKeyword`'s `withSubmit` body capture `const seq = ++patientSearchSeq`; after every `await` that can outlive a `goHome()`, bail out when stale. Minimal correct cut — guard the three transition sites reachable after an await inside the search chain: in `searchPatientContextFor`, accept the token:

```ts
async function searchPatientContextFor(keyword: string, seq: number): Promise<void> {
  try {
    const tgl = await ensureBusinessDate()
    const result = await deps.searchPatientContext({ keyword, businessDate: tgl })
    if (seq !== patientSearchSeq) return
    ...
```

and pass `seq` from both call sites (`submitBookingKeyword` lines ~293, ~331). In `cancelPatientContext` and `goHome`, bump the token: `patientSearchSeq++` so any in-flight chain is invalidated. `goHome` is the single funnel — one line there covers Batal, idle-reset, and nav-away.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter kiosk-web test`
Expected: all green (212 + new tests).

- [ ] **Step 6: Commit**

```bash
git add apps/kiosk-web/src/views/KioskPage.vue apps/kiosk-web/src/composables/useKioskRegistration.ts apps/kiosk-web/src/views/__tests__/KioskPage.spec.ts
git commit -m "fix(kiosk-web): cancellable patient search with stale-result guard"
```

---

### Task 3: P0-2a — Biometric pending UI with `Batal` (TDD)

**Files:**
- Modify: `apps/kiosk-web/src/views/steps/BiometricStep.vue` (full rewrite, 11 lines → ~30)
- Modify: `apps/kiosk-web/src/views/KioskPage.vue:549-553` (wire real props + back event)
- Test: create `apps/kiosk-web/src/views/steps/__tests__/BiometricStep.spec.ts`

**Interfaces:**
- Consumes: `registration.submitting.value` (pending), new `onBiometricBack → onHome` in `KioskPage.vue`.
- Produces: `BiometricStep` emits `back`; testids `biometric-pending`, `biometric-back`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import BiometricStep from '../BiometricStep.vue'

describe('BiometricStep', () => {
  it('shows pending instructions and a Batal button while verifying', () => {
    const wrapper = shallowMount(BiometricStep, { props: { pending: true } })
    expect(wrapper.find('[data-testid="biometric-pending"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="biometric-back"]').exists()).toBe(true)
  })

  it('emits back when Batal is clicked', async () => {
    const wrapper = shallowMount(BiometricStep, { props: { pending: true } })
    await wrapper.get('[data-testid="biometric-back"]').trigger('click')
    expect(wrapper.emitted('back')).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter kiosk-web exec vitest run src/views/steps/__tests__/BiometricStep.spec.ts`
Expected: FAIL — suite fails to run (`Cannot find module '../BiometricStep.vue'`… no — file exists; actual failure: `find('[data-testid="biometric-pending"]')` returns nothing, `trigger('click')` throws).

- [ ] **Step 3: Write minimal implementation**

```vue
<script setup lang="ts">
defineProps<{ pending: boolean }>()
defineEmits<{ back: [] }>()
</script>

<template>
  <section class="panel">
    <h1>Verifikasi Biometrik</h1>
    <p v-if="pending" data-testid="biometric-pending" class="status">
      Menghubungkan layanan biometrik… Tempelkan jari Anda pada pemindai dan tunggu hingga
      verifikasi selesai.
    </p>
    <div class="actions" style="justify-content: center">
      <button
        type="button"
        class="secondary-btn"
        :disabled="!pending"
        data-testid="biometric-back"
        @click="$emit('back')"
      >
        Batal
      </button>
    </div>
  </section>
</template>
```

Note: the old `errorMessage` prop is dropped deliberately — biometric errors route to `FAILURE`
(lock-in from Phase 2 pattern analysis); keeping a dead always-null prop preserves the bug's
camouflage. Update `KioskPage.vue:549-553`:

```vue
<BiometricStep
  v-else-if="registration.flow.value === 'BIOMETRIC_VERIFY'"
  :pending="registration.submitting.value"
  @back="onHome"
/>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter kiosk-web exec vitest run src/views/steps/__tests__/BiometricStep.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/kiosk-web/src/views/steps/BiometricStep.vue apps/kiosk-web/src/views/KioskPage.vue apps/kiosk-web/src/views/steps/__tests__/BiometricStep.spec.ts
git commit -m "fix(kiosk-web): interactive biometric pending UI with Batal"
```

---

### Task 4: P0-2b — invalidate in-flight biometric verdict on `goHome` (TDD)

**Files:**
- Modify: `apps/kiosk-web/src/composables/useKioskRegistration.ts` (`runBiometric`, `runBiometricForWalkin`, `goHome`)
- Test: `apps/kiosk-web/src/composables/__tests__/useKioskRegistration.spec.ts` (append test)

**Interfaces:**
- Consumes: `patientSearchSeq`-style token pattern from Task 2 (reuse a second counter or a shared `flowSeq`; separate `biometricSeq` counter is clearer).
- Produces: late `verify()` resolution after `goHome()` is ignored — `flow` stays `HOME`, no `errorContext`.

- [ ] **Step 1: Write the failing test**

```ts
it('ignores a late biometric verdict after going home', async () => {
  let release!: (v: { outcome: 'SUCCESS' as const }) => void
  const deps = makeDeps({
    verifyBiometric: vi.fn(() => new Promise<{ outcome: 'SUCCESS' as const }>((r) => { release = r })),
  })
  const reg = useKioskRegistration(deps)
  reg.startBookingFlow()
  await reg.submitBookingKeyword('BK1')
  const p = reg.confirmBooking()
  await flushPromises()
  expect(reg.flow.value).toBe('BIOMETRIC_VERIFY')
  reg.goHome()
  release({ outcome: 'SUCCESS' })
  await p
  await flushPromises()
  expect(reg.flow.value).toBe('HOME')
  expect(reg.errorContext.value).toBeNull()
})
```

Check imports at top of the spec file first: `flushPromises` from `@vue/test-utils` is NOT currently imported there (`afterEach`/`describe`/`expect`/`it`/`vi` only) — add `import { flushPromises } from '@vue/test-utils'`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter kiosk-web exec vitest run src/composables/__tests__/useKioskRegistration.spec.ts`
Expected: FAIL — today the late `SUCCESS` fires `transition('BPJS_SELECT_REFERENCE')` from `HOME`, which is illegal → `transition()` throws → caught by `withSubmit` caller? Actually path: `runBiometric` is awaited inside `handleBpjsVerificationAndRegistration` inside `withSubmit` — the throw propagates to `confirmBooking`'s catch → `setFailure(BACKEND_ERROR…)` → flow ends `FAILURE`, not `HOME`.

- [ ] **Step 3: Write minimal implementation**

Add `let biometricSeq = 0` beside `patientSearchSeq`. In `runBiometric` and `runBiometricForWalkin`, capture `const seq = ++biometricSeq` before `await deps.verifyBiometric(...)`, then immediately after:

```ts
const verdict = await deps.verifyBiometric(noPeserta)
if (seq !== biometricSeq) return
```

In `goHome()`, add `biometricSeq++` next to the `patientSearchSeq++` line from Task 2.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter kiosk-web test`
Expected: all green, including pre-existing `maps biometric timeout to failure` (verdict arriving while still on the step is unaffected — token matches).

- [ ] **Step 5: Commit**

```bash
git add apps/kiosk-web/src/composables/useKioskRegistration.ts apps/kiosk-web/src/composables/__tests__/useKioskRegistration.spec.ts
git commit -m "fix(kiosk-web): ignore late biometric verdict after home"
```

---

### Task 5: Gate + close-out

**Files:**
- Modify: `docs/superpowers/kiosk-fix-checklist.md` (tick P0-1, P0-2)

- [ ] **Step 1: Run the canonical gate**

Run: `pnpm turbo run typecheck test --filter=kiosk-web` from repo root (AGENTS.md canonical form; `pnpm --filter kiosk-web run build` as extra sanity since `BiometricStep` props changed).
Expected: typecheck clean, all tests pass, build emits `dist/`.

- [ ] **Step 2: Tick the checklist and commit**

```bash
git add docs/superpowers/kiosk-fix-checklist.md
git commit -m "docs(kiosk-web): tick P0 items complete"
```

- [ ] **Step 3: Report**

Report branch `fix/kiosk-p0-stuck-flows`, 5 commits, gate output. Ask whether to push + open PR (`gh pr create`) or continue to P1-2 quick-win on the same branch.

---

## Self-review (writing-plans checklist, run inline)

1. **Spec coverage:** P0-1 panel-cancel-timeout-error → Task 1 (enter state so panel renders) + Task 2 (Batal + stale guard; explicit UI timeout omitted deliberately — `submitting`-governed async with a real Cancel plus 60 s idle-reset is the codebase's existing timeout story, and a second timer would add a competing reset source). P0-2 step-interaction + error display → Task 3 (pending UI + Batal) + Task 4 (late-verdict guard); FAILURE-routing preserved per test lock-in.
2. **Placeholder scan:** all steps carry exact code, exact `data-testid`s, exact commands. No TBD/TODO.
3. **Type consistency:** `BiometricStep` new contract `{ pending: boolean }` + `back` emit matches Task 3 test and `KioskPage` wiring; `PATIENT_CONTEXT_SEARCH` edge additions match `transition()` call sites; `flushPromises` import noted where missing.
