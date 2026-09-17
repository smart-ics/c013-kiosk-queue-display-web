<script setup lang="ts">
import { computed } from 'vue'
import type { PasienSearchItem, ServiceSelection } from '@aq/shared-types'
import type { EligibilityStatus } from '../../composables/useKioskRegistration'

const props = defineProps<{
  patient: PasienSearchItem
  service: ServiceSelection
  eligibility: EligibilityStatus
  pending: boolean
  errorMessage: string | null
}>()
defineEmits<{
  confirm: []
  back: []
}>()

const badgeBackground = computed(() =>
  props.eligibility.needsEligibility ? 'var(--brand-strong)' : 'var(--ok)',
)
</script>

<template>
  <section class="panel" style="background: transparent; border: none; box-shadow: none; padding-top: 0;">
    <h1 style="text-align: center;">Konfirmasi Data Layanan</h1>
    <p style="text-align: center;">Pastikan data berikut sudah benar sebelum melanjutkan.</p>

    <div class="smart-card">
      <div class="smart-card-header">
        <div class="smart-identity">
          <div class="smart-identity-seal" aria-hidden="true">
            <svg
              width="34"
              height="34"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M12 2l8 3.5v5.5c0 4.9-3.4 9.4-8 10.5-4.6-1.1-8-5.6-8-10.5V5.5z" />
              <path d="M9 11.5l2 2 4-4" />
            </svg>
          </div>
          <div class="smart-identity-info">
            <h3>{{ patient.pasienName }}</h3>
            <span class="context-card-badge" :style="{ background: badgeBackground }">
              {{ eligibility.tipeJaminanName }}
              <span v-if="eligibility.needsEligibility"> (Perlu Verifikasi)</span>
            </span>
          </div>
        </div>
      </div>
      <div class="smart-card-body">
        <div class="smart-info-row">
          <span class="smart-icon-tile" aria-hidden="true">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </span>
          <div class="smart-info-main">
            <span class="smart-info-label">No. Rekam Medis</span>
            <span class="smart-info-value">{{ patient.noMR ?? patient.pasienId }}</span>
          </div>
        </div>
        <div class="smart-info-row">
          <span class="smart-icon-tile" aria-hidden="true">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M11 2a2 2 0 0 0-2 2v5H4a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h5v5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-5h5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-5V4a2 2 0 0 0-2-2z"
              />
            </svg>
          </span>
          <div class="smart-info-main">
            <span class="smart-info-label">Poli Tujuan</span>
            <span class="smart-info-value">{{ service.poli.name }}</span>
          </div>
        </div>
        <div class="smart-info-row">
          <span class="smart-icon-tile" aria-hidden="true">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"
              />
              <path d="M8 15v1a6 6 0 0 0 6 6 6 6 0 0 0 6-6v-4" />
              <circle cx="20" cy="10" r="2" />
            </svg>
          </span>
          <div class="smart-info-main">
            <span class="smart-info-label">Dokter</span>
            <span class="smart-info-value smart-value-clamp">{{ service.dokter.name }}</span>
          </div>
        </div>
        <div class="smart-info-row">
          <span class="smart-icon-tile" aria-hidden="true">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </span>
          <div class="smart-info-main">
            <span class="smart-info-label">Jam Praktik</span>
            <span class="smart-info-value">{{ service.jadwal.jamPraktek }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="actions" style="justify-content: center; margin-top: 32px;">
      <button type="button" class="secondary-btn" :disabled="pending" @click="$emit('back')" style="min-width: 160px;">
        Batal
      </button>
      <button
        type="button"
        class="sp-btn"
        :disabled="pending"
        data-testid="walkin-confirm"
        @click="$emit('confirm')"
        style="min-width: 240px;"
      >
        {{ pending ? 'Mendaftarkan…' : 'Konfirmasi & Daftar' }}
      </button>
    </div>

    <p v-if="errorMessage" class="status error" style="text-align: center;">{{ errorMessage }}</p>
  </section>
</template>
