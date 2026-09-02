import {
  DeviceConfigInvalidError,
  DeviceConfigNotFoundError,
  type IDeviceConfigurationProvider,
} from './provider'
import { deviceConfigSchema, type DeviceConfig, type DisplayBootConfig } from '@aq/shared-types'

export type ApiDeviceConfigurationProviderOptions = {
  getDisplayBootConfig: (displayId: string) => Promise<DisplayBootConfig>
  listDisplays?: () => Promise<{ deviceId: string }[]>
  listKiosks?: () => Promise<{ deviceId: string }[]>
}

export class ApiDeviceConfigurationProvider implements IDeviceConfigurationProvider {
  constructor(private readonly options: ApiDeviceConfigurationProviderOptions) {}

  async getConfig(deviceId: string): Promise<DeviceConfig> {
    const id = deviceId.trim()
    if (!id) throw new DeviceConfigInvalidError(deviceId, 'deviceId diperlukan')

    let boot: DisplayBootConfig
    try {
      boot = await this.options.getDisplayBootConfig(id)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal memuat konfigurasi display'
      if (/not found|AQ_DISPLAY_NOT_FOUND/i.test(message)) {
        throw new DeviceConfigNotFoundError(id)
      }
      if (/inactive|AQ_DISPLAY_INACTIVE|mapping|AQ_DISPLAY_MAPPING/i.test(message)) {
        throw new DeviceConfigInvalidError(id, message)
      }
      throw new DeviceConfigInvalidError(id, message)
    }

    const parsed = deviceConfigSchema.safeParse({
      deviceId: boot.deviceId,
      role: boot.role,
      loketIds: boot.loketIds,
      pollIntervalMs: boot.pollIntervalMs,
      audioEnabled: boot.audioEnabled,
      displayName: boot.displayName,
      locationName: boot.locationName,
      layoutKey: boot.layoutKey,
      updatedAt: boot.updatedAt,
      rowVersion: boot.rowVersion,
    })
    if (!parsed.success) {
      throw new DeviceConfigInvalidError(id, parsed.error.message)
    }
    if (parsed.data.deviceId !== id) {
      throw new DeviceConfigInvalidError(id, 'deviceId tidak cocok dengan konfigurasi boot')
    }
    return parsed.data
  }

  async listDisplayScreenIds(): Promise<string[]> {
    if (!this.options.listDisplays) {
      throw new DeviceConfigInvalidError(
        '*',
        'listDisplayScreenIds requires listDisplays option to be configured',
      )
    }
    const displays = await this.options.listDisplays()
    return displays.map((d) => d.deviceId)
  }

  async listKioskStationIds(): Promise<{ stationId: string; displayName: string; locationName?: string | null }[]> {
    if (!this.options.listKiosks) {
      throw new DeviceConfigInvalidError(
        '*',
        'listKioskStationIds requires listKiosks option to be configured',
      )
    }
    const kiosks = await this.options.listKiosks()
    return kiosks.map((k) => ({
      stationId: k.deviceId,
      displayName: k.deviceId,
      locationName: null,
    }))
  }
}
