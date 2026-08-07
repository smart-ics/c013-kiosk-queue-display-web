### Task 5: `lib/failureCode.ts` (client-side diagnostics)

**Files:**
- Create: `apps/kiosk-web/src/lib/failureCode.ts`
- Create: `apps/kiosk-web/src/lib/__tests__/failureCode.spec.ts`

**Interfaces:**
- Consumes: `ApiClientError`, `isSequenceExhausted` from `@aq/api-client`
- Produces: `FAILURE_CODES`, `FailureCode`, `mapErrorToFailureCode(error): FailureCode`

- [ ] **Step 1: Write the failing test**

Create `apps/kiosk-web/src/lib/__tests__/failureCode.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ApiClientError } from '@aq/api-client'
import { FAILURE_CODES, mapErrorToFailureCode } from '../failureCode'

describe('mapErrorToFailureCode', () => {
  it('maps network errors to BACKEND_ERROR', () => {
    expect(mapErrorToFailureCode(new ApiClientError('Failed to fetch', 0))).toBe(
      FAILURE_CODES.BACKEND_ERROR,
    )
  })

  it('maps DUPLICATE_REGISTRATION code', () => {
    const err = new ApiClientError('Already registered', 409, 'DUPLICATE_REGISTRATION')
    expect(mapErrorToFailureCode(err)).toBe(FAILURE_CODES.DUPLICATE_REGISTRATION)
  })

  it('maps sequence-exhausted to SCHEDULE_FULL', () => {
    const err = new ApiClientError('Full', 503)
    expect(mapErrorToFailureCode(err)).toBe(FAILURE_CODES.SCHEDULE_FULL)
  })

  it('falls back to UNKNOWN_ERROR', () => {
    expect(mapErrorToFailureCode(new Error('boom'))).toBe(FAILURE_CODES.UNKNOWN_ERROR)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter kiosk-web exec vitest run src/lib/__tests__/failureCode.spec.ts`
Expected: FAIL — cannot find module `../failureCode`.

- [ ] **Step 3: Create `failureCode.ts`**

Create `apps/kiosk-web/src/lib/failureCode.ts`:

```ts
import { ApiClientError, isSequenceExhausted } from '@aq/api-client'

export const FAILURE_CODES = {
  BIOMETRIC_FAILED: 'BIOMETRIC_FAILED',
  BIOMETRIC_TIMEOUT: 'BIOMETRIC_TIMEOUT',
  BPJS_VALIDATION_FAILED: 'BPJS_VALIDATION_FAILED',
  BOOKING_NOT_FOUND: 'BOOKING_NOT_FOUND',
  SCHEDULE_FULL: 'SCHEDULE_FULL',
  DUPLICATE_REGISTRATION: 'DUPLICATE_REGISTRATION',
  BACKEND_ERROR: 'BACKEND_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const

export type FailureCode = (typeof FAILURE_CODES)[keyof typeof FAILURE_CODES]

export function mapErrorToFailureCode(error: unknown): FailureCode {
  if (error instanceof ApiClientError) {
    if (error.status === 0) return FAILURE_CODES.BACKEND_ERROR
    if (error.code === 'DUPLICATE_REGISTRATION') return FAILURE_CODES.DUPLICATE_REGISTRATION
  }
  if (isSequenceExhausted(error)) return FAILURE_CODES.SCHEDULE_FULL
  return FAILURE_CODES.UNKNOWN_ERROR
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter kiosk-web exec vitest run src/lib/__tests__/failureCode.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/kiosk-web/src/lib/failureCode.ts apps/kiosk-web/src/lib/__tests__/failureCode.spec.ts
git commit -m "feat(kiosk-web): client-side failure code mapping"
```
