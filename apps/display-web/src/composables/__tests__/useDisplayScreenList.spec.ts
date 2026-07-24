import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { useDisplayScreenList } from '../../composables/useDisplayScreenList'

describe('useDisplayScreenList', () => {
  it('starts in loading then resolves to ok with ids', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(['lobby-igd', 'lobby-poli-1'])
    const state = useDisplayScreenList({ fetchImpl })

    expect(state.status.value).toBe('loading')
    await new Promise((r) => setTimeout(r, 0))
    expect(state.status.value).toBe('ok')
    expect(state.screenIds.value).toEqual(['lobby-igd', 'lobby-poli-1'])
    expect(state.error.value).toBeNull()
  })

  it('captures the error message on rejection', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('boom'))
    const state = useDisplayScreenList({ fetchImpl })

    await new Promise((r) => setTimeout(r, 0))
    expect(state.status.value).toBe('error')
    expect(state.error.value).toBe('boom')
    expect(state.screenIds.value).toEqual([])
  })

  it('uses a fallback error message when the thrown value has no message', async () => {
    const fetchImpl = vi.fn().mockRejectedValue('nope')
    const state = useDisplayScreenList({ fetchImpl })

    await new Promise((r) => setTimeout(r, 0))
    expect(state.status.value).toBe('error')
    expect(state.error.value).toBe('Gagal memuat daftar screen.')
  })

  it('refresh re-fetches and replaces state', async () => {
    let calls = 0
    const fetchImpl = vi.fn().mockImplementation(async () => {
      calls += 1
      return calls === 1 ? ['a'] : ['a', 'b']
    })
    const state = useDisplayScreenList({ fetchImpl })

    await new Promise((r) => setTimeout(r, 0))
    expect(state.screenIds.value).toEqual(['a'])

    state.refresh()
    await new Promise((r) => setTimeout(r, 0))
    expect(state.screenIds.value).toEqual(['a', 'b'])
  })

  it('a stale in-flight call does not overwrite a newer result', async () => {
    const resolvers: Array<(value: string[]) => void> = []
    const fetchImpl = vi.fn().mockImplementation(
      () => new Promise<string[]>((resolve) => resolvers.push(resolve)),
    )
    const state = useDisplayScreenList({ fetchImpl })

    state.refresh()
    resolvers[1]?.(['fresh'])
    await nextTick()
    expect(state.screenIds.value).toEqual(['fresh'])

    resolvers[0]?.(['stale'])
    await nextTick()
    expect(state.screenIds.value).toEqual(['fresh'])
  })
})
