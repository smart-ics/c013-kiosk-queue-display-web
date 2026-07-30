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
import { configService } from '@aq/app-config'

let deviceConfigProvider: IDeviceConfigurationProvider | null = null
let admissionQueueApi: AdmissionQueueApi | null = null

export async function getDeviceConfigProvider(): Promise<IDeviceConfigurationProvider> {
  if (deviceConfigProvider) return deviceConfigProvider
  const baseUrl = configService.getConfig().bilregApiBase
  if (!baseUrl) throw new Error('bilregApiBase is not configured in global_config.json')
  const runtime = createRuntimeDeviceApi(
    new AdmissionQueueClient({
      baseUrl,
      auth: { getToken: () => 'kiosk-no-auth' },
    }),
  )
  deviceConfigProvider = new ApiKioskDeviceConfigurationProvider({
    getKioskBootConfig: (stationId) => runtime.getPublicKioskBootConfig(stationId),
    listKiosks: () =>
      runtime.listPublicKiosks().then((kiosks) =>
        kiosks.filter((k) => k.active).map((k) => ({ stationId: k.stationId })),
      ),
  })
  return deviceConfigProvider
}

export function getAdmissionQueueApi(): AdmissionQueueApi {
  if (admissionQueueApi) return admissionQueueApi
  const baseUrl = configService.getConfig().bilregApiBase
  if (!baseUrl) {
    throw new Error('bilregApiBase is not configured in global_config.json')
  }
  const client = new AdmissionQueueClient({
    baseUrl,
    auth: { getToken: () => 'kiosk-no-auth' },
  })
  admissionQueueApi = createAdmissionQueueApi(client)
  return admissionQueueApi
}

export function __resetInfrastructureForTests() {
  deviceConfigProvider = null
  admissionQueueApi = null
}
