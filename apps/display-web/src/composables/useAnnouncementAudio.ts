import { ref, watch, type Ref } from 'vue'
import {
  applyAnnouncementGate,
  buildAudioQueue,
  type AnnouncementCandidate,
} from '../lib/announcementGate'
import type { CurrentLoketDisplayItem } from '@aq/shared-types'

export type PlayQueueFn = (files: string[]) => Promise<void>

export function defaultPlayQueue(
  files: string[],
  onPlayBlocked?: () => void
): Promise<void> {
  return new Promise(async (resolve) => {
    if (typeof window === 'undefined') {
      resolve()
      return
    }
    const baseUrl = (import.meta.env?.BASE_URL || '/').replace(/\/$/, '')
    const audioBase = `${baseUrl}/audio`

    for (const file of files) {
      const url = `${audioBase}/${file}`
      await new Promise<void>((next) => {
        const audio = new Audio(url)
        audio.onended = () => next()
        audio.onerror = (e) => {
          console.warn(`Failed to play audio file: ${url}`, e)
          next()
        }
        audio.play()
          .then(() => {
            // Successful play
          })
          .catch((err) => {
            console.warn(`Audio play failed: ${url}`, err)
            if (err && (err.name === 'NotAllowedError' || String(err).includes('NotAllowedError'))) {
              onPlayBlocked?.()
            }
            next()
          })
      })
    }
    resolve()
  })
}

export function useAnnouncementAudio(options: {
  items: Ref<CurrentLoketDisplayItem[] | undefined>
  audioEnabled: Ref<boolean>
  playQueue?: PlayQueueFn
}) {
  const lastVersions = ref(new Map<string, number>())
  const seeded = ref(false)
  const announcing = ref(false)
  const isAudioLocked = ref(false)

  const playQueueImpl = options.playQueue ?? ((files) => defaultPlayQueue(files, () => {
    isAudioLocked.value = true
  }))

  const lastCandidates = ref<AnnouncementCandidate[]>([])

  function unlockAudio() {
    isAudioLocked.value = false
    if (typeof window !== 'undefined') {
      const audio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAAA')
      audio.play()
        .then(() => {
          if (lastCandidates.value.length > 0) {
            void announceAll(lastCandidates.value)
          }
        })
        .catch((err) => console.warn('Unlock audio failed:', err))
    }
  }

  async function announceAll(candidates: AnnouncementCandidate[]) {
    if (!candidates.length) return
    lastCandidates.value = candidates
    announcing.value = true
    try {
      for (const candidate of candidates) {
        const queue = buildAudioQueue(candidate)
        await playQueueImpl(queue)
      }
    } finally {
      announcing.value = false
    }
  }

  watch(
    () => options.items.value,
    (items) => {
      if (!items) return
      const mode = seeded.value ? 'live' : 'seed'
      const result = applyAnnouncementGate(items, lastVersions.value, mode)
      lastVersions.value = result.nextVersions
      if (!seeded.value) {
        seeded.value = true
        return
      }
      if (!options.audioEnabled.value || result.toAnnounce.length === 0) return
      void announceAll(result.toAnnounce)
    },
    { deep: true },
  )

  function resetAnnouncementState() {
    lastVersions.value = new Map()
    seeded.value = false
    announcing.value = false
  }

  return {
    announcing,
    seeded,
    lastVersions,
    isAudioLocked,
    unlockAudio,
    resetAnnouncementState,
  }
}
