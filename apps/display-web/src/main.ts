import { createApp } from 'vue'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import { configService } from '@aq/app-config'
import App from './App.vue'
import { brandingService } from './lib/branding'
import { router } from './router'
import './styles.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
})

document.addEventListener('contextmenu', (e) => e.preventDefault())

configService.initialize(import.meta.env.BASE_URL).then(() => {
  return brandingService.initialize(import.meta.env.BASE_URL)
}).then(() => {
  createApp(App).use(router).use(VueQueryPlugin, { queryClient }).mount('#app')
}).catch((err) => {
  console.error('Configuration failed to load:', err)
  document.getElementById('app')!.innerHTML = `
    <div style="padding: 20px; color: red; font-family: sans-serif;">
      <h2>Configuration failed to load</h2>
      <p>Please check the console for details.</p>
    </div>
  `
})
