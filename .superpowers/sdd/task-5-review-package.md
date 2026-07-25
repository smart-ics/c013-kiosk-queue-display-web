apps/display-web/src/styles.css                    | 27 +++++++++++++++++
 apps/display-web/src/views/MissingScreenPicker.vue | 35 ++++++++++++++++++++++
 2 files changed, 62 insertions(+)

diff --git a/apps/display-web/src/styles.css b/apps/display-web/src/styles.css
index 94738f9..bf98b93 100644
--- a/apps/display-web/src/styles.css
+++ b/apps/display-web/src/styles.css
@@ -138,10 +138,37 @@ body {
   color: var(--accent);
   line-height: 1;
 }
 
 .state {
   margin: 0;
   color: var(--warn);
   font-size: 1.2rem;
   font-weight: 600;
 }
+
+.picker-list {
+  list-style: none;
+  margin: 1.25rem 0 0;
+  padding: 0;
+  display: flex;
+  flex-direction: column;
+  gap: 0.5rem;
+}
+
+.picker-list a {
+  display: block;
+  padding: 0.75rem 1rem;
+  border-radius: 0.75rem;
+  background: rgba(61, 214, 140, 0.12);
+  color: var(--accent);
+  font-weight: 600;
+  text-decoration: none;
+  font-size: 1.1rem;
+}
+
+.picker-list a:hover,
+.picker-list a:focus-visible {
+  background: rgba(61, 214, 140, 0.22);
+  outline: 2px solid var(--accent);
+  outline-offset: 2px;
+}
diff --git a/apps/display-web/src/views/MissingScreenPicker.vue b/apps/display-web/src/views/MissingScreenPicker.vue
new file mode 100644
index 0000000..3ba7403
--- /dev/null
+++ b/apps/display-web/src/views/MissingScreenPicker.vue
@@ -0,0 +1,35 @@
+<script setup lang="ts">
+import { computed } from 'vue'
+import { useDisplayScreenList } from '../composables/useDisplayScreenList'
+import BootErrorPage from './BootErrorPage.vue'
+
+const { status, screenIds, error } = useDisplayScreenList()
+
+const empty = computed(() => status.value === 'ok' && screenIds.value.length === 0)
+</script>
+
+<template>
+  <BootErrorPage
+    v-if="status === 'error'"
+    title="Queue Display — Boot gagal"
+    :message="error ?? 'Gagal memuat daftar screen.'"
+  />
+
+  <section v-else class="panel">
+    <h1>Pilih Screen Display</h1>
+    <p class="status">Pilih salah satu screen yang tersedia di devices.json.</p>
+
+    <p v-if="status === 'loading'" class="status">Memuat daftar screen…</p>
+
+    <p v-else-if="empty" class="status error">
+      Tidak ada screen display yang terdaftar di devices.json. Tambahkan entry
+      dengan <code>role: 'display'</code> terlebih dahulu.
+    </p>
+
+    <ul v-else class="picker-list">
+      <li v-for="id in screenIds" :key="id">
+        <RouterLink :to="`/display/${id}`">{{ id }}</RouterLink>
+      </li>
+    </ul>
+  </section>
+</template>

--- Changes ---

apps/display-web/src/styles.css
  @@ -138,10 +138,37 @@ body {
  +
  +.picker-list {
  +  list-style: none;
  +  margin: 1.25rem 0 0;
  +  padding: 0;
  +  display: flex;
  +  flex-direction: column;
  +  gap: 0.5rem;
  +}
  +
  +.picker-list a {
  +  display: block;
  +  padding: 0.75rem 1rem;
  +  border-radius: 0.75rem;
  +  background: rgba(61, 214, 140, 0.12);
  +  color: var(--accent);
  +  font-weight: 600;
  +  text-decoration: none;
  +  font-size: 1.1rem;
  +}
  +
  +.picker-list a:hover,
  +.picker-list a:focus-visible {
  +  background: rgba(61, 214, 140, 0.22);
  +  outline: 2px solid var(--accent);
  +  outline-offset: 2px;
  +}
  +27 -0

apps/display-web/src/views/MissingScreenPicker.vue
  @@ -0,0 +1,35 @@
  +<script setup lang="ts">
  +import { computed } from 'vue'
  +import { useDisplayScreenList } from '../composables/useDisplayScreenList'
  +import BootErrorPage from './BootErrorPage.vue'
  +
  +const { status, screenIds, error } = useDisplayScreenList()
  +
  +const empty = computed(() => status.value === 'ok' && screenIds.value.length === 0)
  +</script>
  +
  +<template>
  +  <BootErrorPage
  +    v-if="status === 'error'"
  +    title="Queue Display — Boot gagal"
  +    :message="error ?? 'Gagal memuat daftar screen.'"
  +  />
  +
  +  <section v-else class="panel">
  +    <h1>Pilih Screen Display</h1>
  +    <p class="status">Pilih salah satu screen yang tersedia di devices.json.</p>
  +
  +    <p v-if="status === 'loading'" class="status">Memuat daftar screen…</p>
  +
  +    <p v-else-if="empty" class="status error">
  +      Tidak ada screen display yang terdaftar di devices.json. Tambahkan entry
  +      dengan <code>role: 'display'</code> terlebih dahulu.
  +    </p>
  +
  +    <ul v-else class="picker-list">
  +      <li v-for="id in screenIds" :key="id">
  +        <RouterLink :to="`/display/${id}`">{{ id }}</RouterLink>
  +      </li>
  +    </ul>
  +  </section>
  +</template>
  +35 -0
2222baf feat(display-web): add MissingScreenPicker view
