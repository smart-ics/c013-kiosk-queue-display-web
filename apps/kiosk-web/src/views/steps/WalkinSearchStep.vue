<script setup lang="ts">
import { ref } from 'vue'

defineProps<{ pending: boolean; errorMessage: string | null }>()
const emit = defineEmits<{ submit: [keyword: string]; back: [] }>()
const keyword = ref('')

function submit() {
  if (!keyword.value.trim()) return
  emit('submit', keyword.value)
}
</script>

<template>
  <section class="panel">
    <h1>Daftar Tanpa Booking</h1>
    <p>Masukkan salah satu identitas: NIK, nomor MR, nomor peserta BPJS, atau nomor rujukan.</p>
    <input
      v-model="keyword"
      class="big-input"
      placeholder="NIK / No. MR / BPJS / Rujukan"
      data-testid="walkin-keyword"
      @keyup.enter="submit"
    />
    <div class="actions">
      <button type="button" class="sp-btn" :disabled="pending" data-testid="walkin-submit" @click="submit">
        Cari Pasien
      </button>
      <button type="button" class="secondary-btn" :disabled="pending" @click="$emit('back')">
        Kembali
      </button>
    </div>
    <p v-if="pending" class="status">Mencari pasien…</p>
    <p v-if="errorMessage" class="status error">{{ errorMessage }}</p>
  </section>
</template>
