import { ref, watch, type Ref } from 'vue'
import {
  applyAnnouncementGate,
  buildAnnouncementUtterance,
  type AnnouncementCandidate,
} from '../lib/announcementGate'
import type { CurrentLoketDisplayItem } from '@aq/shared-types'

export type SpeakFn = (text: string) => Promise<void>

function defaultSpeak(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve()
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'id-ID'
    utterance.onend = () => resolve()
    utterance.onerror = () => resolve()
    window.speechSynthesis.speak(utterance)
  })
}

export function useAnnouncementAudio(options: {
  items: Ref<CurrentLoketDisplayItem[] | undefined>
  audioEnabled: Ref<boolean>
  speak?: SpeakFn
}) {
  const lastVersions = ref(new Map<string, number>())
  const seeded = ref(false)
  const announcing = ref(false)
  const speak = options.speak ?? defaultSpeak

  async function announceAll(candidates: AnnouncementCandidate[]) {
    if (!candidates.length) return
    announcing.value = true
    try {
      for (const candidate of candidates) {
        await speak(buildAnnouncementUtterance(candidate))
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
    resetAnnouncementState,
  }
}
