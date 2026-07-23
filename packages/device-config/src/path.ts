const KIOSK_PREFIX = '/kiosk/'
const DISPLAY_PREFIX = '/display/'

export function parseStationIdFromPath(pathname: string): string | null {
  return parseDeviceIdFromPath(pathname, KIOSK_PREFIX)
}

export function parseScreenIdFromPath(pathname: string): string | null {
  return parseDeviceIdFromPath(pathname, DISPLAY_PREFIX)
}

function parseDeviceIdFromPath(pathname: string, prefix: string): string | null {
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`
  if (!normalized.startsWith(prefix)) return null
  const rest = normalized.slice(prefix.length)
  const segment = rest.split('/').filter(Boolean)[0]
  if (!segment) return null
  try {
    return decodeURIComponent(segment).trim() || null
  } catch {
    return null
  }
}
