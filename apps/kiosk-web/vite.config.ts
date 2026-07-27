import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { copyFileSync } from 'node:fs'

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

export default defineConfig(({ mode }) => {
  loadEnv(mode, resolve(__dirname), 'VITE_')

  return {
    base: '/kiosk/',
    plugins: [vue(), vueDevTools(), versionJsonPlugin()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    server: {
      port: 5173,
    },
    preview: {
      port: 4173,
    },
  }
})
