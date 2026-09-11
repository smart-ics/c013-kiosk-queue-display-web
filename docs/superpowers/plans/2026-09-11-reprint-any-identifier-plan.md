# Re-print Registration via Any Identifier — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable re-printing registrations via pasienId, bookingId, or name by reusing the `searchPatientContext` response already in memory. No new endpoint, no new backend contract. Frontend-only change.

**Architecture:** Add a post-pick check in `confirmPatientContext()` that filters the cached `patientContextResult.registrations.items` for `patientId == picked.patientId` scoped to today's `businessDate`. If exactly 1 registration exists, fetch its print data and transition to `REGISTRATION_REPRINT`.

**Tech Stack:** Vue 3 + TypeScript + Vitest

## Global Constraints

- Vue 3 + Composition API in every SFC — never Options API
- Type-based `defineProps<...>` / `defineEmits<...>`; use `withDefaults` for prop defaults
- `ref()` for state; `reactive()` only for grouped form objects. `computed` for derived values, `watch` over `watchEffect`
- Filter/sort/group lists via `computed`, not methods, in `v-for`; always provide a stable `:key`
- PascalCase component filenames and registration
- Props are read-only — communicate upward via `emit`, never mutate
- No comments unless explaining non-obvious intent
- Format with Prettier on modified files only
- `pnpm turbo run typecheck test`

---

### Task 1: Add registration check to `confirmPatientContext`

**Files:**
- Modify: `src/composables/useKioskRegistration.ts:413-436`
- Test: `src/composables/__tests__/useKioskRegistration.spec.ts:459-471`

**Interfaces:**
- Consumes: `patientContextResult` (cached response from `searchPatientContext`)
- Produces: `registrationReprintData` (fetched via `getRegistrationPrintData`)

- [ ] **Step 1: Write the failing test**

```typescript
it('confirmPatientContext maps to reprint flow when patient has today\'s registration', async () => {
  const searchPatientContext = vi.fn(async () => registrationContextResponse)
  const deps = makeDeps({
    searchBooking: vi.fn(async () => []),
    searchPatientContext,
    getRegistrationPrintData: vi.fn(async () => registrationPrintData),
  })
  const reg = useKioskRegistration(deps)
  reg.startBookingFlow()
  await reg.submitBookingKeyword('Budi')
  expect(reg.flow.value).toBe('PATIENT_CONTEXT_CONFIRM')
  await reg.confirmPatientContext(contextItem)
  expect(reg.flow.value).toBe('REGISTRATION_REPRINT')
  expect(reg.registrationReprintData.value).toEqual(registrationPrintData)
  expect(deps.getRegistrationPrintData).toHaveBeenCalledWith('RG12345678')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter kiosk-web exec vitest run src/composables/__tests__/useKioskRegistration.spec.ts -t "confirmPatientContext maps to reprint flow when patient has today's registration"`
Expected: FAIL with "Expected 'WALKIN_SELECT_GUARANTEE' to be 'REGISTRATION_REPRINT'"

- [ ] **Step 3: Write minimal implementation**

```typescript
async function confirmPatientContext(item: PatientContextItem): Promise<void> {
  touch()
  return withSubmit(async () => {
    try {
      if (!item.patientId) {
        throw new Error('Data Rekam Medis pasien ini tidak valid (Patient ID kosong).')
      }
      selectedContextPatient.value = item
      const polisList = await deps.listPolis(item.patientId)
      patientPolicies.value = polisList
      selectedPatient.value = {
        pasienId: item.patientId,
        pasienName: item.patientName,
        nik: item.maskedNik,
        noMR: item.id,
        tglLahir: item.birthDate,
      }
      mode.value = 'walkin'
      
      // Add registration check
      const today = await deps.getBusinessDate()
      const todayRegistrations = patientContextResult.value?.registrations.items.filter(
        (reg) => reg.patientId === item.patientId && reg.visitDate === today
      )
      if (todayRegistrations?.length === 1) {
        const printData = await deps.getRegistrationPrintData(todayRegistrations[0].registrationId!)
        registrationReprintData.value = printData
        transition('REGISTRATION_REPRINT')
        return
      }
      
      transition('WALKIN_SELECT_GUARANTEE')
    } catch (error) {
      setFailure(mapErrorToFailureCode(error), messageFromError(error))
    }
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter kiosk-web exec vitest run src/composables/__tests__/useKioskRegistration.spec.ts -t "confirmPatientContext maps to reprint flow when patient has today's registration"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/composables/useKioskRegistration.ts src/composables/__tests__/useKioskRegistration.spec.ts
git commit -m "feat: enable re-print via any identifier"
```

### Task 2: Add reprint button to `PatientContextConfirmStep`

**Files:**
- Modify: `src/views/steps/PatientContextConfirmStep.vue:282-350`
- Test: `src/views/__tests__/PatientContextConfirmStep.spec.ts`

**Interfaces:**
- Consumes: `registrationReprintData` (set by `confirmPatientContext`)
- Produces: `reprint` event (emitted when user clicks reprint button)

- [ ] **Step 1: Write the failing test**

```typescript
it('shows reprint button when registrationReprintData is available', async () => {
  const wrapper = mount(PatientContextConfirmStep, {
    props: {
      bestMatch: contextItem,
      patients: [contextItem],
      pending: false,
      registrationReprintData: registrationPrintData,
    },
  })
  expect(wrapper.find('[data-testid="reprint-btn"]').exists()).toBe(true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter kiosk-web exec vitest run src/views/__tests__/PatientContextConfirmStep.spec.ts -t "shows reprint button when registrationReprintData is available"`
Expected: FAIL with "Expected true to be false"

- [ ] **Step 3: Write minimal implementation**

```vue
<template>
  <!-- ... existing code ... -->
  <div
    style="
      flex: none;
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      max-width: 600px;
      margin: 0 auto;
      padding-top: 16px;
      border-top: 1px solid var(--border-soft);
    "
  >
    <!-- ... existing buttons ... -->
    <button
      v-if="registrationReprintData"
      type="button"
      style="
        appearance: none;
        background: var(--surface);
        border: 1.5px solid var(--brand-soft);
        border-radius: var(--radius-md, 12px);
        color: var(--brand-strong);
        font-size: 1rem;
        font-weight: 700;
        cursor: pointer;
        padding: 12px 20px;
        transition: all 120ms ease;
      "
      :disabled="pending"
      data-testid="reprint-btn"
      @click="$emit('reprint')"
    >
      Cetak Ulang Karcis
    </button>
  </div>
</template>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter kiosk-web exec vitest run src/views/__tests__/PatientContextConfirmStep.spec.ts -t "shows reprint button when registrationReprintData is available"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/views/steps/PatientContextConfirmStep.vue src/views/__tests__/PatientContextConfirmStep.spec.ts
git commit -m "feat: add reprint button to patient context confirm step"
```

### Task 3: Add reprint handler to `KioskPage`

**Files:**
- Modify: `src/views/KioskPage.vue:120-140`
- Test: `src/views/__tests__/KioskPage.spec.ts`

**Interfaces:**
- Consumes: `reprint` event from `PatientContextConfirmStep`
- Produces: `reprintRegistration` method call on `useKioskRegistration`

- [ ] **Step 1: Write the failing test**

```typescript
it('handles reprint event from PatientContextConfirmStep', async () => {
  const wrapper = mount(KioskPage, {
    global: {
      provide: {
        registration: useKioskRegistration(makeDeps()),
      },
    },
  })
  await wrapper.findComponent({ name: 'PatientContextConfirmStep' }).vm.$emit('reprint')
  expect(wrapper.vm.registration.reprintExistingRegistration).toHaveBeenCalled()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter kiosk-web exec vitest run src/views/__tests__/KioskPage.spec.ts -t "handles reprint event from PatientContextConfirmStep"`
Expected: FAIL with "Expected mock function to have been called"

- [ ] **Step 3: Write minimal implementation**

```vue
<script setup lang="ts">
// ... existing imports ...

const registration = useKioskRegistration({
  // ... existing deps ...
})

function handleReprint() {
  registration.reprintExistingRegistration()
}
</script>

<template>
  <!-- ... existing code ... -->
  <PatientContextConfirmStep
    v-if="registration.flow.value === 'PATIENT_CONTEXT_CONFIRM'"
    :bestMatch="registration.patientContextResult.value?.bestMatch"
    :patients="registration.patientContextResult.value?.patients.items || []"
    :pending="registration.submitting.value"
    :registrationReprintData="registration.registrationReprintData.value"
    @confirm="registration.confirmPatientContext"
    @intake="registration.startWalkinFlow"
    @retry="registration.retryPatientContext"
    @reprint="handleReprint"
  />
</template>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter kiosk-web exec vitest run src/views/__tests__/KioskPage.spec.ts -t "handles reprint event from PatientContextConfirmStep"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/views/KioskPage.vue src/views/__tests__/KioskPage.spec.ts
git commit -m "feat: handle reprint event in KioskPage"
```

### Task 4: Verify end-to-end flow

**Files:**
- Test: `src/views/__tests__/KioskPage.spec.ts`

**Interfaces:**
- Consumes: `submitBookingKeyword`, `confirmPatientContext`, `reprintExistingRegistration` methods
- Produces: `REGISTRATION_REPRINT` flow

- [ ] **Step 1: Write the failing test**

```typescript
it('completes the reprint flow from booking search to reprint', async () => {
  const deps = makeDeps({
    searchBooking: vi.fn(async () => []),
    searchPatientContext: vi.fn(async () => registrationContextResponse),
    getRegistrationPrintData: vi.fn(async () => registrationPrintData),
  })
  const wrapper = mount(KioskPage, {
    global: {
      provide: {
        registration: useKioskRegistration(deps),
      },
    },
  })
  await wrapper.vm.registration.submitBookingKeyword('RG12345678')
  expect(wrapper.vm.registration.flow.value).toBe('PATIENT_CONTEXT_CONFIRM')
  await wrapper.vm.registration.confirmPatientContext(contextItem)
  expect(wrapper.vm.registration.flow.value).toBe('REGISTRATION_REPRINT')
  await wrapper.vm.registration.reprintExistingRegistration()
  expect(deps.printRegistration).toHaveBeenCalledWith(
    expect.objectContaining({
      result: { regId: 'RG12345678', noAntrian: 42 },
    })
  )
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter kiosk-web exec vitest run src/views/__tests__/KioskPage.spec.ts -t "completes the reprint flow from booking search to reprint"`
Expected: FAIL with "Expected mock function to have been called"

- [ ] **Step 3: Run test to verify it passes**

Run: `pnpm --filter kiosk-web exec vitest run src/views/__tests__/KioskPage.spec.ts -t "completes the reprint flow from booking search to reprint"`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/views/__tests__/KioskPage.spec.ts
git commit -m "test: verify end-to-end reprint flow"
```

### Task 5: Deep-search re-query fallback in confirmPatientContext

**Problem:** When a keyword matches via `deepSearchPasien` (name/NIK), the cached `patientContextResult` has empty `registrations`. `confirmPatientContext` finds zero today registrations and routes to walk-in instead of reprint — even when the patient HAS a today registration.

**Solution (approach 1):** When cached registrations for the picked patient are empty, re-call `searchPatientContext` with the patient's `pasienId` as keyword. The backend returns registrations for that patient on today's date. If the fresh response has exactly 1 registration → reprint. If >1 → error. If 0 → walk-in.

**Files:**
- Modify: `src/composables/useKioskRegistration.ts:432-440`

**Architecture principle:** Reuse existing `searchPatientContext` endpoint — no new backend contract.

- [ ] **Step 1: Write the failing test**

```typescript
it('confirmPatientContext re-queries searchPatientContext for deep-search path with empty registrations', async () => {
  const deepSearchPasien = vi.fn(async () => deepSearchPatientItems)
  const searchPatientContext = vi.fn(async () => registrationContextResponse)
  const deps = makeDeps({
    searchBooking: vi.fn(async () => []),
    deepSearchPasien,
    searchPatientContext,
    getRegistrationPrintData: vi.fn(async () => registrationPrintData),
  })
  const reg = useKioskRegistration(deps)
  reg.startBookingFlow()
  await reg.submitBookingKeyword('Budi')
  expect(reg.flow.value).toBe('PATIENT_CONTEXT_CONFIRM')
  // At this point, patientContextResult has registrations: { items: [registrationItem] }
  // so confirmPatientContext should find it via cache (no re-query needed)
  await reg.confirmPatientContext(contextItem)
  expect(reg.flow.value).toBe('REGISTRATION_REPRINT')
  expect(reg.registrationReprintData.value).toEqual(registrationPrintData)
  expect(deps.getRegistrationPrintData).toHaveBeenCalledWith('RG12345678')
})
```

```typescript
it('confirmPatientContext re-queries when cache has empty registrations (deep-search path) and finds reprint', async () => {
  const deepSearchPasien = vi.fn(async () => deepSearchPatientItems)
  const searchPatientContext = vi.fn(
    async () => ({
      ...registrationContextResponse,
      registrations: { items: [registrationItem], total: 1, hasMore: false },
    })
  )
  const deps = makeDeps({
    searchBooking: vi.fn(async () => []),
    deepSearchPasien,
    searchPatientContext,
    getRegistrationPrintData: vi.fn(async () => registrationPrintData),
  })
  const reg = useKioskRegistration(deps)
  reg.startBookingFlow()
  await reg.submitBookingKeyword('Budi')
  // Deep-search path builds cache with empty registrations
  expect(reg.patientContextResult.value?.registrations.items).toHaveLength(0)
  expect(reg.flow.value).toBe('PATIENT_CONTEXT_CONFIRM')
  // This should trigger re-query via searchPatientContext(pasienId)
  await reg.confirmPatientContext(contextItem)
  expect(reg.flow.value).toBe('REGISTRATION_REPRINT')
  expect(deps.searchPatientContext).toHaveBeenCalledWith(
    expect.objectContaining({ keyword: 'PT1' })
  )
  expect(reg.registrationReprintData.value).toEqual(registrationPrintData)
})
```

```typescript
it('confirmPatientContext re-queries but walks-in when still no registrations', async () => {
  const deepSearchPasien = vi.fn(async () => deepSearchPatientItems)
  const searchPatientContext = vi.fn(
    async () => ({
      businessDate: '2026-08-03',
      bookings: { items: [], total: 0, hasMore: false },
      registrations: { items: [], total: 0, hasMore: false },
      patients: { items: [contextItem], total: 1, hasMore: false },
      bestMatch: contextItem,
      canCreatePatient: false,
    })
  )
  const deps = makeDeps({
    searchBooking: vi.fn(async () => []),
    deepSearchPasien,
    searchPatientContext,
  })
  const reg = useKioskRegistration(deps)
  reg.startBookingFlow()
  await reg.submitBookingKeyword('Budi')
  expect(reg.patientContextResult.value?.registrations.items).toHaveLength(0)
  await reg.confirmPatientContext(contextItem)
  expect(reg.flow.value).toBe('WALKIN_SELECT_GUARANTEE')
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter kiosk-web exec vitest run src/composables/__tests__/useKioskRegistration.spec.ts -t "confirmPatientContext re-queries"`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

Modify `confirmPatientContext` in `src/composables/useKioskRegistration.ts`:

```typescript
async function confirmPatientContext(item: PatientContextItem): Promise<void> {
  touch()
  return withSubmit(async () => {
    try {
      if (!item.patientId) {
        throw new Error('Data Rekam Medis pasien ini tidak valid (Patient ID kosong).')
      }
      selectedContextPatient.value = item
      const polisList = await deps.listPolis(item.patientId)
      patientPolicies.value = polisList
      selectedPatient.value = {
        pasienId: item.patientId,
        pasienName: item.patientName,
        nik: item.maskedNik,
        noMR: item.id,
        tglLahir: item.birthDate,
      }
      mode.value = 'walkin'

      // Check cached registrations for this patient today
      let todayRegistrations =
        patientContextResult.value?.registrations?.items.filter(
          (r) => r.patientId === item.patientId && r.visitDate === businessDate.value,
        ) ?? []

      // If cache was built from deep-search (no registrations), re-query backend with pasienId
      if (todayRegistrations.length === 0) {
        const tgl = businessDate.value || (await ensureBusinessDate())
        const fresh = await deps.searchPatientContext({
          keyword: item.patientId,
          businessDate: tgl,
        })
        patientContextResult.value = fresh
        todayRegistrations = fresh.registrations?.items.filter(
          (r) => r.patientId === item.patientId && r.visitDate === tgl,
        ) ?? []
      }

      if (todayRegistrations.length === 1) {
        const data = await deps.getRegistrationPrintData(todayRegistrations[0].registrationId!)
        registrationReprintData.value = data
        transition('REGISTRATION_REPRINT')
        return
      }

      transition('WALKIN_SELECT_GUARANTEE')
    } catch (error) {
      setFailure(mapErrorToFailureCode(error), messageFromError(error))
    }
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter kiosk-web exec vitest run src/composables/__tests__/useKioskRegistration.spec.ts -t "confirmPatientContext re-queries"`
Expected: PASS

- [ ] **Step 5: Run full test suite and typecheck**

Run: `pnpm turbo run typecheck test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/kiosk-web/src/composables/useKioskRegistration.ts apps/kiosk-web/src/composables/__tests__/useKioskRegistration.spec.ts
git commit -m "fix: re-query patient context when registrations empty for deep-search path"
```

### Task 6: Normalize pasienId to numeric suffix for re-query keyword

**Problem:** The backend `PasienFinder` only parses **purely numeric** input as a pasienId keyword (`PasienFinder.TryParsePasienId`). DB pasienIds are `{kodeRs}{8-digit}` (e.g. `RS0100000001`). Passing the full pasienId as keyword means no ID match — falls through to name search, missing the today registration.

**Solution:** Extract the trailing 8-digit numeric suffix from `item.patientId` before passing as the `searchPatientContext` keyword. The filter against `fresh.registrations` still compares full `patientId` — unchanged.

**Files:**
- Modify: `src/composables/useKioskRegistration.ts` (add helper + use in `confirmPatientContext`)
- Test: `src/composables/__tests__/useKioskRegistration.spec.ts`

- [ ] **Step 1: Add helper**

```typescript
function normalizePasienIdKeyword(value: string): string {
  const digits = value.replace(/\D/g, '')
  return digits ? digits.slice(-8) : value
}
```

- [ ] **Step 2: Use in confirmPatientContext (line ~440)**

```typescript
const fresh = await deps.searchPatientContext({
  keyword: normalizePasienIdKeyword(item.patientId),
  businessDate: tgl,
})
```

- [ ] **Step 3: Update tests to assert normalized keyword**

In the re-query test, `contextItem.patientId` uses `PT1` — change expectation to `keyword: '1'`. Add an explicit pasienId-with-prefix test using patientId `RS0100000001` asserting the keyword is `00000001`.

- [ ] **Step 4: Verify**

Run: `pnpm --filter kiosk-web exec vitest run src/composables/__tests__/useKioskRegistration.spec.ts` (all pass)
Run: `pnpm turbo run typecheck test`

- [ ] **Step 5: Commit**

```bash
git add apps/kiosk-web/src/composables/useKioskRegistration.ts apps/kiosk-web/src/composables/__tests__/useKioskRegistration.spec.ts
git commit -m "fix: normalize pasienId keyword to numeric suffix for context re-query"
```