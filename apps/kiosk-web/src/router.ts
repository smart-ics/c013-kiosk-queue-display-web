import { createRouter, createWebHistory } from 'vue-router'
import KioskPage from './views/KioskPage.vue'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/:stationId',
      name: 'kiosk',
      component: KioskPage,
      props: true,
    },
    {
      path: '/',
      name: 'missing-station',
      component: () => import('./views/BootErrorPage.vue'),
      props: {
        title: 'Station ID diperlukan',
        message: 'Buka kiosk dengan path /kiosk/{stationId}, contoh /kiosk/loket-03.',
      },
    },
  ],
})
