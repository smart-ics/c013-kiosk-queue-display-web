import {
  AdmissionQueueClient,
  buildAdmissionQueueHubUrl,
  createRuntimeDeviceApi,
} from '@aq/api-client'
import {
  ApiDeviceConfigurationProvider,
  type IDeviceConfigurationProvider,
} from '@aq/device-config'

let deviceConfigProvider: IDeviceConfigurationProvider | null = null
let runtimeDeviceApi: ReturnType<typeof createRuntimeDeviceApi> | null = null

export async function getDeviceConfigProvider(): Promise<IDeviceConfigurationProvider> {
  if (deviceConfigProvider) return deviceConfigProvider

  const runtime = getRuntimeDeviceApi()
  deviceConfigProvider = new ApiDeviceConfigurationProvider({
    getDisplayBootConfig: (displayId) => runtime.getPublicDisplayBootConfig(displayId),
    listDisplays: () => runtime.listPublicDisplays(),
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
