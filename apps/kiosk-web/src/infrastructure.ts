import { EnvAuthTokenProvider, type IAuthTokenProvider } from '@aq/auth'
import {
  AdmissionQueueClient,
  createAdmissionQueueApi,
  createRuntimeDeviceApi,
  type AdmissionQueueApi,
} from '@aq/api-client'
import {
  ApiKioskDeviceConfigurationProvider,
  type IDeviceConfigurationProvider,
} from '@aq/device-config'

let deviceConfigProvider: IDeviceConfigurationProvider | null = null
let authTokenProvider: IAuthTokenProvider | null = null
let admissionQueueApi: AdmissionQueueApi | null = null

export async function getDeviceConfigProvider(): Promise<IDeviceConfigurationProvider> {
  if (deviceConfigProvider) return deviceConfigProvider
  const baseUrl = import.meta.env.VITE_BILREG_API_BASE?.trim()
  if (!baseUrl) throw new Error('VITE_BILREG_API_BASE is not configured')
  const runtime = createRuntimeDeviceApi(
    new AdmissionQueueClient({
      baseUrl,
      auth: getAuthTokenProvider(),
    }),
  )
  deviceConfigProvider = new ApiKioskDeviceConfigurationProvider({
    getKioskBootConfig: (stationId) => runtime.getPublicKioskBootConfig(stationId),
    listKiosks: () => runtime.listPublicKiosks(),
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

export function __resetInfrastructureForTests() {
  deviceConfigProvider = null
  authTokenProvider = null
  admissionQueueApi = null
}
