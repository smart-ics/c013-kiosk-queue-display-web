<script setup lang="ts">
import type { ReturnCreateWalkIn } from '@aq/shared-types'

defineProps<{
  result: ReturnCreateWalkIn
  printPending: boolean
  printSucceeded: boolean
  printError: string | null
}>()
defineEmits<{ reprint: []; finish: [] }>()
</script>

<template>
  <section class="panel">
    <h1>Registrasi Berhasil</h1>
    <div class="queue-label" data-testid="reg-no-antrian">{{ result.noAntrian }}</div>
    <p>Nomor Antrian Poli Anda. Simpan baik-baik dan tunggu panggilan.</p>
    <p class="status">Reg ID {{ result.regId }}</p>
    <p v-if="printPending" class="status">Sedang mencetak…</p>
    <p v-else-if="printSucceeded && !printError" class="status ok" data-testid="reg-print-ok">
      Bukti registrasi berhasil dicetak.
    </p>
    <p v-if="printError" class="status error" data-testid="reg-print-error">{{ printError }}</p>
    <div class="actions">
      <button type="button" class="secondary-btn" :disabled="printPending" data-testid="reg-reprint" @click="$emit('reprint')">
        Cetak ulang
      </button>
      <button type="button" class="secondary-btn" :disabled="printPending" data-testid="reg-finish" @click="$emit('finish')">
        Selesai
      </button>
    </div>
  </section>
</template>
