import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import type { AdmissionServicePoint } from '@aq/shared-types'
import { useKioskIntake } from '../useKioskIntake'

const offerings = ref<AdmissionServicePoint[]>([
  {
    servicePointId: 'REG',
    displayName: 'Registrasi',
    queuePrefix: 'A',
    status: 'Active',
  },
])

describe('useKioskIntake pending lock', () => {
  it('ignores concurrent submit while pending', async () => {
    let resolveIntake!: (value: {
      antrianId: string
      noUrut: number
      queueLabel: string
      createdAt: string
    }) => void

    const intakePromise = new Promise<{
      antrianId: string
      noUrut: number
      queueLabel: string
      createdAt: string
    }>((resolve) => {
      resolveIntake = resolve
    })

    const calls: string[] = []
    const intake = useKioskIntake(offerings, async (servicePointId) => {
      calls.push(servicePointId)
      return intakePromise
    })

    const first = intake.submitIntake('REG')
    const second = intake.submitIntake('REG')
    expect(intake.pending.value).toBe(true)

    resolveIntake({
      antrianId: 'Q1',
      noUrut: 1,
      queueLabel: 'A0001',
      createdAt: new Date().toISOString(),
    })
    await Promise.all([first, second])

    expect(calls).toHaveLength(1)
    expect(intake.result.value?.queueLabel).toBe('A0001')
    expect(intake.pending.value).toBe(false)
  })
})
