<script setup lang="ts">
import type { PasienSearchItem } from '@aq/shared-types'

defineProps<{ patients: PasienSearchItem[]; pending: boolean }>()
const emit = defineEmits<{ select: [patient: PasienSearchItem]; back: [] }>()

function disambiguator(patient: PasienSearchItem): string {
  return patient.noMR ?? patient.nik ?? patient.tglLahir ?? patient.pasienId
}
</script>

<template>
  <section class="panel">
    <h1>Pilih Pasien</h1>
    <p>Pilih data pasien yang sesuai. Hasil pencarian tidak dipilih otomatis.</p>
    <div class="sp-grid">
      <button
        v-for="patient in patients"
        :key="patient.pasienId"
        type="button"
        class="sp-btn"
        :disabled="pending"
        :data-testid="`patient-${patient.pasienId}`"
        @click="emit('select', patient)"
      >
        {{ patient.pasienName }}
        <small>{{ disambiguator(patient) }}</small>
      </button>
    </div>
    <div class="actions">
      <button type="button" class="secondary-btn" :disabled="pending" @click="$emit('back')">
        Kembali
      </button>
    </div>
  </section>
</template>
