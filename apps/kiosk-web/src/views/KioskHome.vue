<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { configService } from '@aq/app-config'
import KioskHeader from '../components/KioskHeader.vue'
import VirtualKeyboard from '../components/VirtualKeyboard.vue'
import { useKioskMediaInfo } from '../composables/useKioskMediaInfo'
import { resolveMediaDirUrl } from '../lib/mediaDirectory'
import { getKodeBookingMjkn } from '../lib/qrCodeDecoder'

const props = withDefaults(
  defineProps<{
    intakeAvailable: boolean
    businessDate: string | null
    pending?: boolean
  }>(),
  {
    pending: false,
  }
)

const emit = defineEmits<{
  startSearch: [keyword: string]
  startIntake: []
}>()

const lang = ref<'id' | 'en'>('id')
const mediaInfoDir = configService.getConfig().mediaInfoDir
const directoryUrl = mediaInfoDir?.trim()
  ? resolveMediaDirUrl(import.meta.env.BASE_URL, mediaInfoDir.trim())
  : null
const fallbackVideoUrl = `${import.meta.env.BASE_URL}adv-video.mp4`
const { videoUrls, currentVideoUrl, videoError, onVideoEnded, onVideoError } = useKioskMediaInfo({
  directoryUrl,
  fallbackVideoUrl,
})
const keyword = ref('')
const searchInputRef = ref<HTMLInputElement | null>(null)

function submit() {
  if (props.pending || !keyword.value.trim()) return
  const decoded = getKodeBookingMjkn(keyword.value.trim())
  emit('startSearch', decoded)
}

function onPhysicalKeydown(event: KeyboardEvent) {
  if (props.pending) return
  if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
    const activeEl = document.activeElement
    if (activeEl !== searchInputRef.value && !(activeEl instanceof HTMLInputElement) && !(activeEl instanceof HTMLTextAreaElement)) {
      searchInputRef.value?.focus()
    }
  }
}

onMounted(() => {
  searchInputRef.value?.focus()
  document.addEventListener('keydown', onPhysicalKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onPhysicalKeydown)
})
</script>

<template>
  <div :class="{ 'interaction-disabled': pending }" class="kiosk-home">
    <KioskHeader :lang="lang" :business-date="businessDate" @toggle-lang="lang = $event" />

    <div class="kiosk-layout">
      <aside class="kiosk-ad" data-testid="kiosk-ad-panel">
        <template v-if="!videoError && currentVideoUrl">
          <video
            :src="currentVideoUrl"
            :loop="videoUrls.length === 1"
            class="kiosk-ad-video"
            autoplay
            muted
            playsinline
            data-testid="media-video"
            @ended="onVideoEnded"
            @error="onVideoError"
          />
          <p class="kiosk-ad-caption">Media &amp; Informasi Layanan RS</p>
        </template>
        <div v-else class="kiosk-ad-media">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M8 21h8" />
            <path d="M12 17v4" />
          </svg>
          <p>Media &amp; Informasi Layanan RS</p>
        </div>
      </aside>

      <section class="kiosk-input-section">
        <div class="welcome">
          <h1 class="welcome-title">Selamat datang di RS Sehat Sejahtera</h1>
          <p class="welcome-sub">Masukkan data Anda untuk memulai</p>
        </div>

        <div class="search-section">
          <input
            ref="searchInputRef"
            v-model="keyword"
            class="search-input"
            type="text"
            inputmode="none"
            placeholder="Kode booking, nomor rujukan, nomor BPJS, nomor rekam medis, atau nama"
            data-testid="search-keyword"
            :disabled="pending"
            autofocus
            @keyup.enter="submit"
          />

          <VirtualKeyboard v-model="keyword" :disabled="pending" @submit="submit" />

          <button
            type="button"
            class="primary-btn primary-btn--search"
            :disabled="pending || !keyword.trim()"
            data-testid="search-submit"
            @click="submit"
          >
            <template v-if="pending">
              <span class="spinner" aria-hidden="true"></span>
              Mohon tunggu...
            </template>
            <template v-else>
              Lanjutkan Registrasi
              <svg
                class="btn-arrow"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </template>
          </button>
        </div>

        <div class="queue-intake-link">
          <button
            type="button"
            class="queue-intake-btn"
            data-testid="start-intake"
            :disabled="pending"
            @click="emit('startIntake')"
          >
            Ambil Antrian Admisi
          </button>
        </div>
      </section>
    </div>

    <footer class="kiosk-footer">
      <span class="footer-item">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3.5 2" />
        </svg>
        Rata-rata tunggu: 25–35 menit
      </span>
      <span class="footer-sep" aria-hidden="true">•</span>
      <span class="footer-item">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5a9 9 0 0 1 18 0v5a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
        </svg>
        Butuh bantuan? Hubungi petugas di dekat kiosk
      </span>
      <span class="footer-sep" aria-hidden="true">•</span>
      <span class="footer-item">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <circle cx="16" cy="4" r="1.2" />
          <path d="m18 19 1-7-6 1" />
          <path d="m5 8 3-3 5.5 3-2.36 3.5" />
          <path d="M4.24 14.5a5 5 0 0 0 6.88 6" />
          <path d="M13.76 17.5a5 5 0 0 0-6.88-6" />
        </svg>
        Ramah difabel · Layar bersih otomatis 30 detik
      </span>
    </footer>
  </div>
</template>
