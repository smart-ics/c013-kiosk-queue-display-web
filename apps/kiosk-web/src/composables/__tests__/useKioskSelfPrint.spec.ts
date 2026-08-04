import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { AdmissionQueueIntakeResponse } from '@aq/shared-types'
import { useKioskSelfPrint } from '../useKioskSelfPrint'
import type { PrintProxyClient, PrintProxyResult } from '../../lib/printProxy'

function makeTicket(label = 'B-001'): AdmissionQueueIntakeResponse {
  return { antrianId: 'B1', noUrut: 1, queueLabel: label, createdAt: '2026-08-03T08:00:00' }
}

describe('useKioskSelfPrint', () => {
  it('prints a registration receipt with doctype registrasi', async () => {
    const urls: string[] = []
    const printPng = vi.fn(async (_blob: Blob, doctype: string): Promise<PrintProxyResult> => {
      urls.push(doctype)
      return { success: true, jobId: 'j1', isNetworkError: false }
    })
    const createClient = (): PrintProxyClient =>
      ({ baseUrl: 'http://localhost:5050/print', checkHealth: async () => null, printPng }) as unknown as PrintProxyClient

    const print = useKioskSelfPrint({
      stationId: ref('K01'),
      createClient,
      renderRegistration: async () => new Blob(['png'], { type: 'image/png' }),
      renderTicket: async () => new Blob(['png'], { type: 'image/png' }),
    })

    const result = await print.printRegistration({
      result: { regId: 'R1', noAntrian: 12 },
      pasienName: 'Andi',
    })
    expect(result.printed).toBe(true)
    expect(urls).toEqual(['registrasi'])
    expect(print.printSucceeded.value).toBe(true)
  })

  it('prints a queue ticket with doctype antrian', async () => {
    const urls: string[] = []
    const printPng = vi.fn(async (_blob: Blob, doctype: string): Promise<PrintProxyResult> => {
      urls.push(doctype)
      return { success: true, jobId: 'j2', isNetworkError: false }
    })
    const createClient = (): PrintProxyClient =>
      ({ baseUrl: 'http://localhost:5050/print', checkHealth: async () => null, printPng }) as unknown as PrintProxyClient

    const print = useKioskSelfPrint({
      stationId: ref('K01'),
      createClient,
      renderRegistration: async () => new Blob(['png'], { type: 'image/png' }),
      renderTicket: async () => new Blob(['png'], { type: 'image/png' }),
    })

    const result = await print.printQueueTicket(makeTicket())
    expect(result.printed).toBe(true)
    expect(urls).toEqual(['antrian'])
  })
})
