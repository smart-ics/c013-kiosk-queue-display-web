export type DeviceListStatus = 'loading' | 'ok' | 'error'

export type DeviceListState<T = string> = {
  status: DeviceListStatus
  items: T[]
  error: string | null
}

export type DeviceListFetcher = {
  run: () => void
  cancel: () => void
}

export function createListFetcher<T = string>(
  fetchImpl: () => Promise<T[]>,
  fallbackMsg: string,
  onUpdate: (state: DeviceListState<T>) => void,
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
