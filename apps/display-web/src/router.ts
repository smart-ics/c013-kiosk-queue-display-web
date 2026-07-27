import { createRouter, createWebHistory } from 'vue-router'
import RootView from './views/RootView.vue'
import LoginView from './views/LoginView.vue'
import { getAuthTokenProvider } from './infrastructure'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/login', name: 'login', component: LoginView },
    { path: '/:screenId?', name: 'display-root', component: RootView },
  ],
})

router.beforeEach((to) => {
  if (to.name === 'login') return true
  const phase = getAuthTokenProvider().phase.value
  if (phase.kind === 'authenticated' || phase.kind === 'logging-in') return true
  return { name: 'login', query: { redirect: to.fullPath } }
})
