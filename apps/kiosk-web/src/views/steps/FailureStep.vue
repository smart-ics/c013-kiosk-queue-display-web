<script setup lang="ts">
import type { AdmissionServicePoint } from '@aq/shared-types'
import type { FailureContext } from '../../composables/useKioskRegistration'
import { getFailureMessage } from '../../lib/failureCode'

defineProps<{
  errorContext: FailureContext
  offerings: AdmissionServicePoint[]
  pending: boolean
}>()
defineEmits<{
  selectServicePoint: [servicePointId: string]
  back: []
}>()

function isBpjs(sp: AdmissionServicePoint): boolean {
  const name = (sp.displayName || '').toLowerCase()
  const id = (sp.servicePointId || '').toLowerCase()
  return name.includes('bpjs') || name.includes('jkn') || id.includes('bpjs') || id.includes('jkn')
}

const HTTP_STATUS_MESSAGES_ID: Record<number, string> = {
  0: 'Koneksi ke server terputus. Periksa jaringan dan coba lagi.',
  401: 'Sesi habis. Silakan mulai ulang aplikasi kiosk.',
  403: 'Anda tidak memiliki izin untuk aksi ini. Hubungi administrator.',
  404: 'Data yang dicari tidak ditemukan. Silakan hubungi petugas.',
  409: 'Data telah diubah oleh pengguna lain. Silakan muat ulang dan coba lagi.',
  422: 'Data yang diinput tidak valid. Periksa kembali dan coba lagi.',
  500: 'Terjadi kesalahan pada server. Silakan coba lagi.',
  503: 'Layanan sementara tidak tersedia. Coba lagi dalam waktu yang singkat.',
}

function normalizeGenericHttpMessage(message: string): string | null {
  const match = message.match(/\brequest failed with status(?: code)?\s+(\d{3})\b/i)
  if (!match) return null
  const status = Number(match[1])
  return HTTP_STATUS_MESSAGES_ID[status] ?? null
}

function getDisplayMessage(ctx: FailureContext): string {
  const raw = (ctx.message || '').trim()
  if (!raw) return getFailureMessage(ctx.code)
  const normalized = normalizeGenericHttpMessage(raw)
  return normalized || raw
}
</script>

<template>
  <section
    class="panel"
    style="
      background: transparent;
      border: none;
      box-shadow: none;
      padding: 0;
      width: 100%;
      max-width: 900px;
      height: 100%;
      display: flex;
      flex-direction: column;
    "
  >
    <!-- Problem Title & Warning Icon -->
    <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px; justify-content: center;">
      <div style="background: var(--danger-soft); color: var(--danger); width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex: none;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </div>
      <h1 style="margin: 0; font-size: clamp(1.8rem, 3vw, 2.4rem); font-weight: 800; color: var(--text); text-align: left;">
        Registrasi Tidak Dapat Diproses
      </h1>
    </div>

    <!-- Scrollable container to prevent overflow -->
    <div
      class="step-content-area"
      style="
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        width: 100%;
        padding-bottom: 16px;
      "
    >
      <!-- Explanation Card (Soft red warning card) -->
      <div
        style="
          background: var(--danger-soft);
          border: 1.5px solid var(--danger-border);
          border-radius: 16px;
          padding: 20px;
          display: flex;
          gap: 16px;
          align-items: start;
          margin-bottom: 24px;
          width: 100%;
          box-sizing: border-box;
        "
      >
        <div style="color: var(--danger); flex: none; display: flex; align-items: center; justify-content: center; width: 48px; height: 48px; background: var(--danger-soft); border-radius: 12px; border: 1px solid var(--danger-border);">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <line x1="7" y1="8" x2="17" y2="8" />
            <line x1="7" y1="12" x2="17" y2="12" />
            <line x1="7" y1="16" x2="13" y2="16" />
          </svg>
        </div>
        <div style="flex: 1; text-align: left;">
          <p class="status error" data-testid="failure-message" style="margin: 0; font-size: 1.15rem; font-weight: 600; color: var(--danger); line-height: 1.5;">
            {{ getDisplayMessage(errorContext) }}
          </p>
        </div>
      </div>

      <!-- Instruction -->
      <p style="font-size: 1.1rem; color: var(--text-secondary); margin-bottom: 24px; font-weight: 500; text-align: center;">
        Silakan pilih loket bantuan pendaftaran untuk mendapatkan nomor antrian.
      </p>

      <!-- Choose Counter Grid -->
      <div class="kiosk-grid-2x2" style="width: 100%; padding-bottom: 24px;">
        <button
          v-for="sp in offerings"
          :key="sp.servicePointId"
          type="button"
          class="radio-card"
          :disabled="pending"
          :data-testid="`assist-${sp.servicePointId}`"
          @click="$emit('selectServicePoint', sp.servicePointId)"
          style="min-height: 88px;"
        >
          <!-- Card Icon -->
          <div
            class="radio-card-icon"
            :style="{
              background: isBpjs(sp) ? 'var(--green-soft)' : 'var(--brand-soft)',
              color: isBpjs(sp) ? 'var(--green-strong)' : 'var(--brand-strong)'
            }"
          >
            <!-- Card/BPJS Icon vs Patient Icon -->
            <svg v-if="isBpjs(sp)" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <line x1="7" y1="8" x2="17" y2="8" />
              <line x1="7" y1="12" x2="17" y2="12" />
              <line x1="7" y1="16" x2="13" y2="16" />
            </svg>
            <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>

          <!-- Card Content (Labels) -->
          <div class="radio-card-content">
            <h4 class="radio-card-title">{{ sp.displayName }}</h4>
            <p class="radio-card-subtitle">{{ sp.queuePrefix }} - {{ sp.displayName }}</p>
          </div>

          <!-- Select Arrow -->
          <div
            class="select-arrow"
            :style="{
              background: isBpjs(sp) ? 'var(--green-soft)' : '',
              color: isBpjs(sp) ? 'var(--green-strong)' : ''
            }"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="13 17 18 12 13 7"></polyline>
              <polyline points="6 17 11 12 6 7"></polyline>
            </svg>
          </div>
        </button>
      </div>

      <p v-if="pending" class="status" style="text-align: center; margin-top: 12px; font-weight: 600; color: var(--text-secondary);">
        Mengambil nomor antrian…
      </p>
    </div>

    <!-- Secondary Kembali action separated -->
    <div
      class="actions-footer"
      style="
        display: flex;
        justify-content: center;
        width: 100%;
        padding-top: 16px;
        border-top: 1px solid var(--border);
      "
    >
      <button
        type="button"
        class="secondary-btn"
        :disabled="pending"
        data-testid="failure-back"
        @click="$emit('back')"
        style="display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-width: 200px;"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        Kembali ke Beranda
      </button>
    </div>
  </section>
</template>
