# Task 2 Report: `@aq/api-client` — HIS Registration Detail Reader

## Status

DONE

## What changed

- **`packages/api-client/src/his.ts`**: Added `getRegistrationPrintData(regId: string): Promise<RegistrationPrintData>` to the HIS API.
  - Imported `registrationPrintDataSchema` and `RegistrationPrintData` from `@aq/shared-types`.
  - Added a private `regGetResponseSchema` covering the required backend fields: `regId`, `noAntrian`, `pasien`, `tipeJaminan`, `sjpNo`, `layanan`, `dokter`.
  - Calls `client.getJson('Reg/{id}', regGetResponseSchema)` and maps the response to `RegistrationPrintData`, converting an empty `sjpNo` to `undefined` for `noSep`.
- **`packages/api-client/src/__tests__/his.spec.ts`**: Added a `hisClient` test helper and a new test `loads and maps registration print data by registration id` using the brief's fixture and assertions.

## Fail-step output

Ran `pnpm --filter @aq/api-client exec vitest run src/__tests__/his.spec.ts`:

```
 RUN  v3.2.7 E:/PROJECT/ICS/PROJECT-ACTIVE/kiosk-display-config/c013-kiosk-queue-display-web/packages/api-client

 ❯ src/__tests__/his.spec.ts (13 tests | 1 failed) 95ms
   × createHisApi > loads and maps registration print data by registration id 14ms
     → api.getRegistrationPrintData is not a function
   ✓ createHisApi > searches booking with tglBerobat + keyword in path 43ms
   ✓ createHisApi > posts booking-assistance and parses queue ticket 3ms
   ✓ createHisApi > fetches and filters active clinics via listPoli 5ms
   ✓ createHisApi > fetches doctors via JadwalPraktek/layanan and sets isPraktekHariIni from listHari 6ms
   ✓ createHisApi > fetches doctor schedule via POST PraktekDokter/dokter and maps to JadwalItem 3ms
   ✓ createJetliApi > fetches nullable group jaminan map 3ms
   ✓ createJetliApi > lists existing SEPs by noPeserta 3ms
   ✓ createJetliApi > fetches nullable SEP by regId 2ms
   ✓ createJetliApi > fetches fingerprint status and normalizes id 3ms
   ✓ createJetliApi > fetches peserta rujukan and SKDP list 2ms
   ✓ createJetliApi > creates a SEP and tolerates a plain-string business error 3ms
   ✓ createJetliApi > uploads SEP via PATCH with sepId and regId 3ms

 Test Files  1 failed (1)
      Tests  1 failed | 12 passed (13)
```

## Pass-step output

Ran `pnpm --filter @aq/api-client exec vitest run src/__tests__/his.spec.ts`:

```
 RUN  v3.2.7 E:/PROJECT/ICS/PROJECT-ACTIVE/kiosk-display-config/c013-kiosk-queue-display-web/packages/api-client

 ✓ src/__tests__/his.spec.ts (13 tests) 92ms

 Test Files  1 passed (1)
      Tests  13 passed (13)
```

## Additional verification

- `pnpm --filter @aq/api-client exec tsc -p tsconfig.json --noEmit` → clean (no output, no errors).

## Commit

- `5bae1c8` — `feat(api-client): read registration print details`
- Staged exactly the two intended files: `packages/api-client/src/his.ts` (+42 lines) and `packages/api-client/src/__tests__/his.spec.ts` (+37 lines).

## Concerns

- The fail-step run printed a trailing `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL Command "vitest" not found` after the test output (a pnpm `exec` exit-code quirk on Windows); the tests did run and fail as expected. The pass run had no such error.
