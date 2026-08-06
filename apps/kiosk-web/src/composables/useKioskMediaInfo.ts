import { computed, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { listMediaFromDirectory } from '../lib/mediaDirectory'

export type LoadMediaListFn = (dirUrl: string) => Promise<string[]>

export interface KioskMediaInfoOptions {
  directoryUrl: MaybeRefOrGetter<string | null>
  fallbackVideoUrl: string
  loadList?: LoadMediaListFn
}

export function useKioskMediaInfo(options: KioskMediaInfoOptions) {
  const loadList = options.loadList ?? listMediaFromDirectory
  const videoUrls = ref<string[]>([])
  const currentIndex = ref(0)
  const videoError = ref(false)
  const pending = ref(true)

  const currentVideoUrl = computed(() => videoUrls.value[currentIndex.value] ?? null)

  async function load() {
    const directoryUrl = toValue(options.directoryUrl)
    pending.value = true
    videoError.value = false
    let urls: string[] = []
    if (directoryUrl) {
      try {
        urls = await loadList(directoryUrl)
      } catch {
        urls = []
      }
    }
    videoUrls.value = urls.length > 0 ? urls : [options.fallbackVideoUrl]
    pending.value = false
  }

  watch(() => toValue(options.directoryUrl), load, { immediate: true })

  watch(videoUrls, () => {
    currentIndex.value = 0
  })

  function onVideoEnded() {
    if (videoUrls.value.length === 0) return
    currentIndex.value = (currentIndex.value + 1) % videoUrls.value.length
  }

  function onVideoError() {
    if (videoUrls.value.length <= 1) {
      videoError.value = true
      return
    }
    currentIndex.value = (currentIndex.value + 1) % videoUrls.value.length
  }

  return {
    videoUrls,
    currentVideoUrl,
    videoError,
    pending,
    onVideoEnded,
    onVideoError,
  }
}
