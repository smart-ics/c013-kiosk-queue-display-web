# Reg ID Direct Reprint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a kiosk user search an existing Reg ID, review its authoritative registration details, and explicitly reprint its registration ticket without entering the new-registration flow.

**Architecture:** Reuse the existing patient-context search to identify an exact Registration result, then call the existing HIS `GET /api/Reg/{id}` read endpoint. Add a focused validated print-data mapping in `@aq/shared-types`/`@aq/api-client`, keep the new data in `useKioskRegistration`, and render a dedicated `REGISTRATION_REPRINT` step. Existing registration creation and auto-print behavior remain unchanged.

**Tech Stack:** Vue 3 Composition API, TypeScript, Zod, Vitest, `@aq/api-client`, `@aq/shared-types`, local print proxy.

## Global Constraints

- Use pnpm v10; run commands through pnpm workspace scripts.
- Do not create a second registration or queue entry for reprint.
- Do not fabricate `noAntrian`, SEP, or receipt fields; use validated data from `GET /api/Reg/{id}`.
- Preserve existing booking, patient-context, walk-in, biometric, SEP, and assistance behavior.
- Keep `RegistrationReceiptData.noAntrian` required as a number.
- `REGISTRATION_REPRINT` is a post-search screen and is intentionally excluded from the five-step registration stepper.
- The user must press `Cetak ulang`; entering the screen must not print automatically.

---

### Task 1: Add Registration Detail Contract

**Files:**
- Modify: `packages/shared-types/src/index.ts` near the existing HIS registration schemas
- Test: `packages/shared-types/src/__tests__/hisSchemas.spec.ts`

**Interfaces:**
- Produces `registrationPrintDataSchema` and `RegistrationPrintData` with:
  `regId: string`, `noAntrian: number`, `pasienName: string`, optional `pasienId`, `tglLahir`, `tipeJaminanName`, `noSep`, `serviceName`, and `dokterName`.
- The schema must reject missing `regId`, missing `pasienName`, or non-numeric/missing `noAntrian`.

- [ ] **Step 1: Write failing schema tests**

Add tests that parse a complete `RegistrationPrintData` and reject an object with no `noAntrian`.

```ts
it('parses complete registration print data', () => {
  expect(
    registrationPrintDataSchema.parse({
      regId: 'RG12345678',
      noAntrian: 12,
      pasienName: 'Andi',
      pasienId: 'PT1',
      tglLahir: '1990-01-01',
      tipeJaminanName: 'Umum',
      noSep: undefined,
      serviceName: 'Poli Jantung',
      dokterName: 'Dr. X',
    }),
  ).toMatchObject({ regId: 'RG12345678', noAntrian: 12 })
})

it('rejects registration print data without a queue number', () => {
  expect(() => registrationPrintDataSchema.parse({ regId: 'RG1', pasienName: 'Andi' })).toThrow()
})
```

- [ ] **Step 2: Run the focused schema test and verify it fails**

Run: `pnpm --filter @aq/shared-types exec vitest run src/__tests__/hisSchemas.spec.ts`

Expected: FAIL because `registrationPrintDataSchema` is not defined.

- [ ] **Step 3: Implement the focused schema and type**

Add the Zod object next to the existing HIS response schemas. Keep receipt data focused; do not expose the full backend `RegGetResponse` as an app-facing type.

- [ ] **Step 4: Run the focused schema test and verify it passes**

Run: `pnpm --filter @aq/shared-types exec vitest run src/__tests__/hisSchemas.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared-types/src/index.ts packages/shared-types/src/__tests__/hisSchemas.spec.ts
git commit -m "feat(shared-types): add registration print data contract"
```

### Task 2: Add HIS Registration Detail Reader

**Files:**
- Modify: `packages/api-client/src/his.ts`
- Test: `packages/api-client/src/__tests__/his.spec.ts`

**Interfaces:**
- Produces `getRegistrationPrintData(regId: string): Promise<RegistrationPrintData>` on the HIS API.
- Calls the existing backend route `GET /api/Reg/{id}`.
- Validates the response fields from `RegGetResponse`: `regId`, `noAntrian`, `pasien.pasienName`, `pasien.pasienId`, `pasien.tglLahir`, `tipeJaminan.tipeJaminanName`, `sjpNo`, `layanan.layananName`, and `dokter.ppaName`.

- [ ] **Step 1: Write the failing API-client test**

Use the existing `hisClient` test helper and a JSend response fixture shaped like the backend `RegGetResponse`. Assert the route and mapped values.

```ts
it('loads and maps registration print data by registration id', async () => {
  const { fetchImpl, api } = hisClient({
    regId: 'RG12345678',
    noAntrian: 12,
    pasien: { pasienId: 'PT1', pasienName: 'Andi', tglLahir: '1990-01-01' },
    tipeJaminan: { tipeJaminanId: '00000', tipeJaminanName: 'Umum' },
    sjpNo: '',
    layanan: { layananId: 'LY1', layananName: 'Poli Jantung' },
    dokter: { ppaId: 'DP1', ppaName: 'Dr. X' },
  })

  await expect(api.getRegistrationPrintData('RG12345678')).resolves.toEqual({
    regId: 'RG12345678',
    noAntrian: 12,
    pasienName: 'Andi',
    pasienId: 'PT1',
    tglLahir: '1990-01-01',
    tipeJaminanName: 'Umum',
    noSep: undefined,
    serviceName: 'Poli Jantung',
    dokterName: 'Dr. X',
  })
  expect(String(fetchImpl.mock.calls[0]?.[0])).toContain('Reg/RG12345678')
})
```

- [ ] **Step 2: Run the focused API-client test and verify it fails**

Run: `pnpm --filter @aq/api-client exec vitest run src/__tests__/his.spec.ts`

Expected: FAIL because the HIS API has no `getRegistrationPrintData` method.

- [ ] **Step 3: Implement validation and mapping**

Add a private response schema in `his.ts` for only the required fields, import `registrationPrintDataSchema`/`RegistrationPrintData`, call `client.getJson('Reg/{id}', responseSchema)`, and map to the focused type. The Zod schema must reject missing `noAntrian` instead of converting it to an empty value.

- [ ] **Step 4: Run the focused API-client test and verify it passes**

Run: `pnpm --filter @aq/api-client exec vitest run src/__tests__/his.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/api-client/src/his.ts packages/api-client/src/__tests__/his.spec.ts
git commit -m "feat(api-client): read registration print details"
```

### Task 3: Fix Flow Transitions And Receipt Type

**Files:**
- Modify: `apps/kiosk-web/src/lib/flow.ts`
- Test: `apps/kiosk-web/src/lib/__tests__/flow.spec.ts`
- Modify: `apps/kiosk-web/src/lib/registrationReceipt.ts`
- Test: `apps/kiosk-web/src/lib/__tests__/registrationReceipt.spec.ts`

**Interfaces:**
- `canTransition('HOME', 'REGISTRATION_REPRINT')` returns `true`.
- `REGISTRATION_REPRINT` remains terminal back to `HOME`.
- `RegistrationReceiptData.noAntrian` is `number`, and rendering uses `String(data.noAntrian)`.

- [ ] **Step 1: Add failing flow and receipt regression tests**

Add assertions for `HOME -> REGISTRATION_REPRINT` and for a numeric queue number being rendered. Add a regression expectation that the receipt source type does not accept missing queue numbers through the public function signature.

- [ ] **Step 2: Run focused tests and verify the transition test fails**

Run: `pnpm --filter kiosk-web exec vitest run src/lib/__tests__/flow.spec.ts src/lib/__tests__/registrationReceipt.spec.ts`

Expected: flow test FAILS until the HOME transition is added; receipt test exposes the nullable current type if the working-tree relaxation is present.

- [ ] **Step 3: Implement the minimal corrections**

Add `REGISTRATION_REPRINT` to `FLOW_TRANSITIONS.HOME`. Remove nullable/optional `noAntrian` from `RegistrationReceiptData` and remove the blank-string fallback in `renderRegistrationReceiptPng`. Do not alter the existing successful-registration print path.

- [ ] **Step 4: Run focused tests and verify they pass**

Run: `pnpm --filter kiosk-web exec vitest run src/lib/__tests__/flow.spec.ts src/lib/__tests__/registrationReceipt.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/kiosk-web/src/lib/flow.ts apps/kiosk-web/src/lib/__tests__/flow.spec.ts apps/kiosk-web/src/lib/registrationReceipt.ts apps/kiosk-web/src/lib/__tests__/registrationReceipt.spec.ts
git commit -m "fix(kiosk-web): require queue number for registration receipts"
```

### Task 4: Route Existing Reg IDs In The Registration Composable

**Files:**
- Modify: `apps/kiosk-web/src/composables/useKioskRegistration.ts`
- Test: `apps/kiosk-web/src/composables/__tests__/useKioskRegistration.spec.ts`

**Interfaces:**
- Extend `KioskRegistrationDeps` with `getRegistrationPrintData(regId: string): Promise<RegistrationPrintData>`.
- Expose `registrationReprintData: Ref<RegistrationPrintData | null>`.
- Expose `reprintExistingRegistration(): Promise<void>`; it must call the existing `printRegistration` dependency using `registrationReprintData` and must do nothing when the data ref is null.
- Preserve existing `reprintRegistration()` for `REGISTRATION_SUCCESS`.

- [ ] **Step 1: Add failing composable tests**

Add fixtures and tests for these exact cases:

```ts
it('routes an exact registration result from HOME to reprint without registering', async () => {
  const deps = makeDeps({
    searchBooking: vi.fn(async () => []),
    searchPatientContext: vi.fn(async () => ({ ...registrationContextResponse })),
    getRegistrationPrintData: vi.fn(async () => registrationPrintData),
  })
  const reg = useKioskRegistration(deps)

  await reg.submitBookingKeyword('RG12345678')

  expect(reg.flow.value).toBe('REGISTRATION_REPRINT')
  expect(reg.registrationReprintData.value).toEqual(registrationPrintData)
  expect(deps.getRegistrationPrintData).toHaveBeenCalledWith('RG12345678')
  expect(deps.registerBooking).not.toHaveBeenCalled()
  expect(deps.registerWalkin).not.toHaveBeenCalled()
  expect(deps.printRegistration).not.toHaveBeenCalled()
})

it('falls back when no exact registration exists', async () => {
  const reg = useKioskRegistration(makeDeps({ searchBooking: vi.fn(async () => []) }))
  await reg.submitBookingKeyword('RG12345678')
  expect(reg.flow.value).not.toBe('REGISTRATION_REPRINT')
})

it('fails when multiple exact registration results exist', async () => {
  const deps = makeDeps({
    searchBooking: vi.fn(async () => []),
    searchPatientContext: vi.fn(async () => multipleRegistrationContextResponse),
  })
  const reg = useKioskRegistration(deps)
  await reg.submitBookingKeyword('RG12345678')
  expect(reg.flow.value).toBe('FAILURE')
  expect(deps.getRegistrationPrintData).not.toHaveBeenCalled()
})

it('fails when registration print data has no queue number', async () => {
  const deps = makeDeps({
    searchBooking: vi.fn(async () => []),
    searchPatientContext: vi.fn(async () => registrationContextResponse),
    getRegistrationPrintData: vi.fn(async () => {
      throw new Error('Invalid registration print data')
    }),
  })
  const reg = useKioskRegistration(deps)
  await reg.submitBookingKeyword('RG12345678')
  expect(reg.flow.value).toBe('FAILURE')
})

it('does not auto-print on the existing-registration path', async () => {
  const deps = makeDeps({
    searchBooking: vi.fn(async () => []),
    searchPatientContext: vi.fn(async () => registrationContextResponse),
    getRegistrationPrintData: vi.fn(async () => registrationPrintData),
  })
  const reg = useKioskRegistration(deps)
  await reg.submitBookingKeyword('RG12345678')
  expect(deps.printRegistration).not.toHaveBeenCalled()
})
```

The tests must also cover a `bestMatch` Registration when it is the exact requested ID, and must reject a `bestMatch` Booking or Patient as a direct-reprint candidate.

- [ ] **Step 2: Run the focused composable test and verify it fails**

Run: `pnpm --filter kiosk-web exec vitest run src/composables/__tests__/useKioskRegistration.spec.ts`

Expected: Type/test failures because the dependency and reprint state do not exist.

- [ ] **Step 3: Implement exact-match routing**

Normalize the input as currently done. When the canonical Reg ID path reaches patient-context search, select matching `registrations.items` using the normalized ID and `registrationId`. Apply these rules:

- one exact Registration: call `getRegistrationPrintData`, assign `registrationReprintData`, transition from either `HOME` or `PATIENT_CONTEXT_SEARCH` to `REGISTRATION_REPRINT`;
- zero exact registrations: retain current patient-context fallback;
- more than one exact registration: call `setFailure('UNKNOWN_ERROR', 'Ditemukan lebih dari satu registrasi. Hubungi petugas.')`;
- detail lookup rejection or invalid data: map to the existing failure behavior;
- never call `registerBooking`, `registerWalkin`, or `printRegistration` during lookup.

Clear `registrationReprintData` in `goHome()` and before a new search. Keep the existing `reprintRegistration()` method separate from the new reprint action/data.

- [ ] **Step 4: Update all test dependency factories**

Provide a default `getRegistrationPrintData` mock in `makeDeps` and any other `KioskRegistrationDeps` factories so existing tests retain their current behavior.

- [ ] **Step 5: Run the composable tests and verify they pass**

Run: `pnpm --filter kiosk-web exec vitest run src/composables/__tests__/useKioskRegistration.spec.ts`

Expected: PASS, including all existing booking/walk-in tests.

- [ ] **Step 6: Commit**

```bash
git add apps/kiosk-web/src/composables/useKioskRegistration.ts apps/kiosk-web/src/composables/__tests__/useKioskRegistration.spec.ts
git commit -m "feat(kiosk-web): route existing registration ids to reprint"
```

### Task 5: Build The Dedicated Reprint Step

**Files:**
- Create: `apps/kiosk-web/src/views/steps/RegistrationReprintStep.vue`
- Test: `apps/kiosk-web/src/views/steps/__tests__/RegistrationReprintStep.spec.ts`

**Interfaces:**
- Props: `registration: RegistrationPrintData`, `pending: boolean`, `succeeded: boolean`, `error: string | null`.
- Emits: `reprint: []`, `finish: []`.

- [ ] **Step 1: Write component tests**

Mount the component and assert Reg ID, queue number, patient, service, and doctor are visible. Assert `reprint` is emitted only by clicking `Cetak ulang`, that the button is disabled while pending, and that `finish` is emitted by `Kembali ke menu`.

- [ ] **Step 2: Run the component test and verify it fails**

Run: `pnpm --filter kiosk-web exec vitest run src/views/steps/__tests__/RegistrationReprintStep.spec.ts`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the focused component**

Use the existing `panel`, `status`, `actions`, and button classes. Show explicit copy such as `Cetak Ulang Karcis Registrasi`, display the validated queue number and registration details, and do not invoke printing from lifecycle hooks.

- [ ] **Step 4: Run the component test and verify it passes**

Run: `pnpm --filter kiosk-web exec vitest run src/views/steps/__tests__/RegistrationReprintStep.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/kiosk-web/src/views/steps/RegistrationReprintStep.vue apps/kiosk-web/src/views/steps/__tests__/RegistrationReprintStep.spec.ts
git commit -m "feat(kiosk-web): add registration reprint step"
```

### Task 6: Wire The Kiosk Page And Print Action

**Files:**
- Modify: `apps/kiosk-web/src/views/KioskPage.vue`
- Test: `apps/kiosk-web/src/views/__tests__/KioskPage.spec.ts`

**Interfaces:**
- Pass `getRegistrationPrintData: (regId) => getHisApi().getRegistrationPrintData(regId)` into `useKioskRegistration`.
- Render `RegistrationReprintStep` for `REGISTRATION_REPRINT`.
- Add a page handler that invokes `registration.reprintExistingRegistration()`; the composable owns the adaptation to the existing `selfPrint.printRegistration` dependency.

- [ ] **Step 1: Add failing page integration tests**

Assert that `REGISTRATION_REPRINT` renders the dedicated component, its details are visible, no print call occurs on render, and clicking `Cetak ulang` invokes the print operation once with `noAntrian` from the loaded data. Assert `Kembali ke menu` resets to home.

- [ ] **Step 2: Run the page test and verify it fails**

Run: `pnpm --filter kiosk-web exec vitest run src/views/__tests__/KioskPage.spec.ts`

Expected: FAIL because the component is not wired and the dependency is not passed.

- [ ] **Step 3: Wire the data and handlers**

Import and render `RegistrationReprintStep` before the existing registration-success branch. Do not add `REGISTRATION_REPRINT` to the normal five-step stepper list. Add a handler for explicit reprint and a finish handler using `onHome`.

- The composable's `reprintExistingRegistration()` adapts `RegistrationPrintData` to the existing `RegistrationPrintContext` as `{ result: { regId, noAntrian }, pasienName, pasienId, tglLahir, tipeJaminanName, noSep, serviceName, dokterName }`; do not weaken the receipt type.

- [ ] **Step 4: Run the page test and verify it passes**

Run: `pnpm --filter kiosk-web exec vitest run src/views/__tests__/KioskPage.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/kiosk-web/src/views/KioskPage.vue apps/kiosk-web/src/views/__tests__
git commit -m "feat(kiosk-web): wire direct registration reprint flow"
```

### Task 7: Full Verification And Review

**Files:**
- Modify: only files required by failing verification; do not alter unrelated worktree changes.

- [ ] **Step 1: Run kiosk tests**

Run: `pnpm --filter kiosk-web test`

Expected: PASS.

- [ ] **Step 2: Run kiosk typecheck and build**

Run: `pnpm --filter kiosk-web typecheck`

Expected: PASS with no TypeScript/Vue diagnostics.

Run: `pnpm --filter kiosk-web build`

Expected: PASS with a production Vite bundle.

- [ ] **Step 3: Run shared package/API-client verification**

Run: `pnpm --filter @aq/shared-types test`

Expected: PASS.

Run: `pnpm --filter @aq/api-client test`

Expected: PASS.

Run: `pnpm --filter @aq/shared-types typecheck`

Expected: PASS.

Run: `pnpm --filter @aq/api-client typecheck`

Expected: PASS.

- [ ] **Step 4: Inspect the final diff**

Run: `git status --short` and `git diff --check`.

Expected: only the intended contract, API client, flow, composable, UI, and test changes are present; no secrets, generated output, or unrelated user changes are staged.

- [ ] **Step 5: Commit any verification fixes**

```bash
git add apps/kiosk-web/src apps/kiosk-web/package.json packages/shared-types/src packages/api-client/src
git commit -m "test(kiosk-web): verify registration reprint flow"
```
