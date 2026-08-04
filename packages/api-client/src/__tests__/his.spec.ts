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
})
