import { createRouter, createWebHistory } from 'vue-router'
import RootView from './views/RootView.vue'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/:screenId?',
      name: 'display-root',
      component: RootView,
    },
  ],
})
