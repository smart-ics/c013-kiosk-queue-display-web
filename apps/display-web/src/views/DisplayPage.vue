<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import type { DeviceConfig } from '@aq/shared-types'
import {
  DeviceConfigInvalidError,
  DeviceConfigNotFoundError,
} from '@aq/device-config'
import {
  getDeviceConfigProvider,
  getRuntimeDeviceApi,
} from '../infrastructure'
import { filterSnapshotByLoketIds } from '../lib/snapshot'
import { validateDisplayDeviceConfig } from '../lib/boot'
import { displayStateLabel } from '../lib/displayState'
import { useAnnouncementAudio } from '../composables/useAnnouncementAudio'
import { useDisplaySignalR } from '../composables/useDisplaySignalR'
import { useVersionAutoRefresh } from '../composables/useVersionAutoRefresh'
import BootErrorPage from './BootErrorPage.vue'

const props = defineProps<{
  screenId: string
}>()

const route = useRoute()
const isPreview = computed(() => String(route.query.preview ?? '') === '1')

const DEFAULT_POLL_MS = 15_000
const CONFIG_REFRESH_MS = 60_000

const bootError = ref<string | null>(null)
const deviceConfig = ref<DeviceConfig | null>(null)
const queryClient = useQueryClient()

// Live Clock & Date
const currentTime = ref('')
const currentDate = ref('')

function updateClock() {
  const now = new Date()
  currentTime.value = now.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  currentDate.value = now.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

// Advertising Panel - Wellness Tips Slideshow
const activeTipIndex = ref(0)
const wellnessTips = [
  {
    title: 'Minum Air Putih Cukup',
    text: 'Minum minimal 8 gelas air putih sehari untuk menjaga hidrasi tubuh, meningkatkan konsentrasi, dan mendukung metabolisme.',
    icon: 'droplet',
  },
  {
    title: 'Cuci Tangan Teratur',
    text: 'Cuci tangan dengan sabun dan air mengalir secara berkala untuk menyingkirkan kuman dan mencegah penyebaran infeksi.',
    icon: 'shield',
  },
  {
    title: 'Konsumsi Sayur & Buah',
    text: 'Penuhi piring Anda dengan sayuran hijau dan buah segar yang kaya vitamin serta antioksidan untuk kekebalan tubuh.',
    icon: 'leaf',
  },
  {
    title: 'Istirahat Cukup & Berkualitas',
    text: 'Tidur malam secara teratur selama 7-8 jam membantu proses pemulihan otot, otak, dan memperbaharui sel-sel tubuh.',
    icon: 'moon',
  },
  {
    title: 'Aktivitas Fisik Harian',
    text: 'Lakukan olahraga ringan atau jalan santai selama 15-30 menit setiap hari agar sirkulasi darah tetap lancar.',
    icon: 'activity',
  },
]

let clockInterval: number
let tipsInterval: number

onMounted(() => {
  updateClock()
  clockInterval = window.setInterval(updateClock, 1000)
  tipsInterval = window.setInterval(() => {
    activeTipIndex.value = (activeTipIndex.value + 1) % wellnessTips.length
  }, 10000)
})

onUnmounted(() => {
  window.clearInterval(clockInterval)
  window.clearInterval(tipsInterval)
  window.clearTimeout(flashTimeout)
})

watch(
  () => props.screenId,
  async (rawScreenId, _prev, onCleanup) => {
    let cancelled = false
    onCleanup(() => {
      cancelled = true
    })

    bootError.value = null
    deviceConfig.value = null
    const screenId = rawScreenId?.trim()
    if (!screenId) {
      return
    }

    try {
      const provider = await getDeviceConfigProvider()
      const config = await provider.getConfig(screenId)
      if (cancelled) return
      const validation = validateDisplayDeviceConfig(screenId, config)
      if (!validation.ok) {
        bootError.value = validation.message
        return
      }
      deviceConfig.value = config
    } catch (error) {
      if (cancelled) return
      if (error instanceof DeviceConfigNotFoundError) {
        bootError.value = `Konfigurasi tidak ditemukan untuk screen '${error.deviceId}'.`
        return
      }
      if (error instanceof DeviceConfigInvalidError) {
        bootError.value = `Konfigurasi tidak valid untuk '${error.deviceId}': ${error.message}`
        return
      }
      bootError.value = error instanceof Error ? error.message : 'Boot gagal.'
    }
  },
  { immediate: true },
)

const configuredLoketIds = computed(() => deviceConfig.value?.loketIds ?? [])
const pollIntervalMs = computed(() => deviceConfig.value?.pollIntervalMs ?? DEFAULT_POLL_MS)
const audioEnabled = computed(
  () => !isPreview.value && deviceConfig.value?.audioEnabled !== false,
)
const displayReady = computed(() => !!deviceConfig.value && !bootError.value)

watch(
  displayReady,
  (ready, _prev, onCleanup) => {
    if (!ready) return
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const provider = await getDeviceConfigProvider()
          const config = await provider.getConfig(props.screenId.trim())
          const validation = validateDisplayDeviceConfig(props.screenId.trim(), config)
          if (!validation.ok) {
            bootError.value = validation.message
            deviceConfig.value = null
            return
          }
          deviceConfig.value = config
        } catch (error) {
          if (error instanceof DeviceConfigInvalidError || error instanceof DeviceConfigNotFoundError) {
            bootError.value =
              error instanceof DeviceConfigNotFoundError
                ? `Konfigurasi tidak ditemukan untuk screen '${error.deviceId}'.`
                : `Konfigurasi tidak valid untuk '${error.deviceId}': ${error.message}`
            deviceConfig.value = null
          }
        }
      })()
    }, CONFIG_REFRESH_MS)
    onCleanup(() => window.clearInterval(timer))
  },
)

const snapshotQuery = useQuery({
  queryKey: computed(() => ['display-snapshot', props.screenId, configuredLoketIds.value] as const),
  enabled: displayReady,
  refetchInterval: pollIntervalMs,
  queryFn: async () => {
    const items = await getRuntimeDeviceApi().getPublicDisplaySnapshot(props.screenId.trim())
    return filterSnapshotByLoketIds(items, configuredLoketIds.value)
  },
})

const snapshotItems = computed(() => snapshotQuery.data.value)
const isSnapshotError = computed(() => snapshotQuery.isError.value)
const isSnapshotFetching = computed(() => snapshotQuery.isFetching.value)
const snapshotErrorMessage = computed(() => {
  const error = snapshotQuery.error.value as unknown
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return 'Permintaan snapshot gagal tanpa detail error.'
})

const { announcing } = useAnnouncementAudio({
  items: snapshotItems,
  audioEnabled,
})

function refetchSnapshot() {
  void queryClient.invalidateQueries({
    queryKey: ['display-snapshot', props.screenId],
  })
}

useDisplaySignalR({
  enabled: displayReady,
  configuredLoketIds,
  onRefresh: refetchSnapshot,
})

const idle = computed(() => !announcing.value)

useVersionAutoRefresh({
  enabled: displayReady,
  idle,
})

const sortedItems = computed(() => {
  const items = snapshotItems.value ?? []
  return [...items].sort((a, b) => a.loketKey.localeCompare(b.loketKey))
})

// Latest Called Item Logic
const latestCalledItem = computed(() => {
  const items = snapshotItems.value ?? []
  const activeItems = items.filter((item) => !!item.queueLabel)
  if (activeItems.length === 0) return null

  // 1. Try to find the latest item currently being called (Outstanding = 1)
  const outstanding = activeItems.filter((item) => item.displayState === 1)
  if (outstanding.length > 0) {
    return [...outstanding].sort((a, b) => {
      const timeA = new Date(a.calledAt).getTime()
      const timeB = new Date(b.calledAt).getTime()
      if (timeA !== timeB) return timeB - timeA
      return b.announcementVersion - a.announcementVersion
    })[0]
  }

  // 2. Fallback to the latest called item among all active items
  return [...activeItems].sort((a, b) => {
    const timeA = new Date(a.calledAt).getTime()
    const timeB = new Date(b.calledAt).getTime()
    if (timeA !== timeB) return timeB - timeA
    return b.announcementVersion - a.announcementVersion
  })[0] ?? null
})

// Flashing border effect state on new call
const isFlashing = ref(false)
let flashTimeout: number

watch(
  () => latestCalledItem.value?.calledAt,
  (newVal, oldVal) => {
    if (newVal && oldVal && newVal !== oldVal) {
      isFlashing.value = true
      window.clearTimeout(flashTimeout)
      flashTimeout = window.setTimeout(() => {
        isFlashing.value = false
      }, 5000)
    }
  },
)

// Statistics Calculations
const totalActiveCounters = computed(() => configuredLoketIds.value.length)
const servedCount = computed(() => {
  const items = snapshotItems.value ?? []
  return items.filter((item) => item.displayState === 0 && !!item.queueLabel).length
})
const inServiceCount = computed(() => {
  const items = snapshotItems.value ?? []
  return items.filter((item) => item.displayState === 2).length
})
</script>

<template>
  <BootErrorPage
    v-if="bootError"
    title="Queue Display — Boot gagal"
    :message="bootError"
  />

  <main v-else-if="!deviceConfig" class="display-root">
    <p class="loading">Memuat konfigurasi…</p>
  </main>

  <main v-else class="display-root">
    <p v-if="isPreview" class="status" style="background:#fff3cd;color:#7a5b00;padding:0.5rem 1rem;margin:0;z-index:20;font-weight:600;font-size:0.9rem;text-align:center;">
      Mode Preview — audio dimatikan; konfigurasi tidak diubah.
    </p>

    <!-- Header -->
    <header class="display-header">
      <div class="brand-title">
        <span class="logo-dot"></span>
        <h1>Antrean Admisi</h1>
        <span class="hospital-sub">RS Sehat Waluyo</span>
      </div>
      <div class="screen-meta">
        Screen <strong>{{ screenId }}</strong>
        <span v-if="isSnapshotFetching" class="dot" aria-hidden="true" />
      </div>
      <div class="clock-display">
        <span class="date-txt">{{ currentDate }}</span>
        <span class="divider">|</span>
        <span class="time-txt">{{ currentTime }}</span>
      </div>
    </header>

    <!-- Error state -->
    <p v-if="isSnapshotError" class="status error" style="margin: 1.5rem 1.5rem 0; padding: 1rem; background: #fdf2f2; border: 1px solid #fde8e8; border-radius: 12px; color: var(--danger); font-size: 0.95rem;">
      Gagal memuat snapshot: {{ snapshotErrorMessage }} Polling akan mencoba lagi.
    </p>

    <!-- Empty state -->
    <div v-else-if="sortedItems.length === 0" class="empty">
      <svg style="width:3rem; height:3rem; color:var(--text-tertiary); margin-bottom:1rem;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
      </svg>
      <p>Belum ada panggilan aktif.</p>
    </div>

    <!-- Main Content Split Grid -->
    <div v-else class="main-content-grid">
      <!-- Left Column -->
      <div class="queue-column">
        <!-- Hero Latest Call Card -->
        <div 
          class="latest-call-card" 
          :class="{ flashing: isFlashing }"
        >
          <span class="latest-badge">Panggilan Terakhir</span>
          <h2 class="latest-number">{{ latestCalledItem?.queueLabel ?? '—' }}</h2>
          <p class="latest-loket">{{ latestCalledItem?.loketKey ?? '—' }}</p>
          <div v-if="latestCalledItem" class="latest-state">
            <span class="latest-state-dot"></span>
            <span>{{ displayStateLabel(latestCalledItem.displayState) }}</span>
          </div>
        </div>

        <!-- Other Active Lokets -->
        <div class="loket-list-container">
          <h3 class="section-title">Daftar Loket Aktif</h3>
          <section class="loket-grid">
            <article 
              v-for="item in sortedItems" 
              :key="item.loketKey" 
              class="loket-card"
              :class="{ 'is-latest-target': latestCalledItem && item.loketKey === latestCalledItem.loketKey }"
            >
              <p class="loket-key">{{ item.loketKey }}</p>
              <p class="queue-label">{{ item.queueLabel ?? '—' }}</p>
              <p class="state">{{ displayStateLabel(item.displayState) }}</p>
            </article>
          </section>
        </div>
      </div>

      <!-- Right Column -->
      <div class="ads-column">
        <div class="advertising-panel">
          <!-- Video Player Simulation -->
          <div class="simulated-video-player">
            <div class="video-badge">Informasi Medis</div>
            <div class="video-graphic-bg">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.5" stroke-linecap="round" stroke-linejoin="round" style="width: 70%; height: 70%;">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
              </svg>
            </div>
            <div class="video-play-btn">
              <svg class="video-play-icon" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <div class="video-controls">
              <span>01:45 / 03:00</span>
              <div class="video-progress-bar">
                <div class="video-progress-fill"></div>
              </div>
              <span>1080p Full HD</span>
            </div>
          </div>

          <!-- Wellness tips slideshow -->
          <div class="wellness-slideshow">
            <div class="slide-content" :key="activeTipIndex">
              <div class="slide-header">
                <svg v-if="wellnessTips[activeTipIndex].icon === 'droplet'" class="slide-icon" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                  <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
                </svg>
                <svg v-else-if="wellnessTips[activeTipIndex].icon === 'shield'" class="slide-icon" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <svg v-else-if="wellnessTips[activeTipIndex].icon === 'leaf'" class="slide-icon" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                  <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 3.58 0 8a7 7 0 0 1-8 10z" />
                </svg>
                <svg v-else-if="wellnessTips[activeTipIndex].icon === 'moon'" class="slide-icon" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
                <svg v-else-if="wellnessTips[activeTipIndex].icon === 'activity'" class="slide-icon" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
                <h4 class="slide-title">{{ wellnessTips[activeTipIndex].title }}</h4>
              </div>
              <p class="slide-text">{{ wellnessTips[activeTipIndex].text }}</p>
            </div>
            <div class="slide-dots">
              <span 
                v-for="(_, idx) in wellnessTips" 
                :key="idx" 
                class="dot-indicator"
                :class="{ active: idx === activeTipIndex }"
              ></span>
            </div>
          </div>

          <!-- Quick Statistics -->
          <div class="hospital-stats">
            <div class="stat-item">
              <span class="stat-val">{{ totalActiveCounters }}</span>
              <span class="stat-label">Loket Aktif</span>
            </div>
            <div class="stat-item">
              <span class="stat-val">{{ inServiceCount }}</span>
              <span class="stat-label">Melayani</span>
            </div>
            <div class="stat-item">
              <span class="stat-val">{{ servedCount }}</span>
              <span class="stat-label">Selesai</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer Marquee -->
    <footer class="display-footer">
      <div class="marquee-wrapper">
        <div class="marquee-content">
          Selamat Datang di Rumah Sakit Sehat Waluyo. Harap persiapkan kartu identitas diri (KTP/KIA), Kartu BPJS Kesehatan, dan Surat Rujukan Anda sebelum melakukan pendaftaran di Loket Admisi. Tetap patuhi protokol kesehatan, menjaga kebersihan, dan saling menghormati kenyamanan sesama pengunjung. Terima kasih atas kerja sama Anda.
        </div>
      </div>
    </footer>
  </main>
</template>
