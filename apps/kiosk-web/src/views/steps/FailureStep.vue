<script setup lang="ts">
import type { AdmissionServicePoint } from '@aq/shared-types'
import type { FailureContext } from '../../composables/useKioskRegistration'

defineProps<{
  errorContext: FailureContext
  offerings: AdmissionServicePoint[]
  pending: boolean
}>()
defineEmits<{
  selectServicePoint: [servicePointId: string]
  back: []
}>()
</script>

<template>
  <section class="panel">
    <h1>Registrasi Tidak Dapat Diproses</h1>
    <p class="status error" data-testid="failure-message">{{ errorContext.message }}</p>
    <p>Silakan pilih loket bantuan pendaftaran untuk mendapatkan nomor antrian.</p>
    <div class="sp-grid">
      <button
        v-for="sp in offerings"
        :key="sp.servicePointId"
        type="button"
        class="sp-btn"
        :disabled="pending"
        :data-testid="`assist-${sp.servicePointId}`"
        @click="$emit('selectServicePoint', sp.servicePointId)"
      >
        {{ sp.displayName }}
        <small>{{ sp.queuePrefix }} · {{ sp.servicePointId }}</small>
      </button>
    </div>
    <p v-if="pending" class="status">Mengambil nomor antrian…</p>

    <div class="actions">
      <button
        type="button"
        class="secondary-btn"
        :disabled="pending"
        data-testid="failure-back"
        @click="$emit('back')"
      >
        Kembali ke Beranda
      </button>
    </div>
  </section>
</template>
