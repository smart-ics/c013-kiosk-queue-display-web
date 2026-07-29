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
