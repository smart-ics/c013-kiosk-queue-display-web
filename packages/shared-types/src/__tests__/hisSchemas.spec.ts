import { describe, expect, it } from 'vitest'
import {
  bookingAssistanceBodySchema,
  bookingDetailSchema,
  bookingSearchItemSchema,
  registrationPrintDataSchema,
  responseCreateSepUnionSchema,
  responseFingerprintSchema,
  responseSepByNoPesertaSchema,
  responseSepByRegSchema,
  responseUploadSepUnionSchema,
  returnCreateWalkInSchema,
  rujukanSkpdResponseSchema,
} from '../index'

const sepItem = {
  sepId: '01KFHYG1K5YZ5PZY2Y3SA5QJB3',
  sepNo: '1104R0040322V000230',
  noRujukan: '0122R0030823V000098',
  noPeserta: '0001234567890',
  namaPeserta: 'John Doe',
  sepDate: '2026-08-06',
  layanan: { layananId: 'RJ001', layananName: 'Poli Umum' },
  diagnosa: { icd10Id: 'E11.8', icd10Name: 'Type 2 DM' },
}

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

  it('parses a SEP item with layanan and diagnosa', () => {
    const parsed = responseSepByNoPesertaSchema.parse([sepItem])
    expect(parsed[0]?.layanan?.layananName).toBe('Poli Umum')
    expect(parsed[0]?.diagnosa?.icd10Name).toBe('Type 2 DM')
  })

  it('parses a nullable SEP by reg, null when no SEP exists', () => {
    expect(responseSepByRegSchema.parse(null)).toBeNull()
    const parsed = responseSepByRegSchema.parse(sepItem)
    expect(parsed?.sepNo).toBe('1104R0040322V000230')
  })

  it('parses fingerprint status and normalizes id to lowercase', () => {
    const parsed = responseFingerprintSchema.parse({ id: '1', status: 'Finger print tidak sesuai' })
    expect(parsed.id).toBe('1')
  })

  it('parses rujukan/SKDP response with nullable rujukan', () => {
    const parsed = rujukanSkpdResponseSchema.parse({
      peserta: {
        noPeserta: '0001234567890',
        nama: 'John Doe',
        hakKelas: { kode: 'K1', nama: 'Kelas 1' },
        status: { kode: '1', info: 'AKTIF' },
        jenisPeserta: { kode: 'PNS', nama: 'PNS' },
        provider: { kode: 'P1', nama: 'RS A' },
        prbInfo: null,
        tglTat: '2026-08-06',
        tglLahir: '1990-01-01',
      },
      rujukan: { noRujukan: '0122R0030823V000098', tglRujukan: '2026-08-01' },
      listSkdp: [{ noSkdp: 'SKDP1', tglMulai: '2026-08-01' }],
    })
    expect(parsed.peserta.noPeserta).toBe('0001234567890')
    expect(parsed.rujukan?.noRujukan).toBe('0122R0030823V000098')
    expect(parsed.listSkdp).toHaveLength(1)
  })

  it('accepts a plain string business-error payload on SEP create', () => {
    expect(responseCreateSepUnionSchema.parse('Biometrik tidak ditemukan')).toBe(
      'Biometrik tidak ditemukan',
    )
    expect(
      responseCreateSepUnionSchema.parse({
        sepId: '01KFHYG1K5YZ5PZY2Y3SA5QJB3',
        sepNo: '-',
      }),
    ).toEqual({ sepId: '01KFHYG1K5YZ5PZY2Y3SA5QJB3', sepNo: '-' })
  })

  it('accepts SEP upload response with optional regId', () => {
    expect(
      responseUploadSepUnionSchema.parse({
        sepId: '01KFHYG1K5YZ5PZY2Y3SA5QJB3',
        sepNo: '1104R0040322V000230',
        regId: 'RG12345678',
      }),
    ).toEqual({
      sepId: '01KFHYG1K5YZ5PZY2Y3SA5QJB3',
      sepNo: '1104R0040322V000230',
      regId: 'RG12345678',
    })
    expect(responseUploadSepUnionSchema.parse('FAILED')).toBe('FAILED')
  })

  it('parses complete registration print data', () => {
    expect(
      registrationPrintDataSchema.parse({
        regId: 'RG12345678',
        noAntrian: 12,
        pasienName: 'Andi',
        pasienId: 'PT1',
        tglLahir: '1990-01-01',
        tipeJaminanName: 'Umum',
        noSep: undefined,
        serviceName: 'Poli Jantung',
        dokterName: 'Dr. X',
      }),
    ).toMatchObject({ regId: 'RG12345678', noAntrian: 12 })
  })

  it('rejects registration print data without a queue number', () => {
    expect(() => registrationPrintDataSchema.parse({ regId: 'RG1', pasienName: 'Andi' })).toThrow()
  })
})
