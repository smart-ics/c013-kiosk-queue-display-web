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

