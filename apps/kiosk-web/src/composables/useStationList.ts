import { getCurrentScope, onScopeDispose, ref, type Ref } from 'vue'
import { createListFetcher, type DeviceListStatus } from '@aq/device-config'
import { getDeviceConfigProvider } from '../infrastructure'

export type KioskStationListStatus = DeviceListStatus

export interface KioskStationInfo {
  stationId: string
  displayName: string
  locationName?: string | null
}

export interface KioskStationListState {
  status: Ref<KioskStationListStatus>
  stations: Ref<KioskStationInfo[]>
  error: Ref<string | null>
  refresh: () => void
}

const FALLBACK_ERROR = 'Gagal memuat daftar kiosk station.'

export function useStationList(opts?: {
  fetchImpl?: () => Promise<KioskStationInfo[]>
}): KioskStationListState {
  const status = ref<KioskStationListStatus>('loading')
  const stations = ref<KioskStationInfo[]>([])
  const error = ref<string | null>(null)

  const defaultFetch = async (): Promise<KioskStationInfo[]> => {
    const provider = await getDeviceConfigProvider()
    return provider.listKioskStationIds()
  }

  const fetchImpl = opts?.fetchImpl ?? defaultFetch

  const fetcher = createListFetcher(fetchImpl, FALLBACK_ERROR, (s) => {
    status.value = s.status
    stations.value = s.items
    error.value = s.error
  })

  if (getCurrentScope()) {
    onScopeDispose(() => fetcher.cancel())
  }

  fetcher.run()

  return {
    status,
    stations,
    error,
    refresh: () => fetcher.run(),
  }
}
