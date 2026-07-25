### Task 1: Add `listDisplayScreenIds()` to the device-config interface

**Files:**
- Modify: `packages/device-config/src/provider.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `IDeviceConfigurationProvider.listDisplayScreenIds(): Promise<string[]>`.

- [ ] **Step 1: Edit `packages/device-config/src/provider.ts`**

Add the new method declaration to the interface. The full file becomes:

```ts
import type { DeviceConfig } from '@aq/shared-types'

export interface IDeviceConfigurationProvider {
  getConfig(deviceId: string): Promise<DeviceConfig>
  listDisplayScreenIds(): Promise<string[]>
}

export class DeviceConfigNotFoundError extends Error {
  readonly code = 'DEVICE_CONFIG_NOT_FOUND' as const
  readonly deviceId: string

  constructor(deviceId: string) {
    super(`Unknown device configuration for '${deviceId}'`)
    this.name = 'DeviceConfigNotFoundError'
    this.deviceId = deviceId
  }
}

export class DeviceConfigInvalidError extends Error {
  readonly code = 'DEVICE_CONFIG_INVALID' as const
  readonly deviceId: string

  constructor(deviceId: string, message: string) {
    super(message)
    this.name = 'DeviceConfigInvalidError'
    this.deviceId = deviceId
  }
}
```

The only change is the single new line in the interface body.

- [ ] **Step 2: Run typecheck to confirm the interface change compiles**

Run from repo root: `pnpm --filter @aq/device-config typecheck`
Expected: PASS. (`tsc` will not typecheck other packages; the only consumer in repo is `apps/display-web` which is not wired to the new method yet â€” that is Task 5.)

- [ ] **Step 3: Commit**

```bash
git add packages/device-config/src/provider.ts
git commit -m "feat(device-config): add listDisplayScreenIds to provider interface"
```

---

