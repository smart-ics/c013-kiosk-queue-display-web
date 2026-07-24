import {
  AdmissionQueueClient,
  buildAdmissionQueueHubUrl,
  createRuntimeDeviceApi,
} from '@aq/api-client'
import {
  ApiDeviceConfigurationProvider,
  JsonDeviceConfigurationProvider,
  type IDeviceConfigurationProvider,
} from '@aq/device-config'

let deviceConfigProvider: IDeviceConfigurationProvider | null = null
let runtimeDeviceApi: ReturnType<typeof createRuntimeDeviceApi> | null = null

function getProviderMode(): 'api' | 'json' {
  const raw = (import.meta.env.VITE_DEVICE_CONFIG_PROVIDER ?? 'api').trim().toLowerCase()
  return raw === 'json' ? 'json' : 'api'
}

export async function getDeviceConfigProvider(): Promise<IDeviceConfigurationProvider> {
  if (deviceConfigProvider) return deviceConfigProvider
  const mode = getProviderMode()
  if (mode === 'json') {
    const response = await fetch(`${import.meta.env.BASE_URL}devices.json`, { cache: 'no-store' })
    if (!response.ok) {
      throw new Error(`Failed to load devices.json (${response.status})`)
    }
    const json = (await response.json()) as unknown
    deviceConfigProvider = JsonDeviceConfigurationProvider.fromJson(json)
    return deviceConfigProvider
  }

  const runtime = getRuntimeDeviceApi()
  deviceConfigProvider = new ApiDeviceConfigurationProvider({
    getDisplayBootConfig: (displayId) => runtime.getPublicDisplayBootConfig(displayId),
  })
  return deviceConfigProvider
}

export function getRuntimeDeviceApi() {
  if (runtimeDeviceApi) return runtimeDeviceApi
  const baseUrl = import.meta.env.VITE_BILREG_API_BASE?.trim()
  if (!baseUrl) {
    throw new Error('VITE_BILREG_API_BASE is not configured')
  }
  const client = new AdmissionQueueClient({
    baseUrl,
    auth: { getToken: () => null },
  })
  runtimeDeviceApi = createRuntimeDeviceApi(client)
  return runtimeDeviceApi
}

export function getAdmissionQueueHubUrl(): string {
  const baseUrl = import.meta.env.VITE_BILREG_API_BASE?.trim()
  if (!baseUrl) {
    throw new Error('VITE_BILREG_API_BASE is not configured')
  }
  if (import.meta.env.DEV) {
    return '/hubs/admission-queue'
  }
  return buildAdmissionQueueHubUrl(baseUrl)
}

export function __resetInfrastructureForTests() {
  deviceConfigProvider = null
  runtimeDeviceApi = null
}
