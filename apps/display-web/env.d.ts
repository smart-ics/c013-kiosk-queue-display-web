/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BILREG_API_BASE: string
  readonly VITE_BILREG_TOKEN: string
  readonly VITE_DEVICE_CONFIG_PROVIDER?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}
