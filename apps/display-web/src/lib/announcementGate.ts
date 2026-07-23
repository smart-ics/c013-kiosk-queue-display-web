import type { CurrentLoketDisplayItem } from '@aq/shared-types'

export type AnnouncementCandidate = {
  loketKey: string
  queueLabel: string | null
  announcementVersion: number
}

export type AnnouncementGateResult = {
  nextVersions: Map<string, number>
  toAnnounce: AnnouncementCandidate[]
}

/**
 * Snapshot-first audio gate.
 * - `seed`: record versions without announcing (cold start / first frame)
 * - `live`: announce only when announcementVersion increases per loket
 */
export function applyAnnouncementGate(
  items: Array<Pick<CurrentLoketDisplayItem, 'loketKey' | 'queueLabel' | 'announcementVersion'>>,
  previous: ReadonlyMap<string, number>,
  mode: 'seed' | 'live',
): AnnouncementGateResult {
  const nextVersions = new Map(previous)
  const toAnnounce: AnnouncementCandidate[] = []

  for (const item of items) {
    const last = previous.get(item.loketKey)
    if (mode === 'seed' || last === undefined) {
      nextVersions.set(item.loketKey, item.announcementVersion)
      continue
    }
    if (item.announcementVersion > last) {
      toAnnounce.push({
        loketKey: item.loketKey,
        queueLabel: item.queueLabel,
        announcementVersion: item.announcementVersion,
      })
      nextVersions.set(item.loketKey, item.announcementVersion)
    } else {
      nextVersions.set(item.loketKey, Math.max(last, item.announcementVersion))
    }
  }

  return { nextVersions, toAnnounce }
}

export function buildAnnouncementUtterance(candidate: AnnouncementCandidate): string {
  const label = candidate.queueLabel?.trim() || 'tanpa label'
  return `Nomor ${label}, loket ${candidate.loketKey}`
}
