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

