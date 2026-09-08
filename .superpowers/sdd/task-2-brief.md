### Task 2: Implement the Pure Recommendation Resolver

**Files:**
- Create: `apps/kiosk-web/src/lib/fallbackServicePoint.ts`
- Create: `apps/kiosk-web/src/lib/__tests__/fallbackServicePoint.spec.ts`

**Interfaces:**
- Consumes `AdmissionServicePoint[]` from the existing `offerings` computed value.
- Produces `string | undefined` through:

```ts
export function resolveFallbackServicePointId(
  configuredId: string | undefined,
  offerings: readonly AdmissionServicePoint[],
): string | undefined
```

- [ ] **Step 1: Write resolver tests**

Create the fixture and the five cases:

```ts
import { describe, expect, it } from 'vitest'
import type { AdmissionServicePoint } from '@aq/shared-types'
import { resolveFallbackServicePointId } from '../fallbackServicePoint'

const offerings: AdmissionServicePoint[] = [
  { servicePointId: 'SP-A', displayName: 'Admisi Umum', queuePrefix: 'A', status: 'Active' },
  { servicePointId: 'SP-B', displayName: 'Admisi BPJS', queuePrefix: 'B', status: 'Active' },
]

describe('resolveFallbackServicePointId', () => {
  it('returns the configured id when it is an active offering', () => {
    expect(resolveFallbackServicePointId('SP-A', offerings)).toBe('SP-A')
  })

  it('returns undefined when no assignment is configured', () => {
    expect(resolveFallbackServicePointId(undefined, offerings)).toBeUndefined()
  })

  it('returns undefined when the assignment is empty', () => {
    expect(resolveFallbackServicePointId('', offerings)).toBeUndefined()
  })

  it('returns undefined when the configured id is not an offering of this kiosk', () => {
    expect(resolveFallbackServicePointId('SP-MISSING', offerings)).toBeUndefined()
  })

  it('trims the configured id before matching', () => {
    expect(resolveFallbackServicePointId(' SP-B ', offerings)).toBe('SP-B')
  })
})
```

`offerings` already contains only active, mapped Service Points, so an "inactive" assignment is covered by the `SP-MISSING` case: it simply is not an offering.

- [ ] **Step 2: Run the resolver tests and verify they fail**

Run:

```text
pnpm --filter kiosk-web exec vitest run src/lib/__tests__/fallbackServicePoint.spec.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the minimal pure helper**

```ts
import type { AdmissionServicePoint } from '@aq/shared-types'

export function resolveFallbackServicePointId(
  configuredId: string | undefined,
  offerings: readonly AdmissionServicePoint[],
): string | undefined {
  const normalizedId = configuredId?.trim()
  if (!normalizedId) return undefined

  return offerings.some((item) => item.servicePointId === normalizedId)
    ? normalizedId
    : undefined
}
```

The helper must not call an API, mutate `offerings`, or implement a second Service Point lookup.

- [ ] **Step 4: Run the resolver tests**

Run:

```text
pnpm --filter kiosk-web exec vitest run src/lib/__tests__/fallbackServicePoint.spec.ts
```

Expected: PASS.

