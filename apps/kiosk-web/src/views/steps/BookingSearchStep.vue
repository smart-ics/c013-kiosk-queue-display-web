<script setup lang="ts">
import { ref } from 'vue'

defineProps<{ pending: boolean; errorMessage: string | null }>()
const emit = defineEmits<{ submit: [keyword: string]; scan: []; back: [] }>()
const keyword = ref('')

function submit() {
  if (!keyword.value.trim()) return
  emit('submit', keyword.value)
}
</script>

<template>
  <section class="panel">
    <h1>Check-in Booking</h1>
    <p>Masukkan kode booking, atau scan QR dari kartu booking Anda.</p>
    <input
      v-model="keyword"
      class="big-input"
      placeholder="Kode booking"
      data-testid="booking-keyword"
      @keyup.enter="submit"
    />
    <div class="actions">
      <button type="button" class="sp-btn" :disabled="pending" data-testid="booking-submit" @click="submit">
        Lanjutkan
      </button>
      <button type="button" class="secondary-btn" :disabled="pending" data-testid="booking-scan" @click="$emit('scan')">
        Scan QR
      </button>
      <button type="button" class="secondary-btn" :disabled="pending" @click="$emit('back')">
        Kembali
      </button>
    </div>
    <p v-if="pending" class="status">Mencari booking…</p>
    <p v-if="errorMessage" class="status error" data-testid="booking-error">{{ errorMessage }}</p>
  </section>
</template>
