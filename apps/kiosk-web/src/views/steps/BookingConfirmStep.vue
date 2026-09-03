<script setup lang="ts">
import type { BookingDetail } from '@aq/shared-types'
import type { EligibilityStatus } from '../../composables/useKioskRegistration'

defineProps<{
  booking: BookingDetail
  eligibility: EligibilityStatus
  pending: boolean
  errorMessage: string | null
}>()
defineEmits<{ confirm: []; back: [] }>()
</script>

<template>
  <section class="panel" style="background: transparent; border: none; box-shadow: none; padding-top: 0;">
    <h1 style="text-align: center;">Konfirmasi Data Booking</h1>
    <p style="text-align: center;">Pastikan data berikut sudah benar sebelum melanjutkan.</p>

    <div class="smart-card">
      <div class="smart-card-header">
        <h3>{{ booking.reg.pasienName }}</h3>
        <span class="context-card-badge" :style="{ background: eligibility.needsEligibility ? 'var(--brand-strong)' : 'var(--ok)' }">
          {{ eligibility.tipeJaminanName }}
          <span v-if="eligibility.needsEligibility"> (Perlu Verifikasi)</span>
        </span>
      </div>
      <div class="smart-card-body">
        <div class="smart-info-row">
          <span class="smart-info-label">Poli Tujuan</span>
          <span class="smart-info-value">{{ booking.layanan.layananName }}</span>
        </div>
        <div class="smart-info-row">
          <span class="smart-info-label">Dokter</span>
          <span class="smart-info-value">{{ booking.dokter.ppaName }}</span>
        </div>
        <div class="smart-info-row">
          <span class="smart-info-label">Waktu Praktek</span>
          <span class="smart-info-value">{{ booking.tglBerobat }} · {{ booking.jamPraktek }}</span>
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
        data-testid="booking-confirm"
        @click="$emit('confirm')"
        style="min-width: 240px;"
      >
        {{ pending ? 'Mendaftarkan…' : 'Konfirmasi Registrasi' }}
      </button>
    </div>
    <p v-if="errorMessage" class="status error" style="text-align: center;">{{ errorMessage }}</p>
  </section>
</template>
