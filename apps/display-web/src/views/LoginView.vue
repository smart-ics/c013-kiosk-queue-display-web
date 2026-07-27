<script setup lang="ts">
import { computed, ref, watch, unref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getAuthTokenProvider } from '../infrastructure'
import type { AutoLoginAuthTokenProvider } from '@aq/auth'

const providerRef = ref<AutoLoginAuthTokenProvider>(getAuthTokenProvider())

const provider = computed({
  get: () => providerRef.value,
  set: (val) => {
    providerRef.value = val
  },
})

const phase = computed(() => unref(provider.value.phase))

const route = useRoute()
const router = useRouter()

const email = ref('')
const pass = ref('')
const sessionExpired = computed(() => route.query.session === 'expired')

async function submit() {
  if (!email.value || !pass.value) return
  await provider.value.login(email.value, pass.value)
}

watch(
  phase,
  (newPhase) => {
    if (newPhase.kind === 'authenticated') {
      const redirect = (route.query.redirect as string) || '/display/'
      void router.push(redirect)
    }
  },
)

defineExpose({ provider })
</script>

<template>
  <section class="panel">
    <h1>Login Display</h1>

    <p v-if="sessionExpired" class="status error">
      Sesi Anda telah berakhir. Silakan login ulang.
    </p>

    <p v-else class="status">
      Login diperlukan untuk pertama kali. Credentials akan disimpan di device ini.
    </p>

    <p v-if="phase.kind === 'logging-in'" class="status">
      Sedang login…
    </p>

    <p v-else-if="phase.kind === 'error'" class="status error">
      {{ phase.message }}
    </p>

    <form
      v-if="phase.kind === 'idle' || phase.kind === 'error'"
      @submit.prevent="submit"
    >
      <label>
        Email
        <input v-model="email" type="email" required autocomplete="username" />
      </label>
      <label>
        Password
        <input v-model="pass" type="password" required autocomplete="current-password" />
      </label>
      <button type="submit" :disabled="!email || !pass">Login</button>
    </form>
  </section>
</template>

<style scoped>
form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  margin-top: 1.5rem;
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-weight: 600;
  font-size: 0.95rem;
}

input {
  display: block;
  width: 100%;
  padding: 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid #cbd5e1;
  font-size: 1rem;
  background-color: #ffffff;
  color: #0f172a;
}

input:focus {
  outline: 2px solid var(--accent);
  border-color: transparent;
}

button {
  display: block;
  width: 100%;
  padding: 0.75rem;
  border-radius: 0.5rem;
  border: none;
  background: var(--accent);
  color: #07111f;
  font-weight: bold;
  font-size: 1.1rem;
  cursor: pointer;
  transition: background 0.2s, opacity 0.2s;
  margin-top: 0.5rem;
}

button:hover {
  opacity: 0.9;
}

button:disabled {
  background: #cbd5e1;
  color: #64748b;
  cursor: not-allowed;
}
</style>
