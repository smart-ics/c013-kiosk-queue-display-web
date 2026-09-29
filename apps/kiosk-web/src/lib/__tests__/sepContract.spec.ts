import { afterEach, describe, expect, it, vi } from 'vitest'
import { ZodError } from 'zod'
import { sepCreateBodySchema } from '@aq/shared-types'
import { SepDateContractError } from '../sepDate'
import { reportSepContractFailure, SEP_CONTRACT_FAILURE_LOG_PREFIX } from '../sepContract'

afterEach(() => {
  vi.restoreAllMocks()
})

function zodSepDateError(): ZodError {
  try {
    sepCreateBodySchema.parse({ noPeserta: '0001234567890', sepDate: '2026-08-03' })
  } catch (error) {
    return error as ZodError
  }
  throw new Error('expected the shared client contract to reject the payload')
}

describe('reportSepContractFailure', () => {
  it('names the sepDate field for a composer contract failure', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(reportSepContractFailure(new SepDateContractError('sepDate source is malformed'))).toBe(
      true,
    )
    expect(warn).toHaveBeenCalledTimes(1)
    const message = String(warn.mock.calls[0][0])
    expect(message).toContain(SEP_CONTRACT_FAILURE_LOG_PREFIX)
    expect(message).toContain('field=sepDate')
    expect(message).not.toContain('2026-08-03')
  })

  it('names the sepDate field when the shared client contract rejects the payload', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(reportSepContractFailure(zodSepDateError())).toBe(true)
    const message = String(warn.mock.calls[0][0])
    expect(message).toContain('field=sepDate')
    expect(message).not.toContain('0001234567890')
  })

  it('does not report or log a service or transport error', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(reportSepContractFailure(new Error('Gagal membuat SEP: SEP sudah ada'))).toBe(false)
    expect(reportSepContractFailure('a string failure')).toBe(false)
    expect(warn).not.toHaveBeenCalled()
  })
})
