import { EnvAuthTokenProvider, type IAuthTokenProvider } from '@aq/auth'
import {
  AdmissionQueueClient,
  buildAdmissionQueueHubUrl,
  createAdmissionQueueApi,
  createRuntimeDeviceApi,
  type AdmissionQueueApi,
} from '@aq/api-client'
import {
  ApiDeviceConfigurationProvider,
  JsonDeviceConfigurationProvider,
  type IDeviceConfigurationProvider,
} from '@aq/device-config'

let deviceConfigProvider: IDeviceConfigurationProvider | null = null
let authTokenProvider: IAuthTokenProvider | null = null
let admissionQueueApi: AdmissionQueueApi | null = null
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
    getDisplayBootConfig: (displayId) => runtime.getDisplayBootConfig(displayId),
  })
  return deviceConfigProvider
}

export function getAuthTokenProvider(): IAuthTokenProvider {
  if (!authTokenProvider) {
    authTokenProvider = new EnvAuthTokenProvider(import.meta.env.VITE_BILREG_TOKEN)
  }
  return authTokenProvider
}

export function getAdmissionQueueApi(): AdmissionQueueApi {
  if (admissionQueueApi) return admissionQueueApi
  const baseUrl = import.meta.env.VITE_BILREG_API_BASE?.trim()
  if (!baseUrl) {
    throw new Error('VITE_BILREG_API_BASE is not configured')
  }
  const client = new AdmissionQueueClient({
    baseUrl,
    auth: getAuthTokenProvider(),
  })
  admissionQueueApi = createAdmissionQueueApi(client)
  return admissionQueueApi
}

function getRuntimeDeviceApi() {
  if (runtimeDeviceApi) return runtimeDeviceApi
  const baseUrl = import.meta.env.VITE_BILREG_API_BASE?.trim()
  if (!baseUrl) {
    throw new Error('VITE_BILREG_API_BASE is not configured')
  }
  const client = new AdmissionQueueClient({
    baseUrl,
    auth: getAuthTokenProvider(),
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
  authTokenProvider = null
  admissionQueueApi = null
  runtimeDeviceApi = null
}
