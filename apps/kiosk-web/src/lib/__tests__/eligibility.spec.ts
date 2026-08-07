import { describe, expect, it } from 'vitest'
import type { BookingDetail, Polis } from '@aq/shared-types'
import {
  computeNeedsEligibility,
  deriveBookingJaminan,
  deriveWalkinJaminan,
  UMAT_TIPE_JAMINAN_ID,
} from '../eligibility'

const bpjsPolis: Polis = {
  polisId: 'P1',
  noPolis: '000123456',
  atasName: 'Andi',
  pasien: { pasienId: 'PT1' },
  tipeJaminan: { tipeJaminanId: 'BPJS', tipeJaminanName: 'BPJS' },
  tglExpired: null,
}

const booking = {
  bookingId: 'BK1',
  bookingDate: '2026-08-03',
  reg: { regId: 'R0', pasienId: 'PT1', pasienName: 'Andi' },
  layanan: { layananId: 'LY1', layananName: 'Poli Jantung' },
  dokter: { ppaId: 'DP1', ppaName: 'Dr. X', isDefault: true },
  tglBerobat: '2026-08-03',
  jamPraktek: '08:00',
  noAntrian: 3,
  extAppRef: { extAppName: 'APP', reffId: 'REF1', checkInQr: 'QR1' },
} as BookingDetail

describe('computeNeedsEligibility', () => {
  it('is false for Umum (00000)', () => {
    expect(computeNeedsEligibility(UMAT_TIPE_JAMINAN_ID, { groupJaminanId: 'G1' })).toBe(false)
  })

  it('is true for BPJS with a group map', () => {
    expect(computeNeedsEligibility('BPJS', { groupJaminanId: 'G1' })).toBe(true)
  })

  it('is false when group map is null', () => {
    expect(computeNeedsEligibility('BPJS', null)).toBe(false)
  })
})

describe('deriveBookingJaminan', () => {
  it('defaults to Umum when coverageInfo.noPeserta is empty', () => {
    const detail = { ...booking, coverageInfo: { asuransiName: '', noPeserta: '', noRujukan: '' } }
    expect(deriveBookingJaminan(detail, [bpjsPolis]).tipeJaminanId).toBe(UMAT_TIPE_JAMINAN_ID)
  })

  it('derives BPJS from a polis matched by polisId', () => {
    const detail = {
      ...booking,
      coverageInfo: { asuransiName: 'BPJS', noPeserta: 'P1', noRujukan: 'REF1' },
    }
    const status = deriveBookingJaminan(detail, [bpjsPolis])
    expect(status.tipeJaminanId).toBe('BPJS')
    expect(status.noPeserta).toBe('P1')
  })

  it('derives BPJS from a matching polis', () => {
    const detail = {
      ...booking,
      coverageInfo: { asuransiName: 'BPJS', noPeserta: '000123456', noRujukan: 'REF1' },
    }
    const status = deriveBookingJaminan(detail, [bpjsPolis])
    expect(status.tipeJaminanId).toBe('BPJS')
    expect(status.noPeserta).toBe('000123456')
  })
})

describe('deriveWalkinJaminan', () => {
  it('uses the first polis', () => {
    const status = deriveWalkinJaminan([bpjsPolis])
    expect(status.tipeJaminanId).toBe('BPJS')
    expect(status.noPeserta).toBe('000123456')
  })

  it('defaults to Umum when no polis', () => {
    expect(deriveWalkinJaminan([]).tipeJaminanId).toBe(UMAT_TIPE_JAMINAN_ID)
  })
})
