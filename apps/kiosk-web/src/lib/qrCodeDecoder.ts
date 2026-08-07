function isBase64String(str: string): boolean {
  if (!str || str.length % 4 !== 0) return false
  return /^[A-Za-z0-9+/]*={0,2}$/.test(str)
}

function base64ToUtf8(base64: string): string {
  const binary = atob(base64)
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder('utf-8').decode(bytes)
}

export function getKodeBookingMjkn(qrCode: string): string {
  const sanitized = qrCode.replace(/\s+/g, '')
  if (sanitized.length < 30) {
    return qrCode
  }
  if (!isBase64String(sanitized)) {
    return qrCode
  }
  try {
    const json = base64ToUtf8(sanitized)
    const parsed = JSON.parse(json) as Record<string, unknown>
    const kodeBooking = parsed?.kodeBooking ?? parsed?.kodebooking
    if (kodeBooking === undefined || kodeBooking === null) {
      throw new Error('kodeBooking not found')
    }
    return String(kodeBooking)
  } catch {
    return qrCode
  }
}
