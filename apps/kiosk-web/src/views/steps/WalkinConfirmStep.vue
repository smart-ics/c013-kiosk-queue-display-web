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
  <section class="panel">
    <h1>Konfirmasi Data</h1>
    <dl class="detail-list">
      <dt>Pasien</dt>
      <dd>{{ patient.pasienName }}</dd>
      <dt>Poli</dt>
      <dd>{{ service.poli.name }}</dd>
      <dt>Dokter</dt>
      <dd>{{ service.dokter.name }}</dd>
      <dt>Jadwal</dt>
      <dd>{{ service.jadwal.jamPraktek }}</dd>
      <dt>Jaminan</dt>
      <dd>
        {{ eligibility.tipeJaminanName }}
        <span v-if="eligibility.needsEligibility">· verifikasi BPJS</span>
      </dd>
    </dl>

    <div class="actions">
      <button
        type="button"
        class="sp-btn"
        :disabled="pending"
        data-testid="walkin-confirm"
        @click="$emit('confirm')"
      >
        Konfirmasi &amp; Daftar
      </button>
      <button type="button" class="secondary-btn" :disabled="pending" @click="$emit('back')">
        Kembali
      </button>
    </div>
    <p v-if="pending" class="status">Mendaftarkan…</p>
    <p v-if="errorMessage" class="status error">{{ errorMessage }}</p>
  </section>
</template>
