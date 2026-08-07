import {
  AdmissionQueueClient,
  buildAdmissionQueueHubUrl,
  createRuntimeDeviceApi,
  createHisApi,
  type HisApi,
} from '@aq/api-client'
import {
  ApiDeviceConfigurationProvider,
  type IDeviceConfigurationProvider,
} from '@aq/device-config'
import { configService } from '@aq/app-config'
import { createEnvAuthTokenProvider } from '@aq/auth'

let deviceConfigProvider: IDeviceConfigurationProvider | null = null
let runtimeDeviceApi: ReturnType<typeof createRuntimeDeviceApi> | null = null
let hisApi: HisApi | null = null

export async function getDeviceConfigProvider(): Promise<IDeviceConfigurationProvider> {
  if (deviceConfigProvider) return deviceConfigProvider

  const runtime = getRuntimeDeviceApi()
  deviceConfigProvider = new ApiDeviceConfigurationProvider({
    getDisplayBootConfig: (displayId) => runtime.getPublicDisplayBootConfig(displayId),
    listDisplays: () =>
      runtime.listPublicDisplays().then((displays) =>
        displays.filter((d) => d.active).map((d) => ({ deviceId: d.displayId })),
      ),
  })
  return deviceConfigProvider
}

export function getRuntimeDeviceApi() {
  if (runtimeDeviceApi) return runtimeDeviceApi
  const baseUrl = configService.getConfig().bilregApiBase
  if (!baseUrl) {
    throw new Error('bilregApiBase is not configured in global_config.json')
  }
  const client = new AdmissionQueueClient({
    baseUrl,
    auth: createEnvAuthTokenProvider(import.meta.env),
  })
  runtimeDeviceApi = createRuntimeDeviceApi(client)
  return runtimeDeviceApi
}

export function getHisApi(): HisApi {
  if (hisApi) return hisApi
  const baseUrl = configService.getConfig().bilregApiBase
  if (!baseUrl) {
    throw new Error('bilregApiBase is not configured in global_config.json')
  }
  hisApi = createHisApi(
    new AdmissionQueueClient({
      baseUrl,
      auth: createEnvAuthTokenProvider(import.meta.env),
    }),
  )
  return hisApi
}

export function getAdmissionQueueHubUrl(): string {
  const baseUrl = configService.getConfig().bilregApiBase
  if (!baseUrl) {
    throw new Error('bilregApiBase is not configured in global_config.json')
  }
  if (import.meta.env.DEV) {
    return '/hubs/admission-queue'
  }
  return buildAdmissionQueueHubUrl(baseUrl)
}

export function __resetInfrastructureForTests() {
  deviceConfigProvider = null
  runtimeDeviceApi = null
  hisApi = null
}
