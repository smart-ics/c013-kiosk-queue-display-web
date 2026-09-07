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

