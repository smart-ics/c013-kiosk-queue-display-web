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

