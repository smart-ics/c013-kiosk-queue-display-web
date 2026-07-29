import { defineConfig, loadEnv } from 'vite'
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

function hubProxyTarget(apiBase: string): string {
  return apiBase.replace(/\/+$/, '').replace(/\/api$/i, '')
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, resolve(__dirname), 'VITE_')
  const apiBase = env.VITE_BILREG_API_BASE?.trim()
  const hubTarget = apiBase ? hubProxyTarget(apiBase) : null

  return {
    base: '/display/',
    plugins: [vue(), versionJsonPlugin()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    server: {
      proxy: hubTarget
        ? {
            '/hubs': {
              target: hubTarget,
              changeOrigin: true,
              ws: true,
            },
          }
        : undefined,
    },
  }
})
