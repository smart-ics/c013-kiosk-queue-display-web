import { describe, expect, it } from 'vitest'
import {
  applyAnnouncementGate,
  buildAnnouncementUtterance,
  parseQueueLabel,
  decomposeNumber,
  buildAudioQueue,
} from '../announcementGate'

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

describe('parseQueueLabel', () => {
  it('parses labels with prefix letters and numbers', () => {
    expect(parseQueueLabel('A15')).toEqual({ letters: ['a'], number: 15 })
    expect(parseQueueLabel('CS-15')).toEqual({ letters: ['c', 's'], number: 15 })
    expect(parseQueueLabel('103')).toEqual({ letters: [], number: 103 })
    expect(parseQueueLabel('005')).toEqual({ letters: [], number: 5 })
    expect(parseQueueLabel('A')).toEqual({ letters: ['a'], number: null })
  })
})

describe('decomposeNumber', () => {
  it('returns empty array for non-positive numbers', () => {
    expect(decomposeNumber(0)).toEqual([])
    expect(decomposeNumber(-5)).toEqual([])
  })

  it('decomposes single digits', () => {
    expect(decomposeNumber(5)).toEqual(['numbers/5.wav'])
  })

  it('decomposes teen numbers', () => {
    expect(decomposeNumber(11)).toEqual(['numbers/11.wav'])
    expect(decomposeNumber(15)).toEqual(['numbers/15.wav'])
  })

  it('decomposes double digits', () => {
    expect(decomposeNumber(20)).toEqual(['numbers/20.wav'])
    expect(decomposeNumber(32)).toEqual(['numbers/30.wav', 'numbers/2.wav'])
  })

  it('decomposes hundreds', () => {
    expect(decomposeNumber(100)).toEqual(['numbers/100.wav'])
    expect(decomposeNumber(105)).toEqual(['numbers/100.wav', 'numbers/5.wav'])
    expect(decomposeNumber(115)).toEqual(['numbers/100.wav', 'numbers/15.wav'])
    expect(decomposeNumber(123)).toEqual(['numbers/100.wav', 'numbers/20.wav', 'numbers/3.wav'])
  })

  it('decomposes thousands', () => {
    expect(decomposeNumber(1000)).toEqual(['numbers/1000.wav'])
    expect(decomposeNumber(2015)).toEqual(['numbers/2000.wav', 'numbers/15.wav'])
  })

  it('falls back to digit-by-digit for numbers > 5999', () => {
    expect(decomposeNumber(6000)).toEqual([
      'numbers/6.wav',
      'numbers/0.wav',
      'numbers/0.wav',
      'numbers/0.wav',
    ])
  })
})

describe('buildAudioQueue', () => {
  it('builds full audio queue for a candidate', () => {
    expect(buildAudioQueue({ loketKey: '1', queueLabel: 'A15' })).toEqual([
      'chime.wav',
      'phrases/nomor-antrian.wav',
      'letters/a.wav',
      'numbers/15.wav',
      'phrases/silakan-menuju.wav',
      'counters/loket-1.wav',
    ])

    expect(buildAudioQueue({ loketKey: '11', queueLabel: 'B203' })).toEqual([
      'chime.wav',
      'phrases/nomor-antrian.wav',
      'letters/b.wav',
      'numbers/200.wav',
      'numbers/3.wav',
      'phrases/silakan-menuju.wav',
      'phrases/loket.wav',
      'numbers/11.wav',
    ])

    expect(buildAudioQueue({ loketKey: 'A', queueLabel: 'C5' })).toEqual([
      'chime.wav',
      'phrases/nomor-antrian.wav',
      'letters/c.wav',
      'numbers/5.wav',
      'phrases/silakan-menuju.wav',
      'phrases/loket.wav',
      'letters/a.wav',
    ])
  })
})
