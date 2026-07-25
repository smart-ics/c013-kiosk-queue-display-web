# Task 2 — Context note from controller

This is the second task in a 9-task plan. Task 1 added `listDisplayScreenIds(): Promise<string[]>` to the `IDeviceConfigurationProvider` interface. Because the in-package `JsonDeviceConfigurationProvider implements IDeviceConfigurationProvider`, Task 1's implementer also added a 4-line `return []` stub in `jsonProvider.ts` (lines 20-23, between `fromJson` and `getConfig`) to keep the package's typecheck green. That stub is what Task 2 must replace with the real implementation.

Repo: pnpm monorepo, `pnpm --filter <pkg> <script>`. The package `@aq/device-config` is at `E:\PROJECT\ICS\FE\c013-kiosk-queue-display-web\packages\device-config`. Use `rtk git` (not raw `git`) for any git operations.

**Action:** Replace the existing `return []` stub (currently between `fromJson` and `getConfig`) with the real implementation per the brief below. Place the new method at the **bottom of the class**, after `getConfig`, as the plan's Step 1 shows in the full-file listing.

---

# Brief (auto-extracted from plan)

```ts
```
```bash
```
### Task 2: Implement `listDisplayScreenIds()` on `JsonDeviceConfigurationProvider`

**Files:**
- Modify: `packages/device-config/src/jsonProvider.ts`

**Interfaces:**
- Consumes: `IDeviceConfigurationProvider` from Task 1.
- Produces: `JsonDeviceConfigurationProvider.listDisplayScreenIds()` returns the sorted deviceIds whose `raw.role === 'display'`. Sort uses `localeCompare`. Entries with no `role` or a non-`'display'` role are excluded. Does not call `getConfig`; does not validate.

- [ ] **Step 1: Add the method to `JsonDeviceConfigurationProvider`**

Edit `packages/device-config/src/jsonProvider.ts`. The full file becomes:

```ts
import { deviceConfigSchema, type DeviceConfig } from '@aq/shared-types'
import {
  DeviceConfigInvalidError,
  DeviceConfigNotFoundError,
  type IDeviceConfigurationProvider,
} from './provider'

export type DeviceConfigCatalog = Record<string, Omit<DeviceConfig, 'deviceId'> & { deviceId?: string }>

export class JsonDeviceConfigurationProvider implements IDeviceConfigurationProvider {
  private readonly catalog: DeviceConfigCatalog

  constructor(catalog: DeviceConfigCatalog) {
    this.catalog = catalog
  }

  static fromJson(json: unknown): JsonDeviceConfigurationProvider {
    if (!json || typeof json !== 'object' || Array.isArray(json)) {
      throw new DeviceConfigInvalidError('*', 'Device catalog must be a JSON object keyed by deviceId')
    }
    return new JsonDeviceConfigurationProvider(json as DeviceConfigCatalog)
  }

  async getConfig(deviceId: string): Promise<DeviceConfig> {
    const key = deviceId.trim()
    if (!key) throw new DeviceConfigNotFoundError(deviceId)

    const raw = this.catalog[key]
    if (!raw) throw new DeviceConfigNotFoundError(key)

    const parsed = deviceConfigSchema.safeParse({
      ...raw,
      deviceId: raw.deviceId ?? key,
    })

    if (!parsed.success) {
      throw new DeviceConfigInvalidError(key, parsed.error.message)
    }

    if (parsed.data.deviceId !== key) {
      throw new DeviceConfigInvalidError(
        key,
        `Catalog entry deviceId '${parsed.data.deviceId}' does not match key '${key}'`,
      )
    }

    return parsed.data
  }

  async listDisplayScreenIds(): Promise<string[]> {
    return Object.entries(this.catalog)
      .filter(([, raw]) => raw?.role === 'display')
      .map(([id]) => id)
      .sort((a, b) => a.localeCompare(b))
  }
}
```

The only addition is the `listDisplayScreenIds` method at the bottom of the class.

- [ ] **Step 2: Run typecheck**

Run from repo root: `pnpm --filter @aq/device-config typecheck`
Expected: PASS. The implementation matches the interface from Task 1.

- [ ] **Step 3: Commit**

```bash
git add packages/device-config/src/jsonProvider.ts
git commit -m "feat(device-config): implement listDisplayScreenIds on json provider"
```

---
