.../src/__tests__/infrastructure.spec.ts           | 38 +++++++++++++++++++
 apps/display-web/src/infrastructure.ts             |  3 ++
 apps/display-web/vite.config.ts                    | 41 +++++++++++++++------
 .../src/__tests__/deviceConfig.spec.ts             | 43 ++++++++++++++++++++++
 4 files changed, 114 insertions(+), 11 deletions(-)

diff --git a/apps/display-web/src/__tests__/infrastructure.spec.ts b/apps/display-web/src/__tests__/infrastructure.spec.ts
new file mode 100644
index 0000000..8e24025
--- /dev/null
+++ b/apps/display-web/src/__tests__/infrastructure.spec.ts
@@ -0,0 +1,38 @@
+import { afterEach, describe, expect, it, vi } from 'vitest'
+import { getAdmissionQueueHubUrl } from '@/infrastructure'
+
+const ORIGINAL_DEV = import.meta.env.DEV
+const ORIGINAL_BASE = import.meta.env.VITE_BILREG_API_BASE
+
+afterEach(() => {
+  ;(import.meta.env as Record<string, string | boolean>).DEV = ORIGINAL_DEV
+  ;(import.meta.env as Record<string, string | boolean>).VITE_BILREG_API_BASE = ORIGINAL_BASE
+  vi.restoreAllMocks()
+})
+
+describe('getAdmissionQueueHubUrl', () => {
+  it('returns a same-origin relative path in dev so the Vite proxy avoids CORS preflight', () => {
+    ;(import.meta.env as Record<string, string | boolean>).DEV = true
+    ;(import.meta.env as Record<string, string | boolean>).VITE_BILREG_API_BASE =
+      'http://dev.smart-ics.com:8888/bilregapi/api'
+
+    expect(getAdmissionQueueHubUrl()).toBe('/hubs/admission-queue')
+  })
+
+  it('returns the absolute hub URL in production builds (backend CORS is authoritative)', () => {
+    ;(import.meta.env as Record<string, string | boolean>).DEV = false
+    ;(import.meta.env as Record<string, string | boolean>).VITE_BILREG_API_BASE =
+      'http://dev.smart-ics.com:8888/bilregapi/api'
+
+    expect(getAdmissionQueueHubUrl()).toBe(
+      'http://dev.smart-ics.com:8888/bilregapi/hubs/admission-queue',
+    )
+  })
+
+  it('throws when VITE_BILREG_API_BASE is missing', () => {
+    ;(import.meta.env as Record<string, string | boolean>).DEV = false
+    ;(import.meta.env as Record<string, string | boolean>).VITE_BILREG_API_BASE = ''
+
+    expect(() => getAdmissionQueueHubUrl()).toThrow('VITE_BILREG_API_BASE is not configured')
+  })
+})
diff --git a/apps/display-web/src/infrastructure.ts b/apps/display-web/src/infrastructure.ts
index 693a586..3bba853 100644
--- a/apps/display-web/src/infrastructure.ts
+++ b/apps/display-web/src/infrastructure.ts
@@ -44,18 +44,21 @@ export function getAdmissionQueueApi(): AdmissionQueueApi {
   })
   admissionQueueApi = createAdmissionQueueApi(client)
   return admissionQueueApi
 }
 
 export function getAdmissionQueueHubUrl(): string {
   const baseUrl = import.meta.env.VITE_BILREG_API_BASE?.trim()
   if (!baseUrl) {
     throw new Error('VITE_BILREG_API_BASE is not configured')
   }
+  if (import.meta.env.DEV) {
+    return '/hubs/admission-queue'
+  }
   return buildAdmissionQueueHubUrl(baseUrl)
 }
 
 export function __resetInfrastructureForTests() {
   deviceConfigProvider = null
   authTokenProvider = null
   admissionQueueApi = null
 }
diff --git a/apps/display-web/vite.config.ts b/apps/display-web/vite.config.ts
index 119900e..e402e03 100644
--- a/apps/display-web/vite.config.ts
+++ b/apps/display-web/vite.config.ts
@@ -1,32 +1,51 @@
-import { defineConfig } from 'vite'
+import { defineConfig, loadEnv } from 'vite'
 import vue from '@vitejs/plugin-vue'
 import { copyFileSync, writeFileSync } from 'node:fs'
 import { resolve } from 'node:path'
 
 function versionJsonPlugin() {
   return {
     name: 'aq-version-json',
     closeBundle() {
       const version = {
         version: `0.1.0-${Date.now().toString(36)}`,
         builtAt: new Date().toISOString(),
       }
       const outDir = resolve(__dirname, 'dist')
       writeFileSync(resolve(outDir, 'version.json'), JSON.stringify(version, null, 2))
       copyFileSync(resolve(__dirname, 'web.config'), resolve(outDir, 'web.config'))
     },
   }
 }
 
-export default defineConfig({
-  base: '/display/',
-  plugins: [vue(), versionJsonPlugin()],
-  resolve: {
-    alias: {
-      '@': resolve(__dirname, 'src'),
+function hubProxyTarget(apiBase: string): string {
+  return apiBase.replace(/\/+$/, '').replace(/\/api$/i, '')
+}
+
+export default defineConfig(({ mode }) => {
+  const env = loadEnv(mode, resolve(__dirname), 'VITE_')
+  const apiBase = env.VITE_BILREG_API_BASE?.trim()
+  const hubTarget = apiBase ? hubProxyTarget(apiBase) : null
+
+  return {
+    base: '/display/',
+    plugins: [vue(), versionJsonPlugin()],
+    resolve: {
+      alias: {
+        '@': resolve(__dirname, 'src'),
+      },
+    },
+    server: {
+      port: 5174,
+      proxy: hubTarget
+        ? {
+            '/hubs': {
+              target: hubTarget,
+              changeOrigin: true,
+              ws: true,
+            },
+          }
+        : undefined,
     },
-  },
-  server: {
-    port: 5174,
-  },
+  }
 })
diff --git a/packages/device-config/src/__tests__/deviceConfig.spec.ts b/packages/device-config/src/__tests__/deviceConfig.spec.ts
index af17d9d..f287fb8 100644
--- a/packages/device-config/src/__tests__/deviceConfig.spec.ts
+++ b/packages/device-config/src/__tests__/deviceConfig.spec.ts
@@ -54,11 +54,54 @@ describe('JsonDeviceConfigurationProvider', () => {
       pollIntervalMs: 15000,
       audioEnabled: true,
     })
   })
 
   it('fails closed for unknown station', async () => {
     await expect(provider.getConfig('unknown-station')).rejects.toBeInstanceOf(
       DeviceConfigNotFoundError,
     )
   })
+
+  it('lists only display-role screen ids', async () => {
+    const ids = await provider.listDisplayScreenIds()
+    expect(ids).toEqual(['lobby-poli-1'])
+  })
+})
+
+describe('JsonDeviceConfigurationProvider.listDisplayScreenIds', () => {
+  it('returns sorted display ids from a mixed catalog', async () => {
+    const provider = new JsonDeviceConfigurationProvider({
+      'lobby-igd': { role: 'display', loketIds: ['L3'] },
+      'lobby-poli-1': { role: 'display', loketIds: ['L1', 'L2'] },
+      'loket-03': { role: 'kiosk', servicePointIds: ['SP-REG'] },
+    })
+    const ids = await provider.listDisplayScreenIds()
+    expect(ids).toEqual(['lobby-igd', 'lobby-poli-1'])
+  })
+
+  it('returns an empty array when there are no display entries', async () => {
+    const provider = new JsonDeviceConfigurationProvider({
+      'loket-03': { role: 'kiosk', servicePointIds: ['SP-REG'] },
+    })
+    expect(await provider.listDisplayScreenIds()).toEqual([])
+  })
+
+  it('returns an empty array for an empty catalog', async () => {
+    const provider = new JsonDeviceConfigurationProvider({})
+    expect(await provider.listDisplayScreenIds()).toEqual([])
+  })
+
+  it('ignores entries with no role', async () => {
+    const provider = new JsonDeviceConfigurationProvider({
+      'no-role': { servicePointIds: ['SP-REG'] } as never,
+    })
+    expect(await provider.listDisplayScreenIds()).toEqual([])
+  })
+
+  it('returns ids even if the entry would fail getConfig validation', async () => {
+    const provider = new JsonDeviceConfigurationProvider({
+      'broken-display': { role: 'display' } as never,
+    })
+    expect(await provider.listDisplayScreenIds()).toEqual(['broken-display'])
+  })
 })

--- Changes ---

apps/display-web/src/__tests__/infrastructure.spec.ts
  @@ -0,0 +1,38 @@
  +import { afterEach, describe, expect, it, vi } from 'vitest'
  +import { getAdmissionQueueHubUrl } from '@/infrastructure'
  +
  +const ORIGINAL_DEV = import.meta.env.DEV
  +const ORIGINAL_BASE = import.meta.env.VITE_BILREG_API_BASE
  +
  +afterEach(() => {
  +  ;(import.meta.env as Record<string, string | boolean>).DEV = ORIGINAL_DEV
  +  ;(import.meta.env as Record<string, string | boolean>).VITE_BILREG_API_BASE = ORIGINAL_BASE
  +  vi.restoreAllMocks()
  +})
  +
  +describe('getAdmissionQueueHubUrl', () => {
  +  it('returns a same-origin relative path in dev so the Vite proxy avoids CORS preflight', () => {
  +    ;(import.meta.env as Record<string, string | boolean>).DEV = true
  +    ;(import.meta.env as Record<string, string | boolean>).VITE_BILREG_API_BASE =
  +      'http://dev.smart-ics.com:8888/bilregapi/api'
  +
  +    expect(getAdmissionQueueHubUrl()).toBe('/hubs/admission-queue')
  +  })
  +
  +  it('returns the absolute hub URL in production builds (backend CORS is authoritative)', () => {
  +    ;(import.meta.env as Record<string, string | boolean>).DEV = false
  +    ;(import.meta.env as Record<string, string | boolean>).VITE_BILREG_API_BASE =
  +      'http://dev.smart-ics.com:8888/bilregapi/api'
  +
  +    expect(getAdmissionQueueHubUrl()).toBe(
  +      'http://dev.smart-ics.com:8888/bilregapi/hubs/admission-queue',
  +    )
  +  })
  +
  +  it('throws when VITE_BILREG_API_BASE is missing', () => {
  +    ;(import.meta.env as Record<string, string | boolean>).DEV = false
  +    ;(import.meta.env as Record<string, string | boolean>).VITE_BILREG_API_BASE = ''
  +
  +    expect(() => getAdmissionQueueHubUrl()).toThrow('VITE_BILREG_API_BASE is not configured')
  +  })
  +})
  +38 -0

apps/display-web/src/infrastructure.ts
  @@ -44,18 +44,21 @@ export function getAdmissionQueueApi(): AdmissionQueueApi {
  +  if (import.meta.env.DEV) {
  +    return '/hubs/admission-queue'
  +  }
     return buildAdmissionQueueHubUrl(baseUrl)
   }
   
   export function __resetInfrastructureForTests() {
     deviceConfigProvider = null
     authTokenProvider = null
     admissionQueueApi = null
   }
  +3 -0

apps/display-web/vite.config.ts
  @@ -1,32 +1,51 @@
  -import { defineConfig } from 'vite'
  +import { defineConfig, loadEnv } from 'vite'
   import vue from '@vitejs/plugin-vue'
   import { copyFileSync, writeFileSync } from 'node:fs'
   import { resolve } from 'node:path'
   
   function versionJsonPlugin() {
     return {
       name: 'aq-version-json',
       closeBundle() {
         const version = {
           version: `0.1.0-${Date.now().toString(36)}`,
           builtAt: new Date().toISOString(),
         }
         const outDir = resolve(__dirname, 'dist')
         writeFileSync(resolve(outDir, 'version.json'), JSON.stringify(version, null, 2))
         copyFileSync(resolve(__dirname, 'web.config'), resolve(outDir, 'web.config'))
       },
     }
   }
   
  -export default defineConfig({
  -  base: '/display/',
  -  plugins: [vue(), versionJsonPlugin()],
  -  resolve: {
  -    alias: {
  -      '@': resolve(__dirname, 'src'),
  +function hubProxyTarget(apiBase: string): string {
  +  return apiBase.replace(/\/+$/, '').replace(/\/api$/i, '')
  +}
  +
  +export default defineConfig(({ mode }) => {
  +  const env = loadEnv(mode, resolve(__dirname), 'VITE_')
  +  const apiBase = env.VITE_BILREG_API_BASE?.trim()
  +  const hubTarget = apiBase ? hubProxyTarget(apiBase) : null
  +
  +  return {
  +    base: '/display/',
  +    plugins: [vue(), versionJsonPlugin()],
  +    resolve: {
  +      alias: {
  +        '@': resolve(__dirname, 'src'),
  +      },
  +    },
  +    server: {
  +      port: 5174,
  +      proxy: hubTarget
  +        ? {
  +            '/hubs': {
  +              target: hubTarget,
  +              changeOrigin: true,
  +              ws: true,
  +            },
  +          }
  +        : undefined,
       },
  -  },
  -  server: {
  -    port: 5174,
  -  },
  +  }
   })
  +30 -11

packages/device-config/src/__tests__/deviceConfig.spec.ts
  @@ -54,11 +54,54 @@ describe('JsonDeviceConfigurationProvider', () => {
  +
  +  it('lists only display-role screen ids', async () => {
  +    const ids = await provider.listDisplayScreenIds()
  +    expect(ids).toEqual(['lobby-poli-1'])
  +  })
  +})
  +
  +describe('JsonDeviceConfigurationProvider.listDisplayScreenIds', () => {
  +  it('returns sorted display ids from a mixed catalog', async () => {
  +    const provider = new JsonDeviceConfigurationProvider({
  +      'lobby-igd': { role: 'display', loketIds: ['L3'] },
  +      'lobby-poli-1': { role: 'display', loketIds: ['L1', 'L2'] },
  +      'loket-03': { role: 'kiosk', servicePointIds: ['SP-REG'] },
  +    })
  +    const ids = await provider.listDisplayScreenIds()
  +    expect(ids).toEqual(['lobby-igd', 'lobby-poli-1'])
  +  })
  +
  +  it('returns an empty array when there are no display entries', async () => {
  +    const provider = new JsonDeviceConfigurationProvider({
  +      'loket-03': { role: 'kiosk', servicePointIds: ['SP-REG'] },
  +    })
  +    expect(await provider.listDisplayScreenIds()).toEqual([])
  +  })
  +
  +  it('returns an empty array for an empty catalog', async () => {
  +    const provider = new JsonDeviceConfigurationProvider({})
  +    expect(await provider.listDisplayScreenIds()).toEqual([])
  +  })
  +
  +  it('ignores entries with no role', async () => {
  +    const provider = new JsonDeviceConfigurationProvider({
  +      'no-role': { servicePointIds: ['SP-REG'] } as never,
  +    })
  +    expect(await provider.listDisplayScreenIds()).toEqual([])
  +  })
  +
  +  it('returns ids even if the entry would fail getConfig validation', async () => {
  +    const provider = new JsonDeviceConfigurationProvider({
  +      'broken-display': { role: 'display' } as never,
  +    })
  +    expect(await provider.listDisplayScreenIds()).toEqual(['broken-display'])
  +  })
   })
  +43 -0
f8bc230 test(device-config): cover listDisplayScreenIds
5055d4e fix(display-web): proxy /hubs through Vite dev server to avoid Signal...
