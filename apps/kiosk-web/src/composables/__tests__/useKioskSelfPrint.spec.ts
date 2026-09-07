import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { AdmissionQueueIntakeResponse } from '@aq/shared-types'
import { useKioskSelfPrint } from '../useKioskSelfPrint'
import type { PrintProxyClient, PrintProxyResult } from '../../lib/printProxy'

function makeTicket(label = 'B-001'): AdmissionQueueIntakeResponse {
  return { antrianId: 'B1', noUrut: 1, queueLabel: label, createdAt: '2026-08-03T08:00:00' }
}

describe('useKioskSelfPrint', () => {
  it('prints a registration receipt with doctype antrian', async () => {
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
    expect(urls).toEqual(['antrian'])
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

  it('prints a patient label with doctype label_mr', async () => {
    const urls: string[] = []
    const printPng = vi.fn(async (_blob: Blob, doctype: string): Promise<PrintProxyResult> => {
      urls.push(doctype)
      return { success: true, jobId: 'j3', isNetworkError: false }
    })
    const createClient = (): PrintProxyClient =>
      ({ baseUrl: 'http://localhost:5050/print', checkHealth: async () => null, printPng }) as unknown as PrintProxyClient

    const print = useKioskSelfPrint({
      stationId: ref('K01'),
      createClient,
      renderLabel: async () => new Blob(['png'], { type: 'image/png' }),
    })

    const result = await print.printPatientLabel({
      result: { regId: 'RG01069593', noAntrian: 12 },
      pasienName: 'SUGIARTO, TN',
      pasienId: '00-12-34-56',
      umur: '45 Thn',
      tglLahir: '15-08-1981',
    })
    expect(result.printed).toBe(true)
    expect(urls).toEqual(['label_mr'])
    expect(print.printSucceeded.value).toBe(true)
  })

  it('surfaces printError when a registration print is already pending', async () => {
    let resolveRender!: (v: Blob) => void
    const pendingRender = new Promise<Blob>((resolve) => {
      resolveRender = resolve
    })
    const print = useKioskSelfPrint({
      stationId: ref('K01'),
      createClient: (): PrintProxyClient =>
        ({
          baseUrl: 'http://localhost:5050/print',
          checkHealth: async () => null,
          printPng: vi.fn(async () => ({ success: true, jobId: 'j1', isNetworkError: false })),
        }) as unknown as PrintProxyClient,
      renderRegistration: () => pendingRender,
      renderTicket: async () => new Blob(['png'], { type: 'image/png' }),
    })

    const first = print.printRegistration({
      result: { regId: 'R1', noAntrian: 12 },
      pasienName: 'Andi',
    })
    const second = await print.printRegistration({
      result: { regId: 'R1', noAntrian: 12 },
      pasienName: 'Andi',
    })
    expect(second.printed).toBe(false)
    expect(second.error).toBe('Cetak sedang berlangsung.')
    expect(print.printError.value).toBe('Cetak sedang berlangsung.')
    resolveRender(new Blob(['png'], { type: 'image/png' }))
    await first
  })

  it('surfaces printError when a queue-ticket print is already pending', async () => {
    let resolveRender!: (v: Blob) => void
    const pendingRender = new Promise<Blob>((resolve) => {
      resolveRender = resolve
    })
    const print = useKioskSelfPrint({
      stationId: ref('K01'),
      createClient: (): PrintProxyClient =>
        ({
          baseUrl: 'http://localhost:5050/print',
          checkHealth: async () => null,
          printPng: vi.fn(async () => ({ success: true, jobId: 'j1', isNetworkError: false })),
        }) as unknown as PrintProxyClient,
      renderRegistration: async () => new Blob(['png'], { type: 'image/png' }),
      renderTicket: () => pendingRender,
    })

    const first = print.printQueueTicket(makeTicket())
    const second = await print.printQueueTicket(makeTicket())
    expect(second.printed).toBe(false)
    expect(second.error).toBe('Cetak sedang berlangsung.')
    expect(print.printError.value).toBe('Cetak sedang berlangsung.')
    resolveRender(new Blob(['png'], { type: 'image/png' }))
    await first
  })
})
