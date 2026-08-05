# Task 3 Report: `@aq/api-client` — HIS + JETLI clients

## Status: DONE

## What changed

- **Created** `packages/api-client/src/his.ts` (verbatim from brief): `createHisApi(client)` → `HisApi` and `createJetliApi(client)` → `JetliApi`, plus exported types `HisApi` / `JetliApi`. Consumes `AdmissionQueueClient` (`getJson` / `postJson`) and schemas/types from `@aq/shared-types` (all verified present and exported).
- **Modified** `packages/api-client/src/index.ts`: appended the brief's Step 4 export block (`createHisApi`, `createJetliApi`, `type HisApi`, `type JetliApi` from `./his`) at the end. Existing exports untouched.
- **Created** `packages/api-client/src/__tests__/his.spec.ts` (verbatim from brief): 3 tests (booking search path, booking-assistance POST + queue ticket parse, nullable group jaminan map).

No `package.json` changes needed; vitest + test script already configured.

## Fail-step output

Command: `pnpm --filter @aq/api-client exec vitest run src/__tests__/his.spec.ts`

```
 RUN  v3.2.7 E:/PROJECT/ICS/FE/c013-kiosk-queue-display-web/packages/api-client

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/__tests__/his.spec.ts [ src/__tests__/his.spec.ts ]
Error: Cannot find module '../his' imported from 'E:/PROJECT/ICS/FE/c013-kiosk-queue-display-web/packages/api-client/src/__tests__/his.spec.ts'
  ❯ src/__tests__/his.spec.ts:2:1
    1| import { describe, expect, it, vi } from 'vitest'
    2| import { createHisApi, createJetliApi } from '../his'
     | ^
    3| import { AdmissionQueueClient } from '../http'
    4| import type { IAuthTokenProvider } from '@aq/auth'

 Test Files  1 failed (1)
      Tests  no tests
   Start at 09:22:47
   Duration 1.25s (transform 220ms, setup 0ms, collect 0ms, tests 0ms, environment 0ms, prepare 388ms)

Caused by: Error: Failed to load url ../his (resolved id: ../his) in E:/PROJECT/ICS/FE/c013-kiosk-queue-display-web/packages/api-client/src/__tests__/his.spec.ts. Does the file exist?
  ❯ loadAndTransform ../../node_modules/.pnpm/vite@7.3.6_@types+node@24.13.3/node_modules/vite/dist/node/chunks/config.js:22739:33
```

## Pass-step output

Command: `pnpm --filter @aq/api-client exec vitest run src/__tests__/his.spec.ts`

```
 RUN  v3.2.7 E:/PROJECT/ICS/FE/c013-kiosk-queue-display-web/packages/api-client

 ✓ src/__tests__/his.spec.ts (3 tests) 66ms

 Test Files  1 passed (1)
      Tests  3 passed (3)
   Start at 09:23:20
   Duration 1.83s (transform 344ms, setup 0ms, collect 642ms, tests 66ms, environment 1ms, prepare 342ms)
```

## Verification beyond the brief

- Full `@aq/api-client` suite: 4 files / 15 tests all pass (no regressions in errors, admissionQueue, configuration specs).
- `pnpm --filter @aq/api-client typecheck` (`tsc -p tsconfig.json --noEmit`): clean, no errors.

## Commit

`e326e9bb98f30febd32db77565bc39772a470a69` — `feat(api-client): HIS and JETLI registration clients`

Contains exactly 3 files (209 insertions): `src/__tests__/his.spec.ts`, `src/his.ts`, `src/index.ts`. No other files staged or committed.

## Concerns

- None blocking. Per the brief's own code comments, HIS service-catalog paths and `/direct` payload shapes remain assumed shapes (ADR-006 / ADR-002 open items) and must be confirmed against the real HIS API. `bookingAssistanceBodySchema` validation happens client-side before the POST (`bookingAssistanceBodySchema.parse`), so an out-of-shape body throws ZodError rather than an `ApiClientError`.
- Test payloads were verified against the actual shared-types schemas before writing; all shapes satisfy the schemas.
