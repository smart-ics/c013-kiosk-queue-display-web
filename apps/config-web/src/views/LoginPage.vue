<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiClientError } from '@aq/api-client'
import { login } from '@/infrastructure'

const route = useRoute()
const router = useRouter()
const email = ref('')
const pass = ref('')
const error = ref('')
const loading = ref(false)

async function onSubmit() {
  error.value = ''
  loading.value = true
  try {
    await login({ email: email.value, pass: pass.value, appId: 'Bilreg' })
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await router.replace(redirect)
  } catch (err) {
    if (err instanceof ApiClientError && err.status === 403) {
      await router.replace({ name: 'forbidden' })
      return
    }
    error.value = err instanceof Error ? err.message : 'Login gagal'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-wrap">
    <form class="panel login-card stack" @submit.prevent="onSubmit">
      <h2 style="margin: 0">Masuk</h2>
      <p class="muted" style="margin: 0">
        Gunakan akun Bilreg dengan permission AdmissionQueueConfiguration.
      </p>
      <label>
        Email
        <input v-model="email" type="email" required autocomplete="username" />
      </label>
      <label>
        Password
        <input v-model="pass" type="password" required autocomplete="current-password" />
      </label>
      <p v-if="error" class="error">{{ error }}</p>
      <button type="submit" :disabled="loading">
        {{ loading ? 'Memproses…' : 'Masuk' }}
      </button>
    </form>
  </div>
</template>
