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
  getHisApi,
} from '../infrastructure'
import { filterSnapshotByLoketIds } from '../lib/snapshot'
import { validateDisplayDeviceConfig } from '../lib/boot'
import { brandingService } from '../lib/branding'
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
const branding = brandingService.getBranding()

// Live Clock & Date
const currentTime = ref('')

function updateClock() {
  const now = new Date()
  currentTime.value = now.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

const businessDateQuery = useQuery({
  queryKey: computed(() => ['business-date', props.screenId] as const),
  enabled: computed(() => !!deviceConfig.value && !bootError.value),
  queryFn: async () => getHisApi().getBusinessDate(),
  staleTime: 5 * 60 * 1000,
})

const businessDate = computed(() => businessDateQuery.data.value?.businessDate ?? null)

const currentDate = computed(() => {
  if (businessDate.value) {
    const [y, m, d] = businessDate.value.split('-')
    try {
      return new Intl.DateTimeFormat('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date(Number(y), Number(m) - 1, Number(d)))
    } catch {
      // fallback
    }
  }
  const now = new Date()
  return now.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
})

// Advertising Panel - Wellness Tips Slideshow
const activeTipIndex = ref(3) // Default to "Istirahat Cukup & Berkualitas" as in mockup
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

const videoUrl = computed(() => {
  const base = import.meta.env.BASE_URL
  const baseSlash = base.endsWith('/') ? base : `${base}/`
  const path = brandingService.getVideoPath()
  if (/^https?:\/\//i.test(path) || path.startsWith('/')) {
    return path
  }
  return `${baseSlash}${path}`
})

const hospitalServices = computed(() => {
  const list = brandingService.getHospitalServices()
  return list.length > 0 ? list : [
    'Harap persiapkan kartu identitas diri (KTP/KIA), Kartu BPJS Kesehatan, dan Surat Rujukan (jika ada).'
  ]
})

const activeServiceIndex = ref(0)

let clockInterval: number
let tipsInterval: number
let serviceInterval: number

onMounted(() => {
  updateClock()
  clockInterval = window.setInterval(updateClock, 1000)
  tipsInterval = window.setInterval(() => {
    activeTipIndex.value = (activeTipIndex.value + 1) % wellnessTips.length
  }, 10000)
  serviceInterval = window.setInterval(() => {
    if (hospitalServices.value.length > 0) {
      activeServiceIndex.value = (activeServiceIndex.value + 1) % hospitalServices.value.length
    }
  }, 5000)
})

onUnmounted(() => {
  window.clearInterval(clockInterval)
  window.clearInterval(tipsInterval)
  window.clearInterval(serviceInterval)
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

const { announcing, isAudioLocked, unlockAudio } = useAnnouncementAudio({
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

function formatLoketTitle(loketKey: string): string {
  if (!loketKey) return '—'
  const match = /^L(\d+)$/i.exec(loketKey.trim())
  if (match) {
    return `Loket ${match[1]}`
  }
  return loketKey
}

function formatLoketCode(loketKey: string): string {
  if (!loketKey) return '—'
  const match = /^Loket\s*(\d+)$/i.exec(loketKey.trim())
  if (match) {
    return `L${match[1]}`
  }
  return loketKey.toUpperCase()
}
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
    <p v-if="isPreview" class="status-preview-bar">
      Mode Preview — audio dimatikan; konfigurasi tidak diubah.
    </p>

    <!-- Header -->
    <header class="display-header">
      <div class="brand-title">
        <svg class="hospital-brand-logo" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <!-- Heart Shape -->
          <path d="M18 31.5C18 31.5 5 23 5 13.5C5 8.8 8.8 5 13.5 5C16.2 5 17.5 6.4 18 7.3C18.5 6.4 19.8 5 22.5 5C27.2 5 31 8.8 31 13.5C31 23 18 31.5 18 31.5Z" fill="#F97316"/>
          <!-- Inner Medical Cross -->
          <rect x="15" y="10" width="6" height="14" rx="2" fill="#0F2850"/>
          <rect x="11" y="14" width="14" height="6" rx="2" fill="#0F2850"/>
          <rect x="16" y="11" width="4" height="12" rx="1.5" fill="#FFFFFF"/>
          <rect x="12" y="15" width="12" height="4" rx="1.5" fill="#FFFFFF"/>
        </svg>
        <div class="brand-text-col">
          <h1 class="hospital-main-name">{{ branding.name }}</h1>
          <span class="hospital-sub-tag">{{ branding.taglineId }}</span>
        </div>
      </div>

      <div class="header-right-meta">
        <div class="calendar-date-badge">
          <svg class="meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span class="date-txt">{{ currentDate }}</span>
        </div>

        <span class="header-divider">|</span>

        <span class="time-txt">{{ currentTime }}</span>

        <div class="screen-pill-badge">
          <span>Screen</span>
          <strong>{{ screenId }}</strong>
          <span v-if="isSnapshotFetching" class="dot" aria-hidden="true" />
        </div>
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
      <!-- Left Column (Queue info) -->
      <div class="queue-column">
        <!-- Hero Latest Call Card -->
        <div 
          class="latest-call-hero-card" 
          :class="{ flashing: isFlashing }"
        >
          <!-- Background ECG and Grid decoration -->
          <div class="hero-bg-ecg" aria-hidden="true">
            <svg viewBox="0 0 400 120" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M0 60 L120 60 L135 40 L150 90 L165 20 L180 80 L195 60 L400 60" />
            </svg>
          </div>
          <div class="hero-bg-dots" aria-hidden="true"></div>

          <!-- Top-left capsule badge -->
          <div class="hero-top-row">
            <span class="hero-capsule-badge">PANGGILAN TERAKHIR</span>
          </div>

          <!-- Queue Number & Loket -->
          <div class="hero-center-content">
            <h2 class="hero-queue-number">{{ latestCalledItem?.queueLabel ?? '—' }}</h2>
            <div class="hero-loket-code">{{ latestCalledItem ? formatLoketCode(latestCalledItem.loketKey) : '—' }}</div>
            
            <div class="hero-loket-name">
              <svg class="bell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span>{{ latestCalledItem ? formatLoketTitle(latestCalledItem.loketKey) : '—' }}</span>
            </div>

            <div v-if="latestCalledItem" class="hero-status-row">
              <span class="hero-status-dot"></span>
              <span>{{ displayStateLabel(latestCalledItem.displayState) }}</span>
            </div>
          </div>
        </div>

        <!-- Section: Daftar Loket Aktif -->
        <div class="loket-section-container">
          <h3 class="loket-section-title">DAFTAR LOKET AKTIF ({{ sortedItems.length }} LOKET)</h3>
          <div 
            class="loket-cards-grid"
            :class="{
              'grid-count-1': sortedItems.length === 1,
              'grid-count-2': sortedItems.length === 2,
              'grid-count-3': sortedItems.length === 3,
              'grid-count-4': sortedItems.length === 4,
              'grid-count-5-6': sortedItems.length === 5 || sortedItems.length === 6,
              'grid-count-many': sortedItems.length >= 7,
              'is-multi-row': sortedItems.length >= 4
            }"
          >
            <article 
              v-for="(item, idx) in sortedItems" 
              :key="item.loketKey" 
              class="active-loket-card"
              :class="{ 
                'is-primary-card': (latestCalledItem && item.loketKey === latestCalledItem.loketKey) || idx === 0,
                'is-secondary-card': !(latestCalledItem && item.loketKey === latestCalledItem.loketKey) && idx !== 0
              }"
            >
              <div class="card-top-row">
                <span class="loket-name-pill">
                  {{ formatLoketTitle(item.loketKey) }}
                </span>
                <span class="loket-state-badge">
                  <svg class="badge-bell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  <span>{{ displayStateLabel(item.displayState).toUpperCase() }}</span>
                </span>
              </div>

              <div class="card-number-area">
                <p class="card-queue-number">{{ item.queueLabel ?? '—' }}</p>
                <div class="card-loket-code-pill">{{ formatLoketCode(item.loketKey) }}</div>
              </div>

              <div class="card-bottom-row">
                <svg class="clock-mini-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span>{{ (item.displayState === 1 || item.displayState === 2) ? '1 Antrian Aktif' : 'Antrian Menunggu' }}</span>
              </div>
            </article>
          </div>
        </div>
      </div>

      <!-- Right Column (Media, Health Info, Stats) -->
      <div class="ads-column">
        <!-- 1. Video / Media Player Card -->
        <div class="media-card-container">
          <div class="media-card-header">
            <div class="header-left-title">
              <span class="info-orange-icon">ⓘ</span>
              <span class="header-text-title">INFORMASI MEDIS</span>
            </div>
          </div>

          <div class="simulated-video-container">
            <video
              class="real-video-player"
              :src="videoUrl"
              autoplay
              loop
              muted
              playsinline
            >
              Browser Anda tidak mendukung tag video.
            </video>
          </div>
        </div>

        <!-- 2. Wellness Tips Card -->
        <div class="wellness-tip-card">
          <div class="tip-header-row">
            <svg v-if="wellnessTips[activeTipIndex].icon === 'moon'" class="tip-icon" viewBox="0 0 24 24" fill="none" stroke="#EA580C" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
            <svg v-else-if="wellnessTips[activeTipIndex].icon === 'droplet'" class="tip-icon" viewBox="0 0 24 24" fill="none" stroke="#EA580C" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
            </svg>
            <svg v-else-if="wellnessTips[activeTipIndex].icon === 'shield'" class="tip-icon" viewBox="0 0 24 24" fill="none" stroke="#EA580C" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <svg v-else-if="wellnessTips[activeTipIndex].icon === 'leaf'" class="tip-icon" viewBox="0 0 24 24" fill="none" stroke="#EA580C" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 3.58 0 8a7 7 0 0 1-8 10z" />
            </svg>
            <svg v-else class="tip-icon" viewBox="0 0 24 24" fill="none" stroke="#EA580C" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            <h4 class="tip-title">{{ wellnessTips[activeTipIndex].title }}</h4>
          </div>

          <p class="tip-body-text">{{ wellnessTips[activeTipIndex].text }}</p>

          <div class="tip-pagination-dots">
            <span 
              v-for="(_, idx) in wellnessTips" 
              :key="idx" 
              class="pagination-dot"
              :class="{ active: idx === activeTipIndex }"
            ></span>
          </div>
        </div>

        <!-- 3. Statistics Card -->
        <div class="stats-card-container">
          <div class="stat-column">
            <div class="stat-icon-wrapper">
              <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <span class="stat-count-value">{{ totalActiveCounters }}</span>
            <span class="stat-count-label">LOKET AKTIF</span>
          </div>

          <div class="stat-vertical-divider"></div>

          <div class="stat-column">
            <div class="stat-icon-wrapper">
              <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <!-- Board body -->
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                <!-- Clip -->
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                <!-- Pen writing diagonal -->
                <path d="M10.4 11.6L16 6l2.8 2.8-5.6 5.6H10.4v-2.8z" />
              </svg>
            </div>
            <span class="stat-count-value">{{ inServiceCount }}</span>
            <span class="stat-count-label">MELAYANI</span>
          </div>

          <div class="stat-vertical-divider"></div>

          <div class="stat-column">
            <div class="stat-icon-wrapper">
              <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <span class="stat-count-value">{{ servedCount }}</span>
            <span class="stat-count-label">SELESAI</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Banner (Welcome & Instructions) -->
    <footer class="display-bottom-banner">
      <div class="banner-left-content">
        <div class="banner-shield-icon-badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
        </div>
        <div class="banner-text-block">
          <h4 class="banner-main-title">Selamat Datang di {{ branding.name }}</h4>
          <div class="carousel-container-vertical">
            <Transition name="slide-up" mode="out-in">
              <p :key="activeServiceIndex" class="banner-sub-text">
                {{ hospitalServices[activeServiceIndex] }}
              </p>
            </Transition>
          </div>
        </div>
      </div>

      <div class="banner-hospital-illustration" aria-hidden="true">
        <svg viewBox="0 0 180 60" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Hospital building silhouette graphic -->
          <rect x="50" y="15" width="80" height="45" rx="3" fill="#93C5FD" fill-opacity="0.35"/>
          <rect x="75" y="5" width="30" height="55" rx="3" fill="#60A5FA" fill-opacity="0.45"/>
          <rect x="85" y="10" width="10" height="10" rx="1" fill="#FFFFFF" fill-opacity="0.7"/>
          <rect x="85" y="25" width="10" height="8" rx="1" fill="#FFFFFF" fill-opacity="0.7"/>
          <rect x="85" y="38" width="10" height="22" rx="1" fill="#3B82F6" fill-opacity="0.5"/>
          <!-- Windows -->
          <rect x="58" y="22" width="8" height="8" rx="1" fill="#FFFFFF" fill-opacity="0.6"/>
          <rect x="58" y="35" width="8" height="8" rx="1" fill="#FFFFFF" fill-opacity="0.6"/>
          <rect x="114" y="22" width="8" height="8" rx="1" fill="#FFFFFF" fill-opacity="0.6"/>
          <rect x="114" y="35" width="8" height="8" rx="1" fill="#FFFFFF" fill-opacity="0.6"/>
          <!-- Trees / bushes -->
          <circle cx="35" cy="50" r="10" fill="#93C5FD" fill-opacity="0.3"/>
          <circle cx="145" cy="50" r="10" fill="#93C5FD" fill-opacity="0.3"/>
          <circle cx="160" cy="52" r="8" fill="#60A5FA" fill-opacity="0.25"/>
        </svg>
      </div>
    </footer>

    <!-- Autoplay Audio Blocked Banner -->
    <div v-if="isAudioLocked" class="audio-blocked-banner" @click="unlockAudio">
      <div class="audio-blocked-content">
        <svg class="warning-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <span>Browser memblokir suara otomatis. Klik untuk mengaktifkan suara pemanggilan.</span>
      </div>
      <button class="btn-enable-audio">Aktifkan</button>
    </div>
  </main>
</template>

