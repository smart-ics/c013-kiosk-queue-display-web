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
