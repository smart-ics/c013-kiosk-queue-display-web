<script setup lang="ts">
import type { PasienSearchItem, ServiceSelection } from '@aq/shared-types'
import type { EligibilityStatus } from '../../composables/useKioskRegistration'

defineProps<{
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
</script>

<template>
  <section class="panel" style="background: transparent; border: none; box-shadow: none; padding-top: 0;">
    <h1 style="text-align: center;">Konfirmasi Data Layanan</h1>
    <p style="text-align: center;">Pastikan data berikut sudah benar sebelum melanjutkan.</p>

    <div class="smart-card">
      <div class="smart-card-header">
        <h3>{{ patient.pasienName }}</h3>
        <span class="context-card-badge" :style="{ background: eligibility.needsEligibility ? 'var(--brand-strong)' : 'var(--ok)' }">
          {{ eligibility.tipeJaminanName }}
          <span v-if="eligibility.needsEligibility"> (Perlu Verifikasi)</span>
        </span>
      </div>
      <div class="smart-card-body">
        <div class="smart-info-row">
          <span class="smart-info-label">No. Rekam Medis</span>
          <span class="smart-info-value">{{ patient.noMR ?? patient.pasienId }}</span>
        </div>
        <div class="smart-info-row">
          <span class="smart-info-label">Poli Tujuan</span>
          <span class="smart-info-value">{{ service.poli.name }}</span>
        </div>
        <div class="smart-info-row">
          <span class="smart-info-label">Dokter</span>
          <span class="smart-info-value">{{ service.dokter.name }}</span>
        </div>
        <div class="smart-info-row">
          <span class="smart-info-label">Jam Praktik</span>
          <span class="smart-info-value">{{ service.jadwal.jamPraktek }}</span>
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
