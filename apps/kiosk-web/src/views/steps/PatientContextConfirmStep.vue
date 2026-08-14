<script setup lang="ts">
import type { PatientContextItem } from '@aq/shared-types'

defineProps<{
  bestMatch: PatientContextItem | null
  patients: PatientContextItem[]
  pending: boolean
}>()

const emit = defineEmits<{
  confirm: [item: PatientContextItem]
  intake: []
  retry: []
}>()

function disambiguator(item: PatientContextItem): string {
  return item.maskedNik || item.id || item.patientId || ''
}
</script>

<template>
  <section class="panel">
    <h1>Konfirmasi Data Pasien</h1>
    <p>Pilih data pasien yang sesuai dengan Anda.</p>

    <div v-if="bestMatch" class="context-card context-card--best" data-testid="best-match">
      <div class="context-card-head">
        <span class="context-card-badge">Paling Cocok</span>
        <strong class="context-card-name">{{ bestMatch.patientName }}</strong>
      </div>
      <dl class="context-card-detail">
        <div v-if="bestMatch.birthDate">
          <dt>Tgl. Lahir</dt>
          <dd>{{ bestMatch.birthDate }}</dd>
        </div>
        <div v-if="bestMatch.gender">
          <dt>Gender</dt>
          <dd>{{ bestMatch.gender }}</dd>
        </div>
        <div v-if="bestMatch.locality">
          <dt>Lokasi</dt>
          <dd>{{ bestMatch.locality }}</dd>
        </div>
        <div v-if="bestMatch.maskedNik">
          <dt>NIK</dt>
          <dd>{{ bestMatch.maskedNik }}</dd>
        </div>
      </dl>
      <button
        type="button"
        class="sp-btn context-card-action"
        :disabled="pending"
        data-testid="confirm-best-match"
        @click="emit('confirm', bestMatch)"
      >
        Lanjutkan Pendaftaran
      </button>
    </div>

    <div v-if="patients.length > 0" class="context-list-section">
      <h2 v-if="bestMatch">Pilih data lain</h2>
      <div class="sp-grid">
        <button
          v-for="item in patients"
          :key="item.id"
          type="button"
          class="sp-btn context-card"
          :disabled="pending"
          :data-testid="`patient-${item.id}`"
          @click="emit('confirm', item)"
        >
          <strong>{{ item.patientName }}</strong>
          <small>{{ disambiguator(item) }}</small>
          <small v-if="item.birthDate">{{ item.birthDate }}</small>
        </button>
      </div>
    </div>

    <p v-if="!bestMatch && patients.length === 0 && pending" class="status">
      Mencari data pasien…
    </p>

    <div class="actions">
      <button
        type="button"
        class="sp-btn"
        :disabled="pending"
        data-testid="take-intake"
        @click="emit('intake')"
      >
        Ambil Antrian Pendaftaran
      </button>
      <button
        type="button"
        class="secondary-btn"
        :disabled="pending"
        data-testid="retry-search"
        @click="emit('retry')"
      >
        Cari Ulang
      </button>
    </div>
  </section>
</template>
