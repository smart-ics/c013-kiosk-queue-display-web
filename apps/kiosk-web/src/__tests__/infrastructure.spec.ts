import { beforeEach, describe, expect, it, vi } from 'vitest'
import { configService } from '@aq/app-config'
import { createJetliApi } from '@aq/api-client'
import { getJetliApi, __resetInfrastructureForTests } from '../infrastructure'

vi.mock('@aq/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@aq/api-client')>()
  return {
    ...actual,
    createJetliApi: vi.fn(() => ({})),
  }
})

vi.mock('@aq/app-config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@aq/app-config')>()
  return {
    ...actual,
    configService: { getConfig: vi.fn() },
  }
})

const createJetliApiMock = vi.mocked(createJetliApi)
const getConfigMock = vi.mocked(configService.getConfig)

describe('getJetliApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __resetInfrastructureForTests()
  })

  it('points the Jetli API client at jetliApiBase', () => {
    getConfigMock.mockReturnValue({
      bilregApiBase: 'http://bilreg/api',
      jetliApiBase: 'http://jetli/api',
    })
    getJetliApi()
    const client = createJetliApiMock.mock.calls[0][0] as unknown as { baseUrl: string }
    expect(client.baseUrl).toBe('http://jetli/api')
  })

  it('throws when jetliApiBase is missing instead of falling back to bilregApiBase', () => {
    getConfigMock.mockReturnValue({ bilregApiBase: 'http://bilreg/api' })
    expect(() => getJetliApi()).toThrow('jetliApiBase is not configured in global_config.json')
    expect(createJetliApiMock).not.toHaveBeenCalled()
  })
})
