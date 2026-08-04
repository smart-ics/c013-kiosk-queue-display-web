<script setup lang="ts">
defineProps<{ intakeAvailable: boolean }>()
defineEmits<{
  startBooking: []
  startWalkin: []
  startIntake: []
}>()
</script>

<template>
  <section class="panel">
    <h1>Pendaftaran Rawat Jalan</h1>
    <p>Pilih layanan pendaftaran mandiri.</p>
    <div class="sp-grid">
      <button type="button" class="sp-btn" data-testid="start-booking" @click="$emit('startBooking')">
        Check-in Booking
        <small>Pasien dengan booking</small>
      </button>
      <button type="button" class="sp-btn" data-testid="start-walkin" @click="$emit('startWalkin')">
        Daftar Tanpa Booking
        <small>Go-show / walk-in</small>
      </button>
      <button
        type="button"
        class="sp-btn"
        :disabled="!intakeAvailable"
        data-testid="start-intake"
        @click="$emit('startIntake')"
      >
        Ambil Antrian Pendaftaran
        <small>Antrian loket pendaftaran</small>
      </button>
    </div>
  </section>
</template>
