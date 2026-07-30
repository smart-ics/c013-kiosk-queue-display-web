import { createApp } from 'vue'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import { configService } from '@aq/app-config'
import App from './App.vue'
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

configService.initialize(import.meta.env.BASE_URL).then(() => {
  createApp(App).use(router).use(VueQueryPlugin, { queryClient }).mount('#app')
})
