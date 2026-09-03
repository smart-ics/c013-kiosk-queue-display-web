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

