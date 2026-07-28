<script setup lang="ts">
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { logout } from '@/infrastructure'

const router = useRouter()

function onLogout() {
  logout()
  void router.push({ name: 'login' })
}
</script>

<template>
  <div class="shell">
    <header class="shell-header">
      <div>
        <h1>Konfigurasi Perangkat Antrian Admisi</h1>
        <p class="muted" style="color: #d7efe4; margin: 0.25rem 0 0">
          Manajemen workstation, kiosk, display, dan segmentasi loket
        </p>
      </div>
      <button type="button" class="secondary" @click="onLogout">Keluar</button>
    </header>
    <nav class="shell-nav">
      <RouterLink :to="{ name: 'summary' }">Ringkasan</RouterLink>
      <RouterLink :to="{ name: 'workstations' }">Workstation</RouterLink>
      <RouterLink :to="{ name: 'displays' }">Queue Display</RouterLink>
      <RouterLink :to="{ name: 'kiosks' }">Kiosk</RouterLink>
      <RouterLink :to="{ name: 'segmentation' }">Segmentasi</RouterLink>
      <RouterLink :to="{ name: 'audit' }">Riwayat</RouterLink>
    </nav>
    <main class="shell-main">
      <div class="panel">
        <RouterView />
      </div>
    </main>
  </div>
</template>
