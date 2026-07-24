import { getCurrentScope, onScopeDispose, ref, type Ref } from 'vue'
import { getDeviceConfigProvider } from '../infrastructure'

export type DisplayScreenListStatus = 'idle' | 'loading' | 'ok' | 'error'

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
  const status = ref<DisplayScreenListStatus>('idle')
  const screenIds = ref<string[]>([])
  const error = ref<string | null>(null)
  let loadId = 0

  const defaultFetch = async (): Promise<string[]> => {
    const provider = await getDeviceConfigProvider()
    return provider.listDisplayScreenIds()
  }

  const fetchImpl = opts?.fetchImpl ?? defaultFetch

  const run = (): void => {
    const myId = ++loadId
    status.value = 'loading'
    error.value = null
    fetchImpl()
      .then((ids) => {
        if (myId !== loadId) return
        screenIds.value = ids
        status.value = 'ok'
      })
      .catch((err: unknown) => {
        if (myId !== loadId) return
        error.value = err instanceof Error && err.message ? err.message : FALLBACK_ERROR
        screenIds.value = []
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
    screenIds,
    error,
    refresh: run,
  }
}
