<script setup lang="ts">
import { useRouter } from 'vue-router'
import { logout } from '@/infrastructure'

const router = useRouter()

function backToLogin() {
  logout()
  void router.push({ name: 'login' })
}
</script>

<template>
  <div class="login-wrap">
    <div class="panel login-card stack">
      <h2 style="margin: 0">Akses ditolak</h2>
      <p class="muted" style="margin: 0">
        Akun Anda terautentikasi tetapi tidak memiliki permission
        <strong>AdmissionQueueConfiguration</strong>.
      </p>
      <button type="button" @click="backToLogin">Kembali ke login</button>
    </div>
  </div>
</template>
