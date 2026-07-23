import { describe, expect, it } from 'vitest'
import { filterSnapshotByLoketIds, shouldRefreshForHint } from '../snapshot'
import type { CurrentLoketDisplayItem } from '@aq/shared-types'

function item(loketKey: string): CurrentLoketDisplayItem {
  return {
    loketKey,
    antrianId: 'a',
    noUrut: 1,
    queueLabel: 'A0001',
    servicePointId: 'REG',
    displayState: 1,
    announcementVersion: 1,
    calledAt: '2026-07-23T00:00:00',
    serviceStartedAt: null,
    rowVersion: 'AQ==',
  }
}

describe('filterSnapshotByLoketIds', () => {
  it('keeps only configured loketIds', () => {
    const filtered = filterSnapshotByLoketIds(
      [item('L1'), item('L2'), item('L9')],
      ['L1', 'L2'],
    )
    expect(filtered.map((row) => row.loketKey)).toEqual(['L1', 'L2'])
  })
})

describe('shouldRefreshForHint', () => {
  it('refreshes when hint loketKey is null', () => {
    expect(shouldRefreshForHint(null, ['L1'])).toBe(true)
  })

  it('refreshes when hint matches configured set', () => {
    expect(shouldRefreshForHint('L1', ['L1', 'L2'])).toBe(true)
  })

  it('ignores unrelated loket keys', () => {
    expect(shouldRefreshForHint('L9', ['L1', 'L2'])).toBe(false)
  })
})
