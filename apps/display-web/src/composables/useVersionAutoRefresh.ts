import { watch, type Ref } from 'vue'

export function useVersionAutoRefresh(options: {
  enabled: Ref<boolean>
  idle: Ref<boolean>
  pollIntervalMs?: number
  fetchVersion?: () => Promise<{ version: string } | null>
  reload?: () => void
}) {
  const pollIntervalMs = options.pollIntervalMs ?? 60_000
  let bootVersion: string | null = null
  const fetchVersion =
    options.fetchVersion ??
    (async () => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}version.json`, {
          cache: 'no-store',
        })
        if (!response.ok) return null
        const json = (await response.json()) as { version?: string }
        if (!json.version) return null
        return { version: json.version }
      } catch {
        return null
      }
    })
  const reload = options.reload ?? (() => window.location.reload())

  async function check() {
    if (!options.enabled.value) return
    const remote = await fetchVersion()
    if (!remote) return
    if (bootVersion === null) {
      bootVersion = remote.version
      return
    }
    if (remote.version !== bootVersion && options.idle.value) {
      reload()
    }
  }

  watch(
    () => options.enabled.value,
    (enabled, _prev, onCleanup) => {
      if (!enabled) return
      void check()
      const timer = setInterval(() => {
        void check()
      }, pollIntervalMs)
      onCleanup(() => clearInterval(timer))
    },
    { immediate: true },
  )

  return { check }
}
