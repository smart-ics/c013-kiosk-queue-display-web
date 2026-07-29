### Task 4: Extract shared `createListFetcher` utility

**Files:**
- Create: `packages/device-config/src/deviceList.ts`
- Modify: `packages/device-config/src/index.ts`
- Modify: `apps/display-web/src/composables/useDisplayScreenList.ts`
- Modify: `apps/kiosk-web/src/composables/useStationList.ts`
- Test: `apps/display-web/src/composables/__tests__/useDisplayScreenList.spec.ts` (update test)

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

Add `export * from './deviceList'`

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

- [ ] **Step 5: Update tests in `useDisplayScreenList.spec.ts`**

Tests should still pass — the behavior is unchanged (start in 'loading', resolve to 'ok', capture error, refresh, stale request handling).

- [ ] **Step 6: Run tests**

`pnpm test` for display-web, kiosk-web, and device-config.

- [ ] **Step 7: Commit**
