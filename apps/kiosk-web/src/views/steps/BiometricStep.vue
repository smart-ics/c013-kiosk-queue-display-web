<script setup lang="ts">
defineProps<{ pending: boolean }>()
defineEmits<{ back: [] }>()
</script>

<template>
  <section class="panel">
    <h1>Verifikasi Biometrik</h1>
    <p v-if="pending" data-testid="biometric-pending" class="status">
      Menghubungkan layanan biometrik… Tempelkan jari Anda pada pemindai dan tunggu hingga
      verifikasi selesai.
    </p>
    <div class="actions" style="justify-content: center">
      <button
        type="button"
        class="secondary-btn"
        :disabled="!pending"
        data-testid="biometric-back"
        @click="$emit('back')"
      >
        Batal
      </button>
    </div>
  </section>
</template>
