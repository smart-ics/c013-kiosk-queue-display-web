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
  <section class="panel">
    <h1>Konfirmasi Booking</h1>
    <dl class="detail-list">
      <dt>Pasien</dt>
      <dd>{{ booking.reg.pasienName }}</dd>
      <dt>Poli</dt>
      <dd>{{ booking.layanan.layananName }}</dd>
      <dt>Dokter</dt>
      <dd>{{ booking.dokter.ppaName }}</dd>
      <dt>Tanggal</dt>
      <dd>{{ booking.tglBerobat }}</dd>
      <dt>Jam</dt>
      <dd>{{ booking.jamPraktek }}</dd>
      <dt>Jaminan</dt>
      <dd>
        {{ eligibility.tipeJaminanName }}
        <span v-if="eligibility.needsEligibility">· verifikasi BPJS</span>
      </dd>
    </dl>
    <div class="actions">
      <button type="button" class="sp-btn" :disabled="pending" data-testid="booking-confirm" @click="$emit('confirm')">
        Konfirmasi
      </button>
      <button type="button" class="secondary-btn" :disabled="pending" @click="$emit('back')">
        Kembali
      </button>
    </div>
    <p v-if="pending" class="status">Mendaftarkan…</p>
    <p v-if="errorMessage" class="status error">{{ errorMessage }}</p>
  </section>
</template>
