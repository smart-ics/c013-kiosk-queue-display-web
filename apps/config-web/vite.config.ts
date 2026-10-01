import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
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
      mkdirSync(outDir, { recursive: true })
      writeFileSync(resolve(outDir, 'version.json'), JSON.stringify(version, null, 2))
      copyFileSync(resolve(__dirname, 'web.config'), resolve(outDir, 'web.config'))
      const guideSrc = resolve(__dirname, '../../docs/IIS_INSTALL_GUIDE.id.md')
      if (existsSync(guideSrc)) {
        copyFileSync(guideSrc, resolve(outDir, 'IIS_INSTALL_GUIDE.id.md'))
      }
    },
  }
}

export default defineConfig({
  base: '/queue-config/',
  plugins: [vue(), versionJsonPlugin()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
})
