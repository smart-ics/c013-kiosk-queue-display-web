import { describe, expect, it } from 'vitest'
import { getKodeBookingMjkn } from '../qrCodeDecoder'

describe('getKodeBookingMjkn', () => {
  it('returns short codes unchanged', () => {
    expect(getKodeBookingMjkn('BK001')).toBe('BK001')
  })

  it('returns non-base64 long strings unchanged', () => {
    const long = 'a'.repeat(32) + '!not-base64'
    expect(getKodeBookingMjkn(long)).toBe(long)
  })

  it('extracts kodeBooking from valid base64 JSON', () => {
    const payload = JSON.stringify({ kodeBooking: 'AN123456' })
    const encoded = btoa(payload)
    expect(getKodeBookingMjkn(encoded)).toBe('AN123456')
  })

  it('returns original when base64 JSON has no kodeBooking field', () => {
    const payload = JSON.stringify({ other: 'value' })
    const encoded = btoa(payload)
    expect(getKodeBookingMjkn(encoded)).toBe(encoded)
  })

  it('returns original when base64 is not valid JSON', () => {
    const encoded = btoa('not-json-data!!!')
    expect(getKodeBookingMjkn(encoded)).toBe(encoded)
  })
})
