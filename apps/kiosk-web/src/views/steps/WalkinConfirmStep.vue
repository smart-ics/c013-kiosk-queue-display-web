<script setup lang="ts">
import { ref } from 'vue'
import type { PasienSearchItem, ServiceSelection } from '@aq/shared-types'
import type { EligibilityStatus } from '../../composables/useKioskRegistration'

defineProps<{
  patient: PasienSearchItem
  service: ServiceSelection
  eligibility: EligibilityStatus
  pending: boolean
  errorMessage: string | null
}>()
const emit = defineEmits<{
  confirm: []
  back: []
  updateNoPeserta: [value: string]
}>()

const noPesertaInput = ref('')
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

    <div v-if="eligibility.needsEligibility" class="noPeserta-block">
      <p>Masukkan Nomor Peserta BPJS (scan QR kartu atau ketik manual).</p>
      <input
        v-model="noPesertaInput"
        class="big-input"
        placeholder="Nomor Peserta BPJS"
        data-testid="no-peserta"
        @input="emit('updateNoPeserta', noPesertaInput)"
      />
    </div>

    <div class="actions">
      <button
        type="button"
        class="sp-btn"
        :disabled="pending || (eligibility.needsEligibility && !noPesertaInput.trim())"
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
