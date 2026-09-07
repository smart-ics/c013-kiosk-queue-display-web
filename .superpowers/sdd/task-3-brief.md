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

