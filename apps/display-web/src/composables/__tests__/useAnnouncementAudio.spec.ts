import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { useAnnouncementAudio } from '../useAnnouncementAudio'
import type { CurrentLoketDisplayItem } from '@aq/shared-types'

describe('useAnnouncementAudio', () => {
  it('seeds without announcing on first load', async () => {
    const items = ref<CurrentLoketDisplayItem[]>([
      {
        loketKey: '1',
        queueLabel: 'A15',
        announcementVersion: 1,
        displayState: 0,
        antrianId: 'A15-ID',
        noUrut: 15,
        servicePointId: 'SP1',
        calledAt: '2026-08-18T00:00:00Z',
        serviceStartedAt: null,
        rowVersion: 'v1',
      },
    ])
    const audioEnabled = ref(true)
    const playQueue = vi.fn().mockResolvedValue(undefined)

    const { announcing } = useAnnouncementAudio({
      items,
      audioEnabled,
      playQueue,
    })

    await nextTick()
    expect(announcing.value).toBe(false)
    expect(playQueue).not.toHaveBeenCalled()
  })

  it('plays queue when announcement version increases and audio is enabled', async () => {
    const items = ref<CurrentLoketDisplayItem[]>([
      {
        loketKey: '1',
        queueLabel: 'A15',
        announcementVersion: 1,
        displayState: 0,
        antrianId: 'A15-ID',
        noUrut: 15,
        servicePointId: 'SP1',
        calledAt: '2026-08-18T00:00:00Z',
        serviceStartedAt: null,
        rowVersion: 'v1',
      },
    ])
    const audioEnabled = ref(true)
    const playQueue = vi.fn().mockResolvedValue(undefined)

    useAnnouncementAudio({
      items,
      audioEnabled,
      playQueue,
    })

    // First assignment: triggers watch to seed (cold start)
    items.value = [
      {
        loketKey: '1',
        queueLabel: 'A15',
        announcementVersion: 1,
        displayState: 0,
        antrianId: 'A15-ID',
        noUrut: 15,
        servicePointId: 'SP1',
        calledAt: '2026-08-18T00:00:00Z',
        serviceStartedAt: null,
        rowVersion: 'v1',
      },
    ]
    await nextTick()

    // Second assignment: triggers watch to announce
    items.value = [
      {
        loketKey: '1',
        queueLabel: 'A15',
        announcementVersion: 2, // version increased!
        displayState: 0,
        antrianId: 'A15-ID',
        noUrut: 15,
        servicePointId: 'SP1',
        calledAt: '2026-08-18T00:00:00Z',
        serviceStartedAt: null,
        rowVersion: 'v2',
      },
    ]
    await nextTick()

    expect(playQueue).toHaveBeenCalledWith([
      'soundrs.m4a',
      'phrases/nomor-antrian.wav',
      'letters/a.wav',
      'numbers/15.wav',
      'phrases/silakan-menuju.wav',
      'counters/loket-1.wav',
    ])
  })

  it('does not play queue when audio is disabled', async () => {
    const items = ref<CurrentLoketDisplayItem[]>([
      {
        loketKey: '1',
        queueLabel: 'A15',
        announcementVersion: 1,
        displayState: 0,
        antrianId: 'A15-ID',
        noUrut: 15,
        servicePointId: 'SP1',
        calledAt: '2026-08-18T00:00:00Z',
        serviceStartedAt: null,
        rowVersion: 'v1',
      },
    ])
    const audioEnabled = ref(false) // disabled
    const playQueue = vi.fn().mockResolvedValue(undefined)

    useAnnouncementAudio({
      items,
      audioEnabled,
      playQueue,
    })

    // First assignment: triggers watch to seed
    items.value = [
      {
        loketKey: '1',
        queueLabel: 'A15',
        announcementVersion: 1,
        displayState: 0,
        antrianId: 'A15-ID',
        noUrut: 15,
        servicePointId: 'SP1',
        calledAt: '2026-08-18T00:00:00Z',
        serviceStartedAt: null,
        rowVersion: 'v1',
      },
    ]
    await nextTick()
    
    // Second assignment: version increased, but audio disabled
    items.value = [
      {
        loketKey: '1',
        queueLabel: 'A15',
        announcementVersion: 2,
        displayState: 0,
        antrianId: 'A15-ID',
        noUrut: 15,
        servicePointId: 'SP1',
        calledAt: '2026-08-18T00:00:00Z',
        serviceStartedAt: null,
        rowVersion: 'v2',
      },
    ]
    await nextTick()

    expect(playQueue).not.toHaveBeenCalled()
  })

  it('triggers onPlayBlocked callback in defaultPlayQueue on NotAllowedError', async () => {
    const originalAudio = globalThis.Audio
    const mockPlay = vi.fn().mockRejectedValue({ name: 'NotAllowedError' })
    globalThis.Audio = vi.fn().mockImplementation(() => ({
      play: mockPlay,
      addEventListener: vi.fn(),
    })) as any

    const onPlayBlocked = vi.fn()
    
    // We import defaultPlayQueue directly to test it
    const { defaultPlayQueue: defaultPlayQueueFn } = await import('../useAnnouncementAudio')
    await defaultPlayQueueFn(['soundrs.m4a'], onPlayBlocked)

    expect(onPlayBlocked).toHaveBeenCalled()
    globalThis.Audio = originalAudio
  })
})
