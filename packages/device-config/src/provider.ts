import type { DeviceConfig } from '@aq/shared-types'

export interface IDeviceConfigurationProvider {
  getConfig(deviceId: string): Promise<DeviceConfig>
  listDisplayScreenIds(): Promise<string[]>
  listKioskStationIds(): Promise<{ stationId: string; displayName: string; locationName?: string | null }[]>
}

export class DeviceConfigNotFoundError extends Error {
  readonly code = 'DEVICE_CONFIG_NOT_FOUND' as const
  readonly deviceId: string

  constructor(deviceId: string) {
    super(`Konfigurasi perangkat tidak dikenal untuk '${deviceId}'`)
    this.name = 'DeviceConfigNotFoundError'
    this.deviceId = deviceId
  }
}

export class DeviceConfigInvalidError extends Error {
  readonly code = 'DEVICE_CONFIG_INVALID' as const
  readonly deviceId: string

  constructor(deviceId: string, message: string) {
    super(message)
    this.name = 'DeviceConfigInvalidError'
    this.deviceId = deviceId
  }
}
