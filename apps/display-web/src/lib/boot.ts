import type { DeviceConfig } from '@aq/shared-types'

export type DisplayBootResult =
  | { ok: true }
  | { ok: false; message: string }

export function validateDisplayDeviceConfig(
  screenId: string,
  config: DeviceConfig,
): DisplayBootResult {
  if (config.role !== 'display') {
    return { ok: false, message: `Device '${screenId}' bukan role display.` }
  }
  const loketIds = config.loketIds ?? []
  if (loketIds.length === 0) {
    return { ok: false, message: `Device '${screenId}' tidak punya loketIds.` }
  }
  return { ok: true }
}
