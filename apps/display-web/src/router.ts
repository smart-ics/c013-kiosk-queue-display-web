import { createRouter, createWebHistory } from 'vue-router'
import DisplayPage from './views/DisplayPage.vue'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/:screenId',
      name: 'display',
      component: DisplayPage,
      props: true,
    },
    {
      path: '/',
      name: 'missing-screen',
      component: DisplayPage,
      props: { screenId: '' },
    },
  ],
})
