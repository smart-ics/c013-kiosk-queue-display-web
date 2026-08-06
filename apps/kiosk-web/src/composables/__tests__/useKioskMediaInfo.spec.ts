import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { useKioskMediaInfo } from '../useKioskMediaInfo'

describe('useKioskMediaInfo', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses the playlist from the directory and starts at index 0', async () => {
    const loadList = vi.fn(async () => ['/kiosk/media/a.mp4', '/kiosk/media/b.mp4'])
    const media = useKioskMediaInfo({
      directoryUrl: '/kiosk/media/',
      fallbackVideoUrl: '/kiosk/adv-video.mp4',
      loadList,
    })
    await flushPromises()

    expect(loadList).toHaveBeenCalledWith('/kiosk/media/')
    expect(media.videoUrls.value).toEqual(['/kiosk/media/a.mp4', '/kiosk/media/b.mp4'])
    expect(media.currentVideoUrl.value).toBe('/kiosk/media/a.mp4')
    expect(media.videoError.value).toBe(false)
  })

  it('falls back to the single video when the directory fetch returns empty', async () => {
    const media = useKioskMediaInfo({
      directoryUrl: '/kiosk/media/',
      fallbackVideoUrl: '/kiosk/adv-video.mp4',
      loadList: async () => [],
    })
    await flushPromises()

    expect(media.videoUrls.value).toEqual(['/kiosk/adv-video.mp4'])
    expect(media.currentVideoUrl.value).toBe('/kiosk/adv-video.mp4')
  })

  it('falls back to the single video when the directory fetch rejects', async () => {
    const media = useKioskMediaInfo({
      directoryUrl: '/kiosk/media/',
      fallbackVideoUrl: '/kiosk/adv-video.mp4',
      loadList: async () => {
        throw new TypeError('Failed to fetch')
      },
    })
    await flushPromises()

    expect(media.videoUrls.value).toEqual(['/kiosk/adv-video.mp4'])
  })

  it('uses the single fallback video immediately when directoryUrl is null', async () => {
    const loadList = vi.fn()
    const media = useKioskMediaInfo({
      directoryUrl: null,
      fallbackVideoUrl: '/kiosk/adv-video.mp4',
      loadList,
    })

    expect(media.videoUrls.value).toEqual(['/kiosk/adv-video.mp4'])
    expect(loadList).not.toHaveBeenCalled()
    expect(media.pending.value).toBe(false)
  })

  it('advances through the playlist and wraps from last to first on ended', async () => {
    const media = useKioskMediaInfo({
      directoryUrl: null,
      fallbackVideoUrl: '/x.mp4',
    })
    media.videoUrls.value = ['/a.mp4', '/b.mp4', '/c.mp4']

    media.onVideoEnded()
    expect(media.currentVideoUrl.value).toBe('/b.mp4')
    media.onVideoEnded()
    expect(media.currentVideoUrl.value).toBe('/c.mp4')
    media.onVideoEnded()
    expect(media.currentVideoUrl.value).toBe('/a.mp4')
  })

  it('sets videoError and does not advance when a single video errors', () => {
    const media = useKioskMediaInfo({ directoryUrl: null, fallbackVideoUrl: '/x.mp4' })

    media.onVideoError()
    expect(media.videoError.value).toBe(true)
    expect(media.currentVideoUrl.value).toBe('/x.mp4')
  })

  it('skips to the next video when one of several videos errors', () => {
    const media = useKioskMediaInfo({ directoryUrl: null, fallbackVideoUrl: '/x.mp4' })
    media.videoUrls.value = ['/a.mp4', '/b.mp4']

    media.onVideoError()
    expect(media.videoError.value).toBe(false)
    expect(media.currentVideoUrl.value).toBe('/b.mp4')
  })

  it('resets to index 0 when the playlist is replaced', async () => {
    const directoryUrl = ref('/dir/')
    const playlist = ref(['/a.mp4', '/b.mp4'])
    const loadList = vi.fn(async () => playlist.value)
    const media = useKioskMediaInfo({
      directoryUrl,
      fallbackVideoUrl: '/x.mp4',
      loadList,
    })
    await flushPromises()

    media.onVideoEnded()
    expect(media.currentVideoUrl.value).toBe('/b.mp4')

    playlist.value = ['/c.mp4']
    directoryUrl.value = '/dir-2/'
    await flushPromises()

    expect(media.videoUrls.value).toEqual(['/c.mp4'])
    expect(media.currentVideoUrl.value).toBe('/c.mp4')
  })

  it('ignores a stale directory response that resolves after a newer one', async () => {
    let resolveFirst!: () => void
    const first = new Promise<string[]>((resolve) => {
      resolveFirst = () => resolve(['/old/a.mp4'])
    })
    const second = Promise.resolve(['/new/a.mp4'])
    const directoryUrl = ref('/old/')
    const loadList = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second)
    const media = useKioskMediaInfo({ directoryUrl, fallbackVideoUrl: '/x.mp4', loadList })

    await flushPromises()
    directoryUrl.value = '/new/'
    await flushPromises()
    resolveFirst()
    await flushPromises()

    expect(media.videoUrls.value).toEqual(['/new/a.mp4'])
  })

  it('uses the real directory loader when no loadList is injected', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<a href="a.mp4">a.mp4</a>', { status: 200 })),
    )
    const media = useKioskMediaInfo({
      directoryUrl: '/kiosk/media/',
      fallbackVideoUrl: '/kiosk/adv-video.mp4',
    })
    await flushPromises()
    expect(media.videoUrls.value).toEqual(['/kiosk/media/a.mp4'])
  })
})
