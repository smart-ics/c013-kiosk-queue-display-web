import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { AdmissionQueueIntakeResponse, AdmissionServicePoint } from '@aq/shared-types'
import { useKioskPrint } from '../useKioskPrint'
import type { PrintProxyClient, PrintProxyResult } from '../../lib/printProxy'

const offerings = ref<AdmissionServicePoint[]>([
  {
    servicePointId: 'REG',
    displayName: 'Registrasi',
    queuePrefix: 'A',
    status: 'Active',
  },
])

function makeResult(label = 'A0001'): AdmissionQueueIntakeResponse {
  return {
    antrianId: 'Q1',
    noUrut: 1,
    queueLabel: label,
    createdAt: new Date().toISOString(),
  }
}

describe('useKioskPrint reprint safety', () => {
  it('reprints the committed label without clearing result on failure', async () => {
    const result = ref<AdmissionQueueIntakeResponse | null>(makeResult('A0042'))
    const stationId = ref('loket-03')
    const labelsPrinted: string[] = []

    const printPng = vi.fn(async (): Promise<PrintProxyResult> => ({
      success: false,
      error: 'No printer detected',
      isNetworkError: false,
    }))

    const createClient = (): PrintProxyClient =>
      ({
        baseUrl: 'http://localhost:5050/print',
        checkHealth: async () => null,
        printPng,
      }) as PrintProxyClient

    const print = useKioskPrint({
      stationId,
      result,
      offerings,
      createClient,
      renderTicket: async (data) => {
        labelsPrinted.push(data.queueLabel)
        return new Blob(['png'], { type: 'image/png' })
      },
    })

    const first = await print.printCommittedLabel('REG')
    expect(first).toBe(false)
    expect(result.value?.queueLabel).toBe('A0042')
    expect(print.printError.value).toBe('No printer detected')
    expect(labelsPrinted).toEqual(['A0042'])

    printPng.mockResolvedValueOnce({ success: true, jobId: 'j2', isNetworkError: false })
    const second = await print.printCommittedLabel('REG')
    expect(second).toBe(true)
    expect(result.value?.queueLabel).toBe('A0042')
    expect(labelsPrinted).toEqual(['A0042', 'A0042'])
    expect(print.lastPrintedLabel.value).toBe('A0042')
  })

  it('ignores concurrent print while pending', async () => {
    const result = ref<AdmissionQueueIntakeResponse | null>(makeResult())
    let resolvePrint!: (value: PrintProxyResult) => void
    const printPromise = new Promise<PrintProxyResult>((resolve) => {
      resolvePrint = resolve
    })

    let calls = 0
    const createClient = (): PrintProxyClient =>
      ({
        baseUrl: 'http://localhost:5050/print',
        checkHealth: async () => null,
        printPng: async () => {
          calls += 1
          return printPromise
        },
      }) as PrintProxyClient

    const print = useKioskPrint({
      stationId: ref('loket-03'),
      result,
      offerings,
      createClient,
      renderTicket: async () => new Blob(['png'], { type: 'image/png' }),
    })

    const first = print.printCommittedLabel('REG')
    const second = print.printCommittedLabel('REG')
    expect(print.printPending.value).toBe(true)

    resolvePrint({ success: true, jobId: 'j1', isNetworkError: false })
    await Promise.all([first, second])

    expect(calls).toBe(1)
    expect(result.value?.queueLabel).toBe('A0001')
  })
})
