<script setup lang="ts">
import { computed } from 'vue'
import { useDisplayScreenList } from '../composables/useDisplayScreenList'
import BootErrorPage from './BootErrorPage.vue'

const { status, screenIds, error } = useDisplayScreenList()

const empty = computed(() => status.value === 'ok' && screenIds.value.length === 0)
</script>

<template>
  <BootErrorPage
    v-if="status === 'error'"
    title="Queue Display — Boot gagal"
    :message="error ?? 'Gagal memuat daftar screen.'"
  />

  <section v-else class="panel">
    <h1>Pilih Screen Display</h1>
    <p class="status">Pilih salah satu screen yang tersedia di devices.json.</p>

    <p v-if="status === 'loading'" class="status">Memuat daftar screen…</p>

    <p v-else-if="empty" class="status error">
      Tidak ada screen display yang terdaftar di devices.json. Tambahkan entry
      dengan <code>role: 'display'</code> terlebih dahulu.
    </p>

    <ul v-else class="picker-list">
      <li v-for="id in screenIds" :key="id">
        <RouterLink :to="`/display/${id}`">{{ id }}</RouterLink>
      </li>
    </ul>
  </section>
</template>
