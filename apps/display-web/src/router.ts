import { createRouter, createWebHistory } from 'vue-router'
import DisplayStubPage from './views/DisplayStubPage.vue'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/:screenId',
      name: 'display',
      component: DisplayStubPage,
      props: true,
    },
    {
      path: '/',
      name: 'missing-screen',
      component: DisplayStubPage,
      props: { screenId: '' },
    },
  ],
})
