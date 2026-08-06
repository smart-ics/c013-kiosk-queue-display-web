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
import { createHisApi, createJetliApi, type HisApi, type JetliApi } from '@aq/api-client'
import { getKioskToken } from './lib/kioskLogin'
import { createServiceCatalog, type ServiceCatalog } from './lib/serviceCatalog'

let deviceConfigProvider: IDeviceConfigurationProvider | null = null
let admissionQueueApi: AdmissionQueueApi | null = null
let hisApi: HisApi | null = null
let jetliApi: JetliApi | null = null

export async function getDeviceConfigProvider(): Promise<IDeviceConfigurationProvider> {
  if (deviceConfigProvider) return deviceConfigProvider
  const baseUrl = configService.getConfig().bilregApiBase
  if (!baseUrl) throw new Error('bilregApiBase is not configured in global_config.json')
  const runtime = createRuntimeDeviceApi(
    new AdmissionQueueClient({
      baseUrl,
      auth: { getToken: getKioskToken },
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
    auth: { getToken: getKioskToken },
  })
  admissionQueueApi = createAdmissionQueueApi(client)
  return admissionQueueApi
}

export function getHisApi(): HisApi {
  if (hisApi) return hisApi
  const baseUrl = configService.getConfig().bilregApiBase
  if (!baseUrl) throw new Error('bilregApiBase is not configured in global_config.json')
  hisApi = createHisApi(
    new AdmissionQueueClient({
      baseUrl,
      auth: { getToken: getKioskToken },
    }),
  )
  return hisApi
}

export function getJetliApi(): JetliApi {
  if (jetliApi) return jetliApi
  const cfg = configService.getConfig()
  const baseUrl = cfg.jetliApiBase ?? cfg.bilregApiBase
  if (!baseUrl) throw new Error('bilregApiBase is not configured in global_config.json')
  jetliApi = createJetliApi(
    new AdmissionQueueClient({
      baseUrl,
      auth: { getToken: getKioskToken },
    }),
  )
  return jetliApi
}

export function getServiceCatalog(): ServiceCatalog {
  const his = getHisApi()
  return createServiceCatalog({
    getBusinessDate: async () => (await his.getBusinessDate()).businessDate,
    listPoli: (businessDate) => his.listPoli(businessDate),
    listDokter: (businessDate, poliId) => his.listDokter(businessDate, poliId),
    listJadwal: (businessDate, ppaId) => his.listJadwal(businessDate, ppaId),
  })
}

export function __resetInfrastructureForTests() {
  deviceConfigProvider = null
  admissionQueueApi = null
  hisApi = null
  jetliApi = null
}
