apps/display-web/src/router.ts          | 15 ++++-----------
 apps/display-web/src/views/RootView.vue | 19 +++++++++++++++++++
 2 files changed, 23 insertions(+), 11 deletions(-)

diff --git a/apps/display-web/src/router.ts b/apps/display-web/src/router.ts
index f5d01db..ed44e81 100644
--- a/apps/display-web/src/router.ts
+++ b/apps/display-web/src/router.ts
@@ -1,20 +1,13 @@
 import { createRouter, createWebHistory } from 'vue-router'
-import DisplayPage from './views/DisplayPage.vue'
+import RootView from './views/RootView.vue'
 
 export const router = createRouter({
   history: createWebHistory(import.meta.env.BASE_URL),
   routes: [
     {
-      path: '/:screenId',
-      name: 'display',
-      component: DisplayPage,
-      props: true,
-    },
-    {
-      path: '/',
-      name: 'missing-screen',
-      component: DisplayPage,
-      props: { screenId: '' },
+      path: '/:screenId?',
+      name: 'display-root',
+      component: RootView,
     },
   ],
 })
diff --git a/apps/display-web/src/views/RootView.vue b/apps/display-web/src/views/RootView.vue
new file mode 100644
index 0000000..f04dff7
--- /dev/null
+++ b/apps/display-web/src/views/RootView.vue
@@ -0,0 +1,19 @@
+<script setup lang="ts">
+import { computed } from 'vue'
+import { useRoute } from 'vue-router'
+import DisplayPage from './DisplayPage.vue'
+import MissingScreenPicker from './MissingScreenPicker.vue'
+
+const route = useRoute()
+
+const screenId = computed(() => {
+  const raw = route.params.screenId
+  const first = Array.isArray(raw) ? raw[0] : raw
+  return (first ?? '').toString().trim()
+})
+</script>
+
+<template>
+  <DisplayPage v-if="screenId" :screen-id="screenId" />
+  <MissingScreenPicker v-else />
+</template>

--- Changes ---

apps/display-web/src/router.ts
  @@ -1,20 +1,13 @@
  -import DisplayPage from './views/DisplayPage.vue'
  +import RootView from './views/RootView.vue'
   
   export const router = createRouter({
     history: createWebHistory(import.meta.env.BASE_URL),
     routes: [
       {
  -      path: '/:screenId',
  -      name: 'display',
  -      component: DisplayPage,
  -      props: true,
  -    },
  -    {
  -      path: '/',
  -      name: 'missing-screen',
  -      component: DisplayPage,
  -      props: { screenId: '' },
  +      path: '/:screenId?',
  +      name: 'display-root',
  +      component: RootView,
       },
     ],
   })
  +4 -11

apps/display-web/src/views/RootView.vue
  @@ -0,0 +1,19 @@
  +<script setup lang="ts">
  +import { computed } from 'vue'
  +import { useRoute } from 'vue-router'
  +import DisplayPage from './DisplayPage.vue'
  +import MissingScreenPicker from './MissingScreenPicker.vue'
  +
  +const route = useRoute()
  +
  +const screenId = computed(() => {
  +  const raw = route.params.screenId
  +  const first = Array.isArray(raw) ? raw[0] : raw
  +  return (first ?? '').toString().trim()
  +})
  +</script>
  +
  +<template>
  +  <DisplayPage v-if="screenId" :screen-id="screenId" />
  +  <MissingScreenPicker v-else />
  +</template>
  +19 -0
1261a19 feat(display-web): route /:screenId? through RootView
