import { afterEach, describe, expect, it, vi } from 'vitest'
import { brandingSchema, brandingService, parseBranding } from '../branding'

describe('display branding', () => {
  it('applies defaults when branding block is missing', () => {
    const branding = parseBranding({ bilregApiBase: 'http://localhost:5000/api' })
    expect(branding).toEqual({
      name: 'RS Sehat Sejahtera',
      taglineId: 'Melayani dengan hati, sehat untuk negeri',
      taglineEn: 'Serving with heart, healthy for the nation',
      timeZoneLabel: 'WIB',
    })
  })

  it('overrides defaults from the branding block', () => {
    const branding = parseBranding({ branding: { name: 'RS Cinta Kasih' } })
    expect(branding.name).toBe('RS Cinta Kasih')
    expect(branding.taglineId).toBe('Melayani dengan hati, sehat untuk negeri')
  })

  it('parses partial branding with the schema', () => {
    expect(brandingSchema.parse({ taglineId: 'X' }).name).toBe('RS Sehat Sejahtera')
  })
})

describe('display brandingService.initialize', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('loads branding from global_config.json', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ branding: { name: 'RS Bahagia' } }),
    } as Response)
    const branding = await brandingService.initialize('/')
    expect(branding.name).toBe('RS Bahagia')
  })

  it('keeps defaults on fetch failure', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network'))
    const branding = await brandingService.initialize('/')
    expect(branding.name).toBe('RS Sehat Sejahtera')
  })
})
