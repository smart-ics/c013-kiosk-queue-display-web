### Task 3: Integrate the Resolver into the Kiosk Failure Flow

**Files:**
- Modify: `apps/kiosk-web/src/views/KioskPage.vue`
- Modify: `apps/kiosk-web/src/views/steps/FailureStep.vue`
- Create: `apps/kiosk-web/src/views/steps/__tests__/FailureStep.spec.ts`

**Interfaces:**
- Consumes `configService.getConfig().fallbackServicePoints?.bookingFailure`.
- Produces a `recommendedServicePointId?: string` prop for `FailureStep`; this is a visual recommendation, not an automatic queue submission.

- [ ] **Step 1: Write the failing FailureStep test**

Create `apps/kiosk-web/src/views/steps/__tests__/FailureStep.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { AdmissionServicePoint } from '@aq/shared-types'
import FailureStep from '../FailureStep.vue'
import type { FailureContext } from '../../../composables/useKioskRegistration'

const offerings: AdmissionServicePoint[] = [
  { servicePointId: 'SP-A', displayName: 'Admisi Umum', queuePrefix: 'A', status: 'Active' },
  { servicePointId: 'SP-B', displayName: 'Admisi BPJS', queuePrefix: 'B', status: 'Active' },
]

const errorContext: FailureContext = { code: 'BACKEND_ERROR', message: 'gagal' }

function mountStep(props: { recommendedServicePointId?: string } = {}) {
  return mount(FailureStep, {
    props: { errorContext, offerings, pending: false, ...props },
  })
}

describe('FailureStep recommended service point', () => {
  it('marks the recommended card and does not auto-emit', () => {
    const wrapper = mountStep({ recommendedServicePointId: 'SP-B' })
    const recommended = wrapper.findAll('[data-recommended="true"]')

    expect(recommended).toHaveLength(1)
    expect(recommended[0].attributes('data-testid')).toBe('assist-SP-B')
    expect(wrapper.emitted('selectServicePoint')).toBeUndefined()
  })

  it('marks no card when no recommendation is given', () => {
    const wrapper = mountStep()

    expect(wrapper.findAll('[data-recommended="true"]')).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```text
pnpm --filter kiosk-web exec vitest run src/views/steps/__tests__/FailureStep.spec.ts
```

Expected: FAIL because `FailureStep` does not yet render a `data-recommended` marker.

- [ ] **Step 3: Resolve the recommendation in `KioskPage.vue`**

Import the helper. Use the existing `offerings` computed value and do not make another Service Point API call:

```ts
const recommendedFallbackServicePointId = computed(() =>
  resolveFallbackServicePointId(
    configService.getConfig().fallbackServicePoints?.bookingFailure,
    offerings.value,
  ),
)
```

Pass it to `FailureStep`:

```vue
:recommended-service-point-id="recommendedFallbackServicePointId"
```

- [ ] **Step 4: Render the recommendation in `FailureStep.vue`**

Add the optional prop to the existing `defineProps` block:

```ts
recommendedServicePointId?: string
```

On the assistance card button, mark only the matching card with a stable attribute. Keep the existing click handler unchanged:

```vue
:data-recommended="sp.servicePointId === recommendedServicePointId ? 'true' : undefined"
```

Add a visible badge inside the card content so the recommendation is obvious to the kiosk user:

```vue
<span
  v-if="sp.servicePointId === recommendedServicePointId"
  class="recommended-badge"
  style="display:inline-block;margin-top:4px;background:var(--brand-soft);color:var(--brand-strong);padding:2px 10px;border-radius:999px;font-weight:700;font-size:0.8rem;"
>
  Rekomendasi
</span>
```

The existing click handler must remain unchanged. The visual marker is the only behavior change; the user still chooses the service point explicitly.

- [ ] **Step 5: Run the focused tests**

Run:

```text
pnpm --filter kiosk-web exec vitest run src/views/steps/__tests__/FailureStep.spec.ts
pnpm --filter kiosk-web exec vitest run src/lib/__tests__/fallbackServicePoint.spec.ts
```

Expected: PASS.

