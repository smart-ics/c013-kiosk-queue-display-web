<script setup lang="ts">
import type { AdmissionQueueIntakeResponse } from '@aq/shared-types'

defineProps<{
  ticket: AdmissionQueueIntakeResponse
  title: string
  servicePointName?: string
  printPending: boolean
  printSucceeded: boolean
  printError: string | null
}>()
defineEmits<{ reprint: []; finish: [] }>()
</script>

<template>
  <section class="panel">
    <h1>{{ title }}</h1>
    <div class="queue-label" data-testid="assist-queue-label">{{ ticket.queueLabel }}</div>
    <p v-if="servicePointName" class="status">{{ servicePointName }}</p>
    <p class="status">Antrian ID {{ ticket.antrianId }} · Urut {{ ticket.noUrut }}</p>
    <p v-if="printPending" class="status">Sedang mencetak…</p>
    <p v-else-if="printSucceeded && !printError" class="status ok" data-testid="assist-print-ok">
      Tiket berhasil dicetak.
    </p>
    <p v-if="printError" class="status error" data-testid="assist-print-error">{{ printError }}</p>
    <div class="actions">
      <button type="button" class="secondary-btn" :disabled="printPending" data-testid="assist-reprint" @click="$emit('reprint')">
        Cetak ulang
      </button>
      <button type="button" class="secondary-btn" :disabled="printPending" data-testid="assist-finish" @click="$emit('finish')">
        Selesai
      </button>
    </div>
  </section>
</template>
