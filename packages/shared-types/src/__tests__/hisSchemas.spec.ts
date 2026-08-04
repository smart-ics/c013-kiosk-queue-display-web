import { describe, expect, it } from 'vitest'
import {
  bookingAssistanceBodySchema,
  bookingDetailSchema,
  bookingSearchItemSchema,
  returnCreateWalkInSchema,
} from '../index'

const bookingItem = {
  bookingId: 'BK1',
  bookingDate: '2026-08-03',
  reg: { regId: 'R0', pasienId: 'PT1', pasienName: 'Andi' },
  layanan: { layananId: 'LY1', layananName: 'Poli Jantung' },
  dokter: { ppaId: 'DP1', ppaName: 'Dr. X', isDefault: true },
  tglBerobat: '2026-08-03',
  jamPraktek: '08:00',
  noAntrian: 3,
  extAppRef: { extAppName: 'APP', reffId: 'REF1', checkInQr: 'QR1' },
}

describe('hisSchemas', () => {
  it('parses returnCreateWalkIn', () => {
    expect(returnCreateWalkInSchema.parse({ regId: 'R1', noAntrian: 12 })).toEqual({
      regId: 'R1',
      noAntrian: 12,
    })
  })

  it('parses booking search item', () => {
    expect(bookingSearchItemSchema.parse(bookingItem).bookingId).toBe('BK1')
  })

  it('parses booking detail with coverageInfo', () => {
    const parsed = bookingDetailSchema.parse({
      ...bookingItem,
      coverageInfo: { asuransiName: 'BPJS', noPeserta: '000123456', noRujukan: 'REF1' },
    })
    expect(parsed.coverageInfo.noPeserta).toBe('000123456')
  })

  it('allows bookingAssistance without bookingId', () => {
    const parsed = bookingAssistanceBodySchema.parse({
      servicePointId: 'REG',
      kioskId: 'K01',
      userId: 'hidokkiosk',
    })
    expect(parsed.bookingId).toBeUndefined()
  })
})
