import { createRouter, createWebHistory } from 'vue-router'
import { getSessionAuth } from './infrastructure'
import AppShell from './views/AppShell.vue'
import LoginPage from './views/LoginPage.vue'
import ForbiddenPage from './views/ForbiddenPage.vue'
import SummaryPage from './views/SummaryPage.vue'
import WorkstationsPage from './views/WorkstationsPage.vue'
import DisplaysPage from './views/DisplaysPage.vue'
import SegmentationPage from './views/SegmentationPage.vue'
import AuditPage from './views/AuditPage.vue'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginPage,
      meta: { public: true },
    },
    {
      path: '/forbidden',
      name: 'forbidden',
      component: ForbiddenPage,
      meta: { public: true },
    },
    {
      path: '/',
      component: AppShell,
      children: [
        { path: '', name: 'summary', component: SummaryPage },
        { path: 'workstations', name: 'workstations', component: WorkstationsPage },
        { path: 'displays', name: 'displays', component: DisplaysPage },
        { path: 'segmentation', name: 'segmentation', component: SegmentationPage },
        { path: 'audit', name: 'audit', component: AuditPage },
      ],
    },
  ],
})

router.beforeEach((to) => {
  if (to.meta.public) return true
  if (!getSessionAuth().getToken()) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  return true
})
