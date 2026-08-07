import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getAdmissionQueueHubUrl } from '@/infrastructure'
import { configService } from '@aq/app-config'

const ORIGINAL_DEV = import.meta.env.DEV

beforeEach(() => {
  vi.spyOn(configService, 'getConfig').mockReturnValue({
    bilregApiBase: 'http://dev.smart-ics.com:8888/bilregapi/api',
  })
})

afterEach(() => {
  ;(import.meta.env as Record<string, string | boolean>).DEV = ORIGINAL_DEV
  vi.restoreAllMocks()
})

describe('getAdmissionQueueHubUrl', () => {
  it('returns a same-origin relative path in dev so the Vite proxy avoids CORS preflight', () => {
    ;(import.meta.env as Record<string, string | boolean>).DEV = true

    expect(getAdmissionQueueHubUrl()).toBe('/hubs/admission-queue')
  })

  it('returns the absolute hub URL in production builds (backend CORS is authoritative)', () => {
    ;(import.meta.env as Record<string, string | boolean>).DEV = false

    expect(getAdmissionQueueHubUrl()).toBe(
      'http://dev.smart-ics.com:8888/bilregapi/hubs/admission-queue',
    )
  })

  it('throws when bilregApiBase is missing', () => {
    ;(import.meta.env as Record<string, string | boolean>).DEV = false
    vi.spyOn(configService, 'getConfig').mockReturnValue({
      bilregApiBase: '',
    })

    expect(() => getAdmissionQueueHubUrl()).toThrow('bilregApiBase is not configured in global_config.json')
  })
})
