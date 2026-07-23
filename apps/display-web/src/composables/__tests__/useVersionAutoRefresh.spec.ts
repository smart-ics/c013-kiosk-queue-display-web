import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { useVersionAutoRefresh } from '../../composables/useVersionAutoRefresh'

describe('useVersionAutoRefresh', () => {
  it('reloads when version changes and idle', async () => {
    const enabled = ref(true)
    const idle = ref(true)
    const reload = vi.fn()
    let version = 'v1'
    const fetchVersion = vi.fn(async () => ({ version }))

    const { check } = useVersionAutoRefresh({
      enabled,
      idle,
      pollIntervalMs: 60_000,
      fetchVersion,
      reload,
    })

    await nextTick()
    await check()
    expect(reload).not.toHaveBeenCalled()

    version = 'v2'
    await check()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('does not reload when not idle', async () => {
    const enabled = ref(true)
    const idle = ref(false)
    const reload = vi.fn()
    let version = 'v1'
    const fetchVersion = vi.fn(async () => ({ version }))

    const { check } = useVersionAutoRefresh({
      enabled,
      idle,
      fetchVersion,
      reload,
    })

    await nextTick()
    await check()
    version = 'v2'
    await check()
    expect(reload).not.toHaveBeenCalled()
  })
})
