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

export function parseQueueLabel(label: string): { letters: string[]; number: number | null } {
  const trimmed = label.trim()
  const letterMatch = trimmed.match(/^[a-zA-Z]+/)
  const lettersStr = letterMatch ? letterMatch[0] : ''
  const letters = lettersStr.toLowerCase().split('')

  const numberStr = trimmed.substring(lettersStr.length).replace(/[^0-9]/g, '')
  const number = numberStr ? parseInt(numberStr, 10) : null

  return { letters, number }
}

export function decomposeNumber(n: number): string[] {
  if (n <= 0) return []
  if (n > 9999) {
    return n.toString().split('').map((digit) => `numbers/${digit}.wav`)
  }

  const result: string[] = []
  let remaining = n

  // Thousands
  if (remaining >= 1000) {
    const thousands = Math.floor(remaining / 1000) * 1000
    if (thousands <= 5000) {
      result.push(`numbers/${thousands}.wav`)
    } else {
      return n.toString().split('').map((digit) => `numbers/${digit}.wav`)
    }
    remaining %= 1000
  }

  // Hundreds
  if (remaining >= 100) {
    const hundreds = Math.floor(remaining / 100) * 100
    result.push(`numbers/${hundreds}.wav`)
    remaining %= 100
  }

  // Tens and units
  if (remaining >= 20) {
    const tens = Math.floor(remaining / 10) * 10
    result.push(`numbers/${tens}.wav`)
    remaining %= 10
  }

  if (remaining > 0) {
    result.push(`numbers/${remaining}.wav`)
  }

  return result
}

export function buildAudioQueue(candidate: {
  loketKey: string
  queueLabel: string | null
}): string[] {
  const queue: string[] = []

  // 1. Chime
  queue.push('soundrs.m4a')

  // 2. "Nomor antrian" phrase
  queue.push('phrases/nomor-antrian.wav')

  // 3. Letters & Numbers from queueLabel
  if (candidate.queueLabel) {
    const { letters, number } = parseQueueLabel(candidate.queueLabel)
    
    // Letters
    for (const letter of letters) {
      queue.push(`letters/${letter}.wav`)
    }

    // Number part
    if (number !== null) {
      queue.push(...decomposeNumber(number))
    }
  }

  // 4. "Silakan menuju" phrase
  queue.push('phrases/silakan-menuju.wav')

  // 5. Loket / Counter phrase and number
  const loketNum = parseInt(candidate.loketKey, 10)
  if (!isNaN(loketNum) && loketNum >= 1 && loketNum <= 10) {
    queue.push(`counters/loket-${loketNum}.wav`)
  } else {
    queue.push('phrases/loket.wav')
    if (!isNaN(loketNum) && loketNum > 0) {
      queue.push(...decomposeNumber(loketNum))
    } else {
      const cleanLoketKey = candidate.loketKey.trim().toLowerCase()
      for (const char of cleanLoketKey) {
        if (/[a-z]/.test(char)) {
          queue.push(`letters/${char}.wav`)
        } else if (/[0-9]/.test(char)) {
          queue.push(`numbers/${char}.wav`)
        }
      }
    }
  }

  return queue
}
