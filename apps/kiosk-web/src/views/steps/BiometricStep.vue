<script setup lang="ts">
defineProps<{ pending: boolean; errorMessage: string | null }>()
</script>

<template>
  <section class="panel">
    <h1>Verifikasi Biometrik</h1>
    <p v-if="pending">Menghubungkan layanan biometrik… Menunggu verifikasi sidik jari.</p>
    <p v-if="errorMessage" class="status error">{{ errorMessage }}</p>
  </section>
</template>
