### Task 1: `@aq/app-config` — optional `jetliApiBase` + schema test

**Files:**
- Modify: `packages/app-config/src/index.ts`
- Modify: `packages/app-config/package.json`
- Create: `packages/app-config/src/index.spec.ts`

**Interfaces:**
- Consumes: existing `configService`, `AppConfig`
- Produces: `appConfigSchema` exported with optional `jetliApiBase`; `AppConfig` type gains optional `jetliApiBase: string`

- [ ] **Step 1: Write the failing test**

Create `packages/app-config/src/index.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { appConfigSchema } from './index'

describe('appConfigSchema', () => {
  it('accepts bilregApiBase without jetliApiBase', () => {
    const result = appConfigSchema.safeParse({ bilregApiBase: 'http://localhost:5000/api' })
    expect(result.success).toBe(true)
  })

  it('accepts jetliApiBase when provided', () => {
    const parsed = appConfigSchema.parse({
      bilregApiBase: 'http://localhost:5000/api',
      jetliApiBase: 'http://localhost:6000/api',
    })
    expect(parsed.jetliApiBase).toBe('http://localhost:6000/api')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @aq/app-config exec vitest run src/index.spec.ts`
Expected: FAIL — `appConfigSchema` is not exported from `./index`.

- [ ] **Step 3: Modify the schema**

In `packages/app-config/src/index.ts`, export the schema and add the optional field:

```ts
export const appConfigSchema = z.object({
  bilregApiBase: z.string().min(1, 'bilregApiBase must not be empty'),
  jetliApiBase: z.string().optional(),
})
```

`AppConfig` stays derived from the schema (`z.infer`). The `configService` implementation is unchanged.

- [ ] **Step 4: Add vitest devDependency and test script**

In `packages/app-config/package.json`:

```json
{
  "name": "@aq/app-config",
  "version": "0.0.0",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "test": "vitest run --passWithNoTests"
  },
  "dependencies": {
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "typescript": "^5.2.2",
    "vitest": "^3.2.4"
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm install && pnpm --filter @aq/app-config test`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/app-config
git commit -m "feat(app-config): optional jetliApiBase for BPJS integration"
```

