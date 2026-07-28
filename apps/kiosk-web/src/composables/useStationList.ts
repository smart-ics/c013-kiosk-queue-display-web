import { getCurrentScope, onScopeDispose, ref, type Ref } from 'vue'
import { getDeviceConfigProvider } from '../infrastructure'

export type KioskStationListStatus = 'idle' | 'loading' | 'ok' | 'error'

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
  const status = ref<KioskStationListStatus>('idle')
  const stationIds = ref<string[]>([])
  const error = ref<string | null>(null)
  let loadId = 0

  const defaultFetch = async (): Promise<string[]> => {
    const provider = await getDeviceConfigProvider()
    return provider.listKioskStationIds()
  }

  const fetchImpl = opts?.fetchImpl ?? defaultFetch

  const run = (): void => {
    const myId = ++loadId
    status.value = 'loading'
    error.value = null
    fetchImpl()
      .then((ids) => {
        if (myId !== loadId) return
        stationIds.value = ids
        status.value = 'ok'
      })
      .catch((err: unknown) => {
        if (myId !== loadId) return
        error.value = err instanceof Error && err.message ? err.message : FALLBACK_ERROR
        stationIds.value = []
        status.value = 'error'
      })
  }

  run()

  if (getCurrentScope()) {
    onScopeDispose(() => {
      loadId += 1
    })
  }

  return {
    status,
    stationIds,
    error,
    refresh: run,
  }
}
