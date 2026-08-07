import { deviceConfigSchema, type DeviceConfig } from '@aq/shared-types'
import {
  DeviceConfigInvalidError,
  DeviceConfigNotFoundError,
  type IDeviceConfigurationProvider,
} from './provider'

export type DeviceConfigCatalog = Record<string, Omit<DeviceConfig, 'deviceId'> & { deviceId?: string }>

export class JsonDeviceConfigurationProvider implements IDeviceConfigurationProvider {
  private readonly catalog: DeviceConfigCatalog

  constructor(catalog: DeviceConfigCatalog) {
    this.catalog = catalog
  }

  static fromJson(json: unknown): JsonDeviceConfigurationProvider {
    if (!json || typeof json !== 'object' || Array.isArray(json)) {
      throw new DeviceConfigInvalidError('*', 'Device catalog must be a JSON object keyed by deviceId')
    }
    return new JsonDeviceConfigurationProvider(json as DeviceConfigCatalog)
  }

  async getConfig(deviceId: string): Promise<DeviceConfig> {
    const key = deviceId.trim()
    if (!key) throw new DeviceConfigNotFoundError(deviceId)

    const raw = this.catalog[key]
    if (!raw) throw new DeviceConfigNotFoundError(key)

    const parsed = deviceConfigSchema.safeParse({
      ...raw,
      deviceId: raw.deviceId ?? key,
    })

    if (!parsed.success) {
      throw new DeviceConfigInvalidError(key, parsed.error.message)
    }

    if (parsed.data.deviceId !== key) {
      throw new DeviceConfigInvalidError(
        key,
        `Catalog entry deviceId '${parsed.data.deviceId}' does not match key '${key}'`,
      )
    }

    return parsed.data
  }

  async listDisplayScreenIds(): Promise<string[]> {
    return Object.entries(this.catalog)
      .filter(([, raw]) => raw?.role === 'display')
      .map(([id]) => id)
      .sort((a, b) => a.localeCompare(b))
  }

  async listKioskStationIds(): Promise<{ stationId: string; displayName: string; locationName?: string | null }[]> {
    return Object.entries(this.catalog)
      .filter(([, raw]) => raw?.role === 'kiosk')
      .map(([id, raw]) => ({
        stationId: id,
        displayName: raw.displayName || id,
        locationName: raw.locationName || null,
      }))
      .sort((a, b) => a.stationId.localeCompare(b.stationId))
  }
}
