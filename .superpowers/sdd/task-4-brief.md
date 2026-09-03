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

