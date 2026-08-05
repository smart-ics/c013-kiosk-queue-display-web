<script setup lang="ts">
import { ref } from 'vue'
import KioskHeader from '../components/KioskHeader.vue'
import VirtualKeyboard from '../components/VirtualKeyboard.vue'

defineProps<{ intakeAvailable: boolean }>()
const emit = defineEmits<{
  startSearch: [keyword: string]
  scanBooking: []
  startWalkin: []
  startIntake: []
}>()

const lang = ref<'id' | 'en'>('id')
const keyword = ref('')
const searchInputRef = ref<HTMLInputElement | null>(null)

function submit() {
  if (!keyword.value.trim()) return
  emit('startSearch', keyword.value)
}
</script>

<template>
  <div class="kiosk-home">
    <KioskHeader :lang="lang" @toggle-lang="lang = $event" />

    <main class="kiosk-main">
      <div class="welcome">
        <h1 class="welcome-title">Selamat datang di RS Sehat Sejahtera</h1>
        <p class="welcome-sub">Masukkan data Anda untuk memulai</p>
      </div>

      <div class="search-section">
        <div class="search-input-row">
          <input
            ref="searchInputRef"
            v-model="keyword"
            class="search-input"
            type="text"
            inputmode="none"
            placeholder="Kode booking, nomor rujukan, nomor BPJS, nomor rekam medis, atau nama"
            data-testid="search-keyword"
            autofocus
            @keyup.enter="submit"
          />
          <button
            type="button"
            class="scan-btn"
            data-testid="scan-booking"
            @click="emit('scanBooking')"
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <rect x="3.5" y="3.5" width="7" height="7" rx="1.2" />
              <rect x="13.5" y="3.5" width="7" height="7" rx="1.2" />
              <rect x="3.5" y="13.5" width="7" height="7" rx="1.2" />
              <path d="M13.5 13.5h3.5v3.5h-3.5Z" />
              <path d="M20.5 17v3.5" />
              <path d="M17 20.5h3.5" />
            </svg>
            Scan QR
          </button>
        </div>

        <VirtualKeyboard v-model="keyword" />

        <button
          type="button"
          class="primary-btn primary-btn--search"
          :disabled="!keyword.trim()"
          data-testid="search-submit"
          @click="submit"
        >
          Lanjutkan
        </button>
      </div>

      <div class="search-alt-links">
        <button
          type="button"
          class="link-btn"
          data-testid="start-walkin"
          @click="emit('startWalkin')"
        >
          Daftar Tanpa Booking
        </button>
      </div>
    </main>

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
