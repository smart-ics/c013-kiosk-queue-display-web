import { afterEach, describe, expect, it, vi } from 'vitest'
import { getAdmissionQueueHubUrl } from '@/infrastructure'

const ORIGINAL_DEV = import.meta.env.DEV
const ORIGINAL_BASE = import.meta.env.VITE_BILREG_API_BASE

afterEach(() => {
  ;(import.meta.env as Record<string, string | boolean>).DEV = ORIGINAL_DEV
  ;(import.meta.env as Record<string, string | boolean>).VITE_BILREG_API_BASE = ORIGINAL_BASE
  vi.restoreAllMocks()
})

describe('getAdmissionQueueHubUrl', () => {
  it('returns a same-origin relative path in dev so the Vite proxy avoids CORS preflight', () => {
    ;(import.meta.env as Record<string, string | boolean>).DEV = true
    ;(import.meta.env as Record<string, string | boolean>).VITE_BILREG_API_BASE =
      'http://dev.smart-ics.com:8888/bilregapi/api'

    expect(getAdmissionQueueHubUrl()).toBe('/hubs/admission-queue')
  })

  it('returns the absolute hub URL in production builds (backend CORS is authoritative)', () => {
    ;(import.meta.env as Record<string, string | boolean>).DEV = false
    ;(import.meta.env as Record<string, string | boolean>).VITE_BILREG_API_BASE =
      'http://dev.smart-ics.com:8888/bilregapi/api'

    expect(getAdmissionQueueHubUrl()).toBe(
      'http://dev.smart-ics.com:8888/bilregapi/hubs/admission-queue',
    )
  })

  it('throws when VITE_BILREG_API_BASE is missing', () => {
    ;(import.meta.env as Record<string, string | boolean>).DEV = false
    ;(import.meta.env as Record<string, string | boolean>).VITE_BILREG_API_BASE = ''

    expect(() => getAdmissionQueueHubUrl()).toThrow('VITE_BILREG_API_BASE is not configured')
  })
})

describe('getAuthTokenProvider', () => {
  it('returns an AutoLoginAuthTokenProvider', async () => {
    ;(import.meta.env as Record<string, string | boolean>).VITE_BILREG_API_BASE =
      'http://localhost:5000/api'
    const { getAuthTokenProvider, __resetInfrastructureForTests } = await import(
      '@/infrastructure'
    )
    __resetInfrastructureForTests()
    const { AutoLoginAuthTokenProvider } = await import('@aq/auth')
    const provider = getAuthTokenProvider()
    expect(provider).toBeInstanceOf(AutoLoginAuthTokenProvider)
  })
})
