import { describe, expect, it, vi } from 'vitest'
import { createHisApi, createJetliApi } from '../his'
import { AdmissionQueueClient } from '../http'
import type { IAuthTokenProvider } from '@aq/auth'

function createAuth(token = 't'): IAuthTokenProvider {
  return { getToken: () => token }
}

describe('createHisApi', () => {
  it('searches booking with tglBerobat + keyword in path', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          status: 'success',
          data: [
            {
              bookingId: 'BK1',
              bookingDate: '2026-08-03',
              reg: { regId: 'R0', pasienId: 'PT1', pasienName: 'Andi' },
              layanan: { layananId: 'LY1', layananName: 'Poli Jantung' },
              dokter: { ppaId: 'DP1', ppaName: 'Dr. X', isDefault: true },
              tglBerobat: '2026-08-03',
              jamPraktek: '08:00',
              noAntrian: 3,
              extAppRef: { extAppName: 'APP', reffId: 'REF1', checkInQr: 'QR1' },
            },
          ],
        }),
        { status: 200 },
      ),
    )

    const client = new AdmissionQueueClient({
      baseUrl: 'http://localhost:5000/api',
      auth: createAuth(),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    const items = await createHisApi(client).searchBooking('2026-08-03', 'BK1')
    expect(items).toHaveLength(1)
    expect(items[0]?.bookingId).toBe('BK1')
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain(
      'Booking/search/2026-08-03/BK1',
    )
  })

  it('posts booking-assistance and parses queue ticket', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          status: 'success',
          data: { antrianId: 'B1', noUrut: 1, queueLabel: 'B-001', createdAt: '2026-08-03T08:00:00' },
        }),
        { status: 200 },
      ),
    )
    const client = new AdmissionQueueClient({
      baseUrl: 'http://localhost:5000/api',
      auth: createAuth(),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    const ticket = await createHisApi(client).bookingAssistance({
      servicePointId: 'REG',
      kioskId: 'K01',
      userId: 'hidokkiosk',
    })
    expect(ticket.queueLabel).toBe('B-001')
    const url = String(fetchImpl.mock.calls[0]?.[0])
    expect(url).toContain('v1/admission-queue/booking-assistance')
  })
})

describe('createJetliApi', () => {
  it('fetches nullable group jaminan map', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          status: 'success',
          data: { tipeJaminanId: 'BPJS', groupJaminanId: 'G1', groupJaminanName: 'BPJS' },
        }),
        { status: 200 },
      ),
    )
    const client = new AdmissionQueueClient({
      baseUrl: 'http://localhost:6000/api',
      auth: createAuth(),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    const map = await createJetliApi(client).getGroupJaminanMap('BPJS')
    expect(map?.groupJaminanId).toBe('G1')
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain('tipeJaminanId=BPJS')
  })

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

  function jetliClient(data: unknown) {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ status: 'success', data }), { status: 200 }),
    )
    const client = new AdmissionQueueClient({
      baseUrl: 'http://localhost:6000/api',
      auth: createAuth(),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    return { fetchImpl, api: createJetliApi(client) }
  }

  it('lists existing SEPs by noPeserta', async () => {
    const { fetchImpl, api } = jetliClient([sepItem])
    const items = await api.getSepByNoPeserta('0001234567890')
    expect(items[0]?.sepNo).toBe('1104R0040322V000230')
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain('Sep/peserta/0001234567890')
  })

  it('fetches nullable SEP by regId', async () => {
    const { fetchImpl, api } = jetliClient(null)
    expect(await api.getSepByReg('RG1')).toBeNull()
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain('Sep/reg/RG1')
  })

  it('fetches fingerprint status and normalizes id', async () => {
    const { api } = jetliClient({ id: '1', status: 'Finger print tidak sesuai' })
    const fp = await api.getFingerprintStatus('0001234567890')
    expect(fp.id).toBe('1')
  })

  it('fetches peserta rujukan and SKDP list', async () => {
    const { fetchImpl, api } = jetliClient({
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
      rujukan: null,
      listSkdp: [],
    })
    const res = await api.getRujukanSkpd('0001234567890')
    expect(res.peserta.noPeserta).toBe('0001234567890')
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain('Sep/rujukan/0001234567890/peserta')
  })

  it('creates a SEP and tolerates a plain-string business error', async () => {
    const { fetchImpl, api } = jetliClient('Biometrik tidak ditemukan')
    const result = await api.createSep({ noPeserta: '0001234567890', userId: 'hidokkiosk' })
    expect(result).toBe('Biometrik tidak ditemukan')
    const url = String(fetchImpl.mock.calls[0]?.[0])
    expect(url).toContain('Sep')
    expect(fetchImpl.mock.calls[0]?.[1]?.method).toBe('POST')
  })

  it('uploads SEP via PATCH with sepId and regId', async () => {
    const { fetchImpl, api } = jetliClient({
      sepId: '01KFHYG1K5YZ5PZY2Y3SA5QJB3',
      sepNo: '1104R0040322V000230',
      regId: 'RG12345678',
    })
    const result = await api.uploadSep({
      sepId: '01KFHYG1K5YZ5PZY2Y3SA5QJB3',
      regId: 'RG12345678',
    })
    expect(result.regId).toBe('RG12345678')
    const url = String(fetchImpl.mock.calls[0]?.[0])
    expect(url).toContain('Sep/upload')
    expect(fetchImpl.mock.calls[0]?.[1]?.method).toBe('PATCH')
  })
})
