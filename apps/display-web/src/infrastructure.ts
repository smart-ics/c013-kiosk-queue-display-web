import { EnvAuthTokenProvider, type IAuthTokenProvider } from '@aq/auth'
import {
  AdmissionQueueClient,
  buildAdmissionQueueHubUrl,
  createAdmissionQueueApi,
  type AdmissionQueueApi,
} from '@aq/api-client'
import {
  JsonDeviceConfigurationProvider,
  type IDeviceConfigurationProvider,
} from '@aq/device-config'

let deviceConfigProvider: IDeviceConfigurationProvider | null = null
let authTokenProvider: IAuthTokenProvider | null = null
let admissionQueueApi: AdmissionQueueApi | null = null

export async function getDeviceConfigProvider(): Promise<IDeviceConfigurationProvider> {
  if (deviceConfigProvider) return deviceConfigProvider
  const response = await fetch(`${import.meta.env.BASE_URL}devices.json`, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Failed to load devices.json (${response.status})`)
  }
  const json = (await response.json()) as unknown
  deviceConfigProvider = JsonDeviceConfigurationProvider.fromJson(json)
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

export function getAdmissionQueueHubUrl(): string {
  const baseUrl = import.meta.env.VITE_BILREG_API_BASE?.trim()
  if (!baseUrl) {
    throw new Error('VITE_BILREG_API_BASE is not configured')
  }
  return buildAdmissionQueueHubUrl(baseUrl)
}

export function __resetInfrastructureForTests() {
  deviceConfigProvider = null
  authTokenProvider = null
  admissionQueueApi = null
}
