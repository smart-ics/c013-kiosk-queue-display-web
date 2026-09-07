# Service Point Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow each kiosk deployment to manually configure a recommended fallback service point for booking-registration failures while preserving the current mapped-service-point fallback, and add Service Point master-data CRUD to `config-web`.

**Architecture:** `kiosk-web/public/global_config.json` remains the manual runtime configuration source for fallback assignments, structured as `fallbackServicePoints.bookingFailure` so future edge cases can be added as sibling keys. `kiosk-web` validates the configured assignment against the current kiosk's active mapped service points returned by the existing API. If the configured value is absent or invalid, the existing `offerings` list is retained and no card is recommended. `config-web` receives a separate Service Point master-data CRUD screen that consumes the existing BE endpoints; it does not write `global_config.json`.

**Tech Stack:** Vue 3, TypeScript, Zod, Vitest, TanStack Vue Query, existing `@aq/app-config`, `@aq/api-client`, and `@aq/shared-types` contracts.

## Global Constraints

- Do not modify `b09-bilreg-api`.
- Do not add new BE endpoints; consume only the existing Service Point list and upsert operations.
- All `global_config.json` changes are performed manually by the user after deployment; `config-web` must not write that file.
- `config-web` Service Point CRUD is master-data maintenance only; it must not read or write `fallbackServicePoints`.
- Keep `global_config.json` limited to runtime/deployment configuration; Service Point master data remains owned by the existing BE API.
- Do not automatically create an assistance queue from the recommended service point; the kiosk user must still click a card.
- If the configured fallback assignment is empty, not active, or not mapped to the current kiosk station, ignore it and mark no card recommended while keeping all active mapped service points visible.
- Use `pnpm` package filters; never raw `vite`, `vitest`, `tsc`, or `vue-tsc` commands.
- Existing inactive/retired Service Points stay visible in the `config-web` master list, but the config screen must not falsely claim it can reactivate a retired Service Point through the existing upsert API.

## Configuration Contract

The manually edited kiosk configuration supports a nested fallback map so future edge cases can be added as sibling keys without new top-level properties:

```json
{
  "fallbackServicePoints": {
    "bookingFailure": "SP-ADMISI"
  }
}
```

`bookingFailure` selects the recommended assistance service point shown when a booking registration fails. An empty string or a missing key means "no recommendation": all active service points mapped to the kiosk station remain available and none is recommended. Example future sibling keys could be `bpjsVerificationFailure` or `registrationFailure`; this plan implements only `bookingFailure` but keeps the container map.

The contract is deployment-wide because `global_config.json` is shared by the kiosk app deployment. It is not a per-station database setting.

## Scope Boundary

### In scope

- Add `fallbackServicePoints.bookingFailure` to the app configuration schema.
- Document the manually edited property in the kiosk `global_config.json` template.
- Resolve a valid recommendation against the existing current-kiosk `offerings` list.
- Visually mark the resolved service point as the recommended assistance choice while retaining all fallback choices and requiring explicit user click.
- Add Service Point master-data CRUD to `config-web` using the existing BE API (list all + upsert); no new BE endpoints.
- Add unit/component coverage for valid, missing, empty, inactive, and unmapped assignments.

### Out of scope

- Adding endpoints or database changes to `b09-bilreg-api`.
- Moving Service Point master data from the BE API into `global_config.json`.
- Automatically issuing an assistance queue ticket from the recommended choice.
- Adding fallback keys other than `bookingFailure` (the container map supports them later).
- Reactivating a retired Service Point through `config-web` (the existing upsert API does not support it).

## Existing Contracts

- `packages/shared-types/src/index.ts:49-55` defines `admissionServicePointSchema` with `servicePointId`, `displayName`, `queuePrefix`, and `status: 'Active' | 'Retired'`.
- `apps/kiosk-web/src/lib/offerings.ts:3-13` `intersectOfferings(config, servicePoints)` keeps only active mapped Service Points in `servicePointIds` order.
- `apps/kiosk-web/src/views/KioskPage.vue:92-110` loads active Service Points and intersects them with the current kiosk's `servicePointIds` to build `offerings`.
- `apps/kiosk-web/src/views/KioskPage.vue:544-550` passes the resulting `offerings` to `FailureStep`.
- `apps/kiosk-web/src/views/steps/FailureStep.vue:126-178` renders every offering as a clickable assistance card that emits `selectServicePoint`.
- `packages/app-config/src/index.ts:16-26` validates `global_config.json`; unknown properties are not exposed through `AppConfig`.
- `packages/api-client/src/admissionQueue.ts:28-32` `createAdmissionQueueApi().listServicePoints(activeOnly = true)` already queries `v1/admission-queue/service-points?activeOnly=`.
- `b09-bilreg-api` exposes `GET v1/admission-queue/service-points?activeOnly=false` and `PUT v1/admission-queue/service-points/{id}` (body: `displayName`, `queuePrefix`, `active`). This plan consumes those operations and does not modify their implementation.
- `apps/config-web/src/router.ts` registers protected child routes under `AppShell`.
- `apps/config-web/src/views/AppShell.vue:25-32` renders the navigation links.

## File Map

- Modify `packages/app-config/src/index.ts`: add `fallbackServicePointsSchema` and the optional `fallbackServicePoints` property.
- Modify `packages/app-config/src/index.spec.ts`: verify parsing, empty-string normalization, and omission.
- Modify `apps/kiosk-web/public/global_config.json`: add the `fallbackServicePoints` block with an empty `bookingFailure`.
- Modify `packages/api-client/src/admissionQueue.ts`: add `listAllServicePoints()` and `upsertServicePoint()` to the returned API.
- Create `apps/config-web/src/views/ServicePointsPage.vue`: Service Point master-data CRUD screen.
- Modify `apps/config-web/src/router.ts`: register `/service-points`.
- Modify `apps/config-web/src/views/AppShell.vue`: add the `Service Point` navigation link.
- Create `apps/config-web/src/views/__tests__/ServicePointsPage.spec.ts`: CRUD screen coverage.
- Create `apps/kiosk-web/src/lib/fallbackServicePoint.ts`: pure recommendation-resolution helper.
- Create `apps/kiosk-web/src/lib/__tests__/fallbackServicePoint.spec.ts`: resolver tests.
- Modify `apps/kiosk-web/src/views/KioskPage.vue`: resolve the recommendation from the existing `offerings` and pass it to `FailureStep`.
- Modify `apps/kiosk-web/src/views/steps/FailureStep.vue`: accept `recommendedServicePointId` and mark the matching card.
- Create `apps/kiosk-web/src/views/steps/__tests__/FailureStep.spec.ts`: recommendation marker behavior.

## Implementation Plan

### Task 1: Add the Manual Configuration Contract

**Files:**
- Modify: `packages/app-config/src/index.ts:16-26`
- Modify: `packages/app-config/src/index.spec.ts`
- Modify: `apps/kiosk-web/public/global_config.json`

**Interfaces:**
- Produces `AppConfig.fallbackServicePoints?: { bookingFailure?: string }`.
- Consumed by `KioskPage.vue` in Task 3.

- [ ] **Step 1: Write the failing schema tests**

Append to `packages/app-config/src/index.spec.ts`:

```ts
it('accepts fallbackServicePoints.bookingFailure', () => {
  const parsed = appConfigSchema.parse({
    bilregApiBase: 'http://localhost:5000/api',
    fallbackServicePoints: { bookingFailure: 'SP-ADMISI' },
  })

  expect(parsed.fallbackServicePoints?.bookingFailure).toBe('SP-ADMISI')
})

it('normalizes an empty bookingFailure assignment to undefined', () => {
  const parsed = appConfigSchema.parse({
    bilregApiBase: 'http://localhost:5000/api',
    fallbackServicePoints: { bookingFailure: '' },
  })

  expect(parsed.fallbackServicePoints?.bookingFailure).toBeUndefined()
})

it('keeps fallbackServicePoints optional', () => {
  const parsed = appConfigSchema.parse({ bilregApiBase: 'http://localhost:5000/api' })

  expect(parsed.fallbackServicePoints).toBeUndefined()
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```text
pnpm --filter @aq/app-config exec vitest run src/index.spec.ts
```

Expected: the new tests fail because the property does not exist on the schema.

- [ ] **Step 3: Add the schema property**

In `packages/app-config/src/index.ts`, above `appConfigSchema`:

```ts
export const fallbackServicePointsSchema = z.object({
  bookingFailure: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : undefined)),
})

export type FallbackServicePoints = z.infer<typeof fallbackServicePointsSchema>
```

Add to `appConfigSchema`:

```ts
fallbackServicePoints: fallbackServicePointsSchema.optional(),
```

Keep it optional so existing deployments remain valid.

- [ ] **Step 4: Update the manual deployment template**

In `apps/kiosk-web/public/global_config.json`, add:

```json
"fallbackServicePoints": {
  "bookingFailure": ""
}
```

An empty string means "no recommendation"; a deployment that needs a default replaces the value with a mapped Service Point ID.

- [ ] **Step 5: Run the focused tests**

Run:

```text
pnpm --filter @aq/app-config exec vitest run src/index.spec.ts
```

Expected: PASS.

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

### Task 4: Add Service Point Master CRUD to `config-web`

**Files:**
- Modify: `packages/api-client/src/admissionQueue.ts`
- Modify: `apps/config-web/src/router.ts`
- Modify: `apps/config-web/src/views/AppShell.vue`
- Create: `apps/config-web/src/views/ServicePointsPage.vue`
- Create: `apps/config-web/src/views/__tests__/ServicePointsPage.spec.ts`

**Interfaces:**
- Consumes the existing BE endpoints:
  - `GET v1/admission-queue/service-points?activeOnly=false`
  - `PUT v1/admission-queue/service-points/{id}` (body: `displayName`, `queuePrefix`, `active`)
- Produces `createAdmissionQueueApi` methods used by the page:
  - `listAllServicePoints(): Promise<AdmissionServicePoint[]>`
  - `upsertServicePoint(servicePointId: string, body: { displayName: string; queuePrefix: string; active: boolean }): Promise<AdmissionServicePoint>`
- Must not read or write `fallbackServicePoints` or `global_config.json`.

- [ ] **Step 1: Add the failing API client test**

Read the existing pattern in `packages/api-client/src/__tests__/admissionQueue.spec.ts` and extend it so an upsert sends the expected request body:

```ts
await api.upsertServicePoint('SP-ADMISI', {
  displayName: 'Administrasi',
  queuePrefix: 'A',
  active: true,
})

expect(request.method).toBe('PUT')
expect(request.url).toContain('/v1/admission-queue/service-points/SP-ADMISI')
expect(request.body).toEqual({ displayName: 'Administrasi', queuePrefix: 'A', active: true })
```

- [ ] **Step 2: Implement the client methods**

In `packages/api-client/src/admissionQueue.ts`, extend the object returned by `createAdmissionQueueApi`:

```ts
listAllServicePoints(): Promise<AdmissionServicePoint[]> {
  return client.getJson('v1/admission-queue/service-points', servicePointsSchema, {
    activeOnly: false,
  })
},

upsertServicePoint(
  servicePointId: string,
  body: { displayName: string; queuePrefix: string; active: boolean },
): Promise<AdmissionServicePoint> {
  return client.putJson(
    `v1/admission-queue/service-points/${encodeURIComponent(servicePointId)}`,
    body,
    admissionServicePointSchema,
  )
},
```

`admissionServicePointSchema` is already imported from `@aq/shared-types` in this file. Match the file's existing semicolon and formatting conventions.

- [ ] **Step 3: Add the Service Point master screen**

Create `apps/config-web/src/views/ServicePointsPage.vue`, modeled on `KiosksPage.vue` (same form-grid, table, mutation, and error patterns). Behaviors:

1. List all Service Points with `listAllServicePoints()` so retired records stay visible.
2. Show columns: `servicePointId`, `displayName`, `queuePrefix`, `status` badge (`Active`/`Retired`), and actions.
3. Create a new Service Point: ID + display name + queue prefix + active checkbox; send `active` accordingly.
4. Edit an `Active` Service Point: display name, queue prefix; keep `active: true`.
5. Edit a `Retired` Service Point: display name, queue prefix only; keep `active: false` and show a notice that it cannot be reactivated through this screen.
6. Do not render any field related to `fallbackServicePoints`.
7. Surface validation/API errors without changing `global_config.json`.

Use `getConfigurationApi()` or the admission queue API through `apps/config-web/src/infrastructure.ts` the same way existing pages do.

- [ ] **Step 4: Add route and navigation**

In `apps/config-web/src/router.ts`, add a protected child route under `AppShell`:

```ts
{ path: 'service-points', name: 'service-points', component: ServicePointsPage },
```

In `apps/config-web/src/views/AppShell.vue`, add a navigation link:

```vue
<RouterLink :to="{ name: 'service-points' }">Service Point</RouterLink>
```

- [ ] **Step 5: Add page tests**

Create `apps/config-web/src/views/__tests__/ServicePointsPage.spec.ts` following the mocking pattern used by the nearest existing `config-web` view spec. Verify at minimum:

1. Active and retired Service Points both render.
2. Creating a Service Point submits the expected upsert payload.
3. The page has no form control bound to `fallbackServicePoints`.

- [ ] **Step 6: Run focused tests**

Run:

```text
pnpm --filter config-web exec vitest run src/views/__tests__/ServicePointsPage.spec.ts
pnpm --filter @aq/api-client test
```

Expected: PASS.

### Task 5: Verify the Complete Slice

**Files:**
- No new production files.
- Review all files modified by Tasks 1-4.

- [ ] **Step 1: Run package typecheck and tests**

Run:

```text
pnpm --filter @aq/app-config run typecheck
pnpm --filter @aq/app-config test
pnpm --filter @aq/api-client run typecheck
pnpm --filter @aq/api-client test
pnpm --filter kiosk-web run typecheck
pnpm --filter kiosk-web test
pnpm --filter config-web run typecheck
pnpm --filter config-web test
```

Expected: all commands exit successfully.

- [ ] **Step 2: Run the required builds**

Run:

```text
pnpm --filter kiosk-web run build
pnpm --filter config-web run build
```

Expected: both production builds succeed.

- [ ] **Step 3: Perform manual acceptance checks**

Verify these deployment scenarios:

1. `fallbackServicePoints` absent or `bookingFailure` empty: all active service points mapped to the current station are shown and none is recommended.
2. Valid mapped ID: the matching assistance card is marked as recommended.
3. Unmapped ID: no card is recommended and all existing fallback cards remain shown.
4. Clicking a service point still requires explicit user action before `bookingAssistance` or `intake` is called.
5. Walk-in flow and normal intake selection remain unchanged.
6. `config-web` Service Point screen lists active and retired records, supports create/edit, and never shows `fallbackServicePoints`.

- [ ] **Step 4: Update the Progress Tracker**

Mark each slice through the ICS lifecycle:

```text
PLANNED -> IN IMPLEMENTATION -> IMPLEMENTED -> IN REVIEW -> GO
```

Do not mark a slice `GO` until the review agent verifies the acceptance criteria and test evidence.

## Progress Tracker

| Slice | Scope | Status | Dependencies |
|---|---|---|---|
| S1 | Manual `global_config.json` contract (`fallbackServicePoints.bookingFailure`) | PLANNED | None |
| S2 | Pure recommendation resolver | PLANNED | S1 |
| S3 | Failure UI recommendation marker | PLANNED | S2 |
| S4 | Service Point master CRUD in `config-web` | PLANNED | None |
| S5 | Full verification and handoff | PLANNED | S1, S2, S3, S4 |

## Deferred BE Proposal

No BE implementation is included. The following proposal may be sent to the BE credential owner separately:

- Extend kiosk boot configuration to return a validated fallback Service Point assignment map instead of requiring a manual `global_config.json` sibling file.
- Validate that each fallback assignment is active and mapped to the station.
- Add Service Point audit records to `BILRG_AuditLog`.
- Add an explicit activate operation for retired Service Points so master-data CRUD can reactivate them.
- Keep `BILRG_AdmServicePoint` as the master source; do not duplicate the master list into `global_config.json`.

## Plan Self-Review

- Spec coverage: nested manual configuration, current kiosk mapping fallback, invalid/empty configuration fallback, no BE changes, Service Point master CRUD, and the BE adaptation proposal are all covered.
- Placeholder scan: no `TBD`, `TODO`, or unspecified implementation step remains.
- Type consistency: `fallbackServicePoints.bookingFailure` is defined in `AppConfig`, consumed by `resolveFallbackServicePointId`, and passed to `FailureStep` as `recommendedServicePointId`.
- Scope check: no task modifies `b09-bilreg-api`; Service Point CRUD is limited to master-data maintenance in `config-web`, while the fallback assignment remains manual JSON configuration.
