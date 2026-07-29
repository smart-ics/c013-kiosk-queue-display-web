import { deviceConfigSchema, type DeviceConfig, type KioskBootConfig } from '@aq/shared-types'
import {
  DeviceConfigInvalidError,
  DeviceConfigNotFoundError,
  type IDeviceConfigurationProvider,
} from './provider'

export type ApiKioskDeviceConfigurationProviderOptions = {
  getKioskBootConfig: (stationId: string) => Promise<KioskBootConfig>
  listKiosks?: () => Promise<{ stationId: string }[]>
}

export class ApiKioskDeviceConfigurationProvider implements IDeviceConfigurationProvider {
  constructor(private readonly options: ApiKioskDeviceConfigurationProviderOptions) {}

  async getConfig(deviceId: string): Promise<DeviceConfig> {
    const id = deviceId.trim()
    if (!id) throw new DeviceConfigInvalidError(deviceId, 'stationId is required')

    let boot: KioskBootConfig
    try {
      boot = await this.options.getKioskBootConfig(id)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load kiosk configuration'
      if (/not found|AQ_KIOSK_NOT_FOUND/i.test(message)) {
        throw new DeviceConfigNotFoundError(id)
      }
      throw new DeviceConfigInvalidError(id, message)
    }

    const parsed = deviceConfigSchema.safeParse({
      deviceId: boot.deviceId,
      role: boot.role,
      servicePointIds: boot.servicePointIds,
      printerProxyPort: boot.printerProxyPort,
      displayName: boot.displayName,
      locationName: boot.locationName,
      updatedAt: boot.updatedAt,
      rowVersion: boot.rowVersion,
    })
    if (!parsed.success) {
      throw new DeviceConfigInvalidError(id, parsed.error.message)
    }
    if (parsed.data.deviceId !== id) {
      throw new DeviceConfigInvalidError(id, 'deviceId mismatch in boot config')
    }
    return parsed.data
  }

  async listDisplayScreenIds(): Promise<string[]> {
    return []
  }

  async listKioskStationIds(): Promise<string[]> {
    if (this.options.listKiosks) {
      const kiosks = await this.options.listKiosks()
      return kiosks.map((k) => k.stationId)
    }
    return []
  }
}
