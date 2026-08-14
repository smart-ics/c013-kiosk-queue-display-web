# Auth Removal & Code Review Cleanup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Strip all auth dependencies from kiosk-web, fix stale `devices.json` text, deduplicate list composables, and resolve PR#2 review issues.

**Architecture:** Auth removal is kiosk-web-only cleanup (inline null auth, remove imports/deps). Shared `createListFetcher` utility extracted to `@aq/device-config` without Vue coupling — both apps thin-wrapper their composable around it. `listPublicKiosks` fixed to use `getPublicJson`.

**Tech Stack:** Vue 3 + Vite + TypeScript, `@aq/device-config`, `@aq/api-client`

## Global Constraints

- `@aq/device-config` must NOT add a Vue dependency
- No changes to `AdmissionQueueClient` constructor signature
- No changes to config-web
- Indonesian copy preserved (`Gagal memuat daftar ...`)

---

### Task 1: Fix `listPublicKiosks` → `getPublicJson`

**Files:**
- Modify: `packages/api-client/src/configuration.ts:337-341`

**Interfaces:**
- Consumes: `AdmissionQueueClient` (existing)
- Produces: `listPublicKiosks()` now calls `getPublicJson` (same return type)

- [ ] **Step 1: Apply the change**

```ts
// packages/api-client/src/configuration.ts
listPublicKiosks() {
  return client.getPublicJson(    // was getJson
    "v1/admission-queue/configuration/kiosks",
    kiosksSchema,
  )
},
```

- [ ] **Step 2: Run typecheck**

```bash
cd packages/api-client && pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add packages/api-client/src/configuration.ts
git commit -m "fix(api-client): listPublicKiosks use getPublicJson to match naming (PR#2 review #2)"
```

---

### Task 2: Remove auth from kiosk-web

**Files:**
- Modify: `apps/kiosk-web/src/infrastructure.ts`
- Modify: `apps/kiosk-web/src/views/KioskPage.vue`
- Modify: `apps/kiosk-web/env.d.ts`
- Modify: `apps/kiosk-web/package.json`

**Interfaces:**
- Consumes: `AdmissionQueueClient` with inline `{ getToken: () => null }`
- Produces: Same exports as before (`getDeviceConfigProvider`, `getAdmissionQueueApi`, `__resetInfrastructureForTests`) — signatures unchanged

- [ ] **Step 1: Edit `infrastructure.ts`**

Remove auth token provider, use inline null auth:

```ts
// Remove imports:
// import { EnvAuthTokenProvider, type IAuthTokenProvider } from '@aq/auth'

// Remove:
// let authTokenProvider: IAuthTokenProvider | null = null

// In getDeviceConfigProvider, change:
//   auth: getAuthTokenProvider(),
// to:
//   auth: { getToken: () => null },

// In getAdmissionQueueApi, change:
//   auth: getAuthTokenProvider(),
// to:
//   auth: { getToken: () => null },

// Remove entire function:
// export function getAuthTokenProvider(): IAuthTokenProvider { ... }

// In __resetInfrastructureForTests, remove:
//   authTokenProvider = null
```

Full file after change should look like:

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

Remove `MissingAuthTokenError` import and commented-out auth check:

```diff
  import { MissingAuthTokenError } from '@aq/auth'     // DELETE
  ...
-      // const token = getAuthTokenProvider().getToken()
-      // if (!token) throw new MissingAuthTokenError()
-      const provider = await getDeviceConfigProvider()
  ...
-      // if (error instanceof MissingAuthTokenError) {
-      //   bootError.value = 'VITE_BILREG_TOKEN belum dikonfigurasi.'
-      //   return
-      // }
```

- [ ] **Step 3: Edit `env.d.ts`**

Remove `VITE_BILREG_TOKEN` from the interface:

```diff
  interface ImportMetaEnv {
    readonly VITE_BILREG_API_BASE: string
-   readonly VITE_BILREG_TOKEN: string
  }
```

- [ ] **Step 4: Edit `package.json`**

```diff
  "dependencies": {
    "@aq/api-client": "workspace:*",
-   "@aq/auth": "workspace:*",
    "@aq/device-config": "workspace:*",
```

- [ ] **Step 5: Run typecheck**

```bash
cd apps/kiosk-web && pnpm typecheck
```

- [ ] **Step 6: Commit**

```bash
git add apps/kiosk-web/src/infrastructure.ts apps/kiosk-web/src/views/KioskPage.vue apps/kiosk-web/env.d.ts apps/kiosk-web/package.json
git commit -m "refactor(kiosk-web): remove auth (EnvAuthTokenProvider, VITE_BILREG_TOKEN, @aq/auth) — PR#2 review #1"
```

---

### Task 3: Fix stale `devices.json` reference

**Files:**
- Modify: `apps/display-web/src/views/MissingScreenPicker.vue:44`

- [ ] **Step 1: Change the text**

```diff
-        Tidak ada entry screen display yang terdaftar di <code>devices.json</code>.
-        Pastikan Anda telah menambahkan entry dengan <code>role: 'display'</code> terlebih dahulu.
+        Tidak ada screen display yang terdaftar di sistem.
+        Pastikan admin telah mendaftarkan screen display melalui halaman konfigurasi.
```

- [ ] **Step 2: Commit**

```bash
git add apps/display-web/src/views/MissingScreenPicker.vue
git commit -m "fix(display-web): remove stale devices.json reference in MissingScreenPicker (PR#2 review #1)"
```

---

### Task 4: Extract shared `createListFetcher` utility

**Files:**
- Create: `packages/device-config/src/deviceList.ts`
- Modify: `packages/device-config/src/index.ts` (add export)
- Modify: `apps/display-web/src/composables/useDisplayScreenList.ts` (use utility, drop `'idle'`)
- Modify: `apps/kiosk-web/src/composables/useStationList.ts` (use utility, drop `'idle'`)

**Interfaces:**
- Produces: `createListFetcher(fetchImpl, fallbackMsg, onUpdate)` → `{ run, cancel }` (framework-agnostic, no Vue)
- Consumes: unchanged composable signatures for both apps

- [ ] **Step 1: Create `packages/device-config/src/deviceList.ts`**

```ts
export type DeviceListStatus = 'loading' | 'ok' | 'error'

export type DeviceListState = {
  status: DeviceListStatus
  items: string[]
  error: string | null
}

export type DeviceListFetcher = {
  run: () => void
  cancel: () => void
}

export function createListFetcher(
  fetchImpl: () => Promise<string[]>,
  fallbackMsg: string,
  onUpdate: (state: DeviceListState) => void,
): DeviceListFetcher {
  let loadId = 0

  const isStale = (myId: number) => myId !== loadId

  const run = () => {
    const myId = ++loadId
    onUpdate({ status: 'loading', items: [], error: null })
    fetchImpl()
      .then((items) => {
        if (isStale(myId)) return
        onUpdate({ status: 'ok', items, error: null })
      })
      .catch((err: unknown) => {
        if (isStale(myId)) return
        const msg = err instanceof Error && err.message ? err.message : fallbackMsg
        onUpdate({ status: 'error', items: [], error: msg })
      })
  }

  return {
    run,
    cancel: () => { loadId += 1 },
  }
}
```

- [ ] **Step 2: Export from `packages/device-config/src/index.ts`**

```diff
  export * from './provider'
  export * from './apiProvider'
  export * from './kioskApiProvider'
  export * from './jsonProvider'
  export * from './path'
+ export * from './deviceList'
```

- [ ] **Step 3: Rewrite `useDisplayScreenList.ts`**

```ts
import { getCurrentScope, onScopeDispose, ref, type Ref } from 'vue'
import { createListFetcher, type DeviceListStatus } from '@aq/device-config'
import { getDeviceConfigProvider } from '../infrastructure'

export type DisplayScreenListStatus = DeviceListStatus

export interface DisplayScreenListState {
  status: Ref<DisplayScreenListStatus>
  screenIds: Ref<string[]>
  error: Ref<string | null>
  refresh: () => void
}

const FALLBACK_ERROR = 'Gagal memuat daftar screen.'

export function useDisplayScreenList(opts?: {
  fetchImpl?: () => Promise<string[]>
}): DisplayScreenListState {
  const status = ref<DisplayScreenListStatus>('loading')
  const screenIds = ref<string[]>([])
  const error = ref<string | null>(null)

  const defaultFetch = async (): Promise<string[]> => {
    const provider = await getDeviceConfigProvider()
    return provider.listDisplayScreenIds()
  }

  const fetchImpl = opts?.fetchImpl ?? defaultFetch

  const fetcher = createListFetcher(fetchImpl, FALLBACK_ERROR, (s) => {
    status.value = s.status
    screenIds.value = s.items
    error.value = s.error
  })

  if (getCurrentScope()) {
    onScopeDispose(() => fetcher.cancel())
  }

  fetcher.run()

  return {
    status,
    screenIds,
    error,
    refresh: () => fetcher.run(),
  }
}
```

- [ ] **Step 4: Rewrite `useStationList.ts`**

```ts
import { getCurrentScope, onScopeDispose, ref, type Ref } from 'vue'
import { createListFetcher, type DeviceListStatus } from '@aq/device-config'
import { getDeviceConfigProvider } from '../infrastructure'

export type KioskStationListStatus = DeviceListStatus

export interface KioskStationListState {
  status: Ref<KioskStationListStatus>
  stationIds: Ref<string[]>
  error: Ref<string | null>
  refresh: () => void
}

const FALLBACK_ERROR = 'Gagal memuat daftar kiosk station.'

export function useStationList(opts?: {
  fetchImpl?: () => Promise<string[]>
}): KioskStationListState {
  const status = ref<KioskStationListStatus>('loading')
  const stationIds = ref<string[]>([])
  const error = ref<string | null>(null)

  const defaultFetch = async (): Promise<string[]> => {
    const provider = await getDeviceConfigProvider()
    return provider.listKioskStationIds()
  }

  const fetchImpl = opts?.fetchImpl ?? defaultFetch

  const fetcher = createListFetcher(fetchImpl, FALLBACK_ERROR, (s) => {
    status.value = s.status
    stationIds.value = s.items
    error.value = s.error
  })

  if (getCurrentScope()) {
    onScopeDispose(() => fetcher.cancel())
  }

  fetcher.run()

  return {
    status,
    stationIds,
    error,
    refresh: () => fetcher.run(),
  }
}
```

- [ ] **Step 5: Update tests**

Update `apps/display-web/src/composables/__tests__/useDisplayScreenList.spec.ts` — the `'idle'` status test should now expect `'loading'`:

```ts
it('starts in loading then resolves to ok with ids', async () => {
  const fetchImpl = vi.fn().mockResolvedValue(['lobby-igd', 'lobby-poli-1'])
  const state = useDisplayScreenList({ fetchImpl })

  expect(state.status.value).toBe('loading')   // was 'loading' (same)
  await new Promise((r) => setTimeout(r, 0))
  expect(state.status.value).toBe('ok')
  expect(state.screenIds.value).toEqual(['lobby-igd', 'lobby-poli-1'])
  expect(state.error.value).toBeNull()
})
```

The stale-request test should still pass since the cancel mechanism is unchanged.

- [ ] **Step 6: Run tests**

```bash
cd apps/display-web && pnpm test
cd apps/kiosk-web && pnpm test
cd packages/device-config && pnpm test
```

- [ ] **Step 7: Commit**

```bash
git add packages/device-config/src/deviceList.ts packages/device-config/src/index.ts apps/display-web/src/composables/useDisplayScreenList.ts apps/kiosk-web/src/composables/useStationList.ts apps/display-web/src/composables/__tests__/useDisplayScreenList.spec.ts
git commit -m "refactor: extract createListFetcher into @aq/device-config, drop idle status, deduplicate composables (PR#2 review #3,#4)"
```

---

### Task 5: Remaining trivial fixes

**Files:**
- Modify: `apps/display-web/src/views/MissingScreenPicker.vue:15` — remove `??`
- Modify: `apps/kiosk-web/src/views/MissingStationPicker.vue:15` — remove `??`
- Modify: `packages/device-config/src/apiProvider.ts:56-70` — throw instead of silent `[]`

- [ ] **Step 1: Remove redundant `??` in MissingScreenPicker**

```diff
-    :message="error ?? 'Gagal memuat daftar screen.'"
+    :message="error"
```

- [ ] **Step 2: Remove redundant `??` in MissingStationPicker**

```diff
-    :message="error ?? 'Gagal memuat daftar station.'"
+    :message="error"
```

- [ ] **Step 3: `ApiDeviceConfigurationProvider` — throw when option not configured**

```diff
  async listDisplayScreenIds(): Promise<string[]> {
-   if (this.options.listDisplays) {
+   if (!this.options.listDisplays) {
+     throw new DeviceConfigInvalidError(
+       '*',
+       'listDisplayScreenIds requires listDisplays option to be configured',
+     )
+   }
    const displays = await this.options.listDisplays()
    return displays.map((d) => d.deviceId)
-   }
-   return []
  }

  async listKioskStationIds(): Promise<string[]> {
-   if (this.options.listKiosks) {
+   if (!this.options.listKiosks) {
+     throw new DeviceConfigInvalidError(
+       '*',
+       'listKioskStationIds requires listKiosks option to be configured',
+     )
+   }
    const kiosks = await this.options.listKiosks()
    return kiosks.map((k) => k.deviceId)
-   }
-   return []
  }
```

- [ ] **Step 4: Run typecheck + tests**

```bash
pnpm typecheck && pnpm test
```

- [ ] **Step 5: Commit**

```bash
git add apps/display-web/src/views/MissingScreenPicker.vue apps/kiosk-web/src/views/MissingStationPicker.vue packages/device-config/src/apiProvider.ts
git commit -m "fix: remove redundant ?? fallback, throw on unconfigured listDisplays/listKiosks (PR#2 review #5,#6)"
```
