### Task 2: Remove auth from kiosk-web

**Files:**
- Modify: `apps/kiosk-web/src/infrastructure.ts`
- Modify: `apps/kiosk-web/src/views/KioskPage.vue`
- Modify: `apps/kiosk-web/env.d.ts`
- Modify: `apps/kiosk-web/package.json`

- [ ] **Step 1: Edit `infrastructure.ts`**

Remove imports of `EnvAuthTokenProvider` and `IAuthTokenProvider` from `@aq/auth`.
Remove the `authTokenProvider` singleton variable.
Remove the entire `getAuthTokenProvider()` function.
Replace `auth: getAuthTokenProvider()` with `auth: { getToken: () => null }` in both `getDeviceConfigProvider()` and `getAdmissionQueueApi()`.
Remove `authTokenProvider = null` from `__resetInfrastructureForTests`.

Expected final file content:
```ts
import {
  AdmissionQueueClient,
  createAdmissionQueueApi,
  createRuntimeDeviceApi,
  type AdmissionQueueApi,
} from '@aq/api-client'
import {
  ApiKioskDeviceConfigurationProvider,
  type IDeviceConfigurationProvider,
} from '@aq/device-config'

let deviceConfigProvider: IDeviceConfigurationProvider | null = null
let admissionQueueApi: AdmissionQueueApi | null = null

export async function getDeviceConfigProvider(): Promise<IDeviceConfigurationProvider> {
  if (deviceConfigProvider) return deviceConfigProvider
  const baseUrl = import.meta.env.VITE_BILREG_API_BASE?.trim()
  if (!baseUrl) throw new Error('VITE_BILREG_API_BASE is not configured')
  const runtime = createRuntimeDeviceApi(
    new AdmissionQueueClient({
      baseUrl,
      auth: { getToken: () => null },
    }),
  )
  deviceConfigProvider = new ApiKioskDeviceConfigurationProvider({
    getKioskBootConfig: (stationId) => runtime.getPublicKioskBootConfig(stationId),
    listKiosks: () => runtime.listPublicKiosks(),
  })
  return deviceConfigProvider
}

export function getAdmissionQueueApi(): AdmissionQueueApi {
  if (admissionQueueApi) return admissionQueueApi
  const baseUrl = import.meta.env.VITE_BILREG_API_BASE?.trim()
  if (!baseUrl) {
    throw new Error('VITE_BILREG_API_BASE is not configured')
  }
  const client = new AdmissionQueueClient({
    baseUrl,
    auth: { getToken: () => null },
  })
  admissionQueueApi = createAdmissionQueueApi(client)
  return admissionQueueApi
}

export function __resetInfrastructureForTests() {
  deviceConfigProvider = null
  admissionQueueApi = null
}
```

- [ ] **Step 2: Edit `KioskPage.vue`**

Remove the import of `MissingAuthTokenError` from `@aq/auth`.
Remove the commented-out auth check lines:
```
// const token = getAuthTokenProvider().getToken()
// if (!token) throw new MissingAuthTokenError()
```
And:
```
// if (error instanceof MissingAuthTokenError) {
//   bootError.value = 'VITE_BILREG_TOKEN belum dikonfigurasi.'
//   return
// }
```

- [ ] **Step 3: Edit `env.d.ts`**

Remove `readonly VITE_BILREG_TOKEN: string` from the `ImportMetaEnv` interface.

- [ ] **Step 4: Edit `package.json`**

Remove `"@aq/auth": "workspace:*"` from dependencies.

- [ ] **Step 5: Run typecheck**

`pnpm typecheck` from `apps/kiosk-web/`

- [ ] **Step 6: Commit**
