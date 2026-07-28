import type { DeviceConfig } from '@aq/shared-types'

export interface IDeviceConfigurationProvider {
  getConfig(deviceId: string): Promise<DeviceConfig>
  listDisplayScreenIds(): Promise<string[]>
  listKioskStationIds(): Promise<string[]>
}

export class DeviceConfigNotFoundError extends Error {
  readonly code = 'DEVICE_CONFIG_NOT_FOUND' as const
  readonly deviceId: string

  constructor(deviceId: string) {
    super(`Unknown device configuration for '${deviceId}'`)
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
