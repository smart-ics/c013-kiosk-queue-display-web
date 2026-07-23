import { describe, expect, it } from 'vitest'
import { applyAnnouncementGate, buildAnnouncementUtterance } from '../announcementGate'

describe('applyAnnouncementGate', () => {
  const item = {
    loketKey: 'L1',
    queueLabel: 'A0012',
    announcementVersion: 10,
  }

  it('seeds without announcing on first load', () => {
    const result = applyAnnouncementGate([item], new Map(), 'seed')
    expect(result.toAnnounce).toEqual([])
    expect(result.nextVersions.get('L1')).toBe(10)
  })

  it('announces when announcementVersion increases', () => {
    const previous = new Map([['L1', 10]])
    const result = applyAnnouncementGate(
      [{ ...item, announcementVersion: 11 }],
      previous,
      'live',
    )
    expect(result.toAnnounce).toEqual([
      { loketKey: 'L1', queueLabel: 'A0012', announcementVersion: 11 },
    ])
    expect(result.nextVersions.get('L1')).toBe(11)
  })

  it('stays silent when version equal or lower', () => {
    const previous = new Map([['L1', 10]])
    expect(
      applyAnnouncementGate([{ ...item, announcementVersion: 10 }], previous, 'live').toAnnounce,
    ).toEqual([])
    expect(
      applyAnnouncementGate([{ ...item, announcementVersion: 9 }], previous, 'live').toAnnounce,
    ).toEqual([])
  })

  it('seeds unknown loket silently in live mode (first sight)', () => {
    const result = applyAnnouncementGate([item], new Map(), 'live')
    expect(result.toAnnounce).toEqual([])
    expect(result.nextVersions.get('L1')).toBe(10)
  })
})

describe('buildAnnouncementUtterance', () => {
  it('formats queue label and loket', () => {
    expect(
      buildAnnouncementUtterance({
        loketKey: 'L1',
        queueLabel: 'A0012',
        announcementVersion: 1,
      }),
    ).toBe('Nomor A0012, loket L1')
  })
})
