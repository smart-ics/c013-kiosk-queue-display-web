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
    expect(brandingService.getHospitalServices()).toEqual([])
    expect(brandingService.getAds()).toEqual([])
  })

  it('loads hospitalServices from global_config.json', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        branding: { name: 'RS Bahagia' },
        hospitalServices: ['Layanan 1', 'Layanan 2'],
      }),
    } as Response)
    await brandingService.initialize('/')
    expect(brandingService.getHospitalServices()).toEqual(['Layanan 1', 'Layanan 2'])
  })

  it('loads ads from global_config.json with video type inferred from extension', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        branding: { name: 'RS Bahagia' },
        ads: [{ src: 'promo1.mp4' }, { src: 'banner.png' }],
      }),
    } as Response)
    await brandingService.initialize('/')
    expect(brandingService.getAds()).toEqual([
      { type: 'video', src: 'promo1.mp4' },
      { type: 'image', src: 'banner.png' },
    ])
  })

  it('loads ads with explicit type from global_config.json', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        branding: { name: 'RS Bahagia' },
        ads: [{ src: 'custom.webm', type: 'video' }, { src: 'logo.svg', type: 'image' }],
      }),
    } as Response)
    await brandingService.initialize('/')
    expect(brandingService.getAds()).toEqual([
      { type: 'video', src: 'custom.webm' },
      { type: 'image', src: 'logo.svg' },
    ])
  })

  it('rejects videoPath from config and only allows ads array', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        branding: { name: 'RS Bahagia' },
        videoPath: 'outside-video/video.mp4',
        ads: [{ src: 'promo1.mp4' }],
      }),
    } as Response)
    await brandingService.initialize('/')
    expect(brandingService.getAds()).toEqual([{ type: 'video', src: 'promo1.mp4' }])
  })

  it('strips directory paths from ad src to enforce ads/ only', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        branding: { name: 'RS Bahagia' },
        ads: [{ src: 'subdir/promo.mp4' }, { src: 'video/evil/evil.mp4' }],
      }),
    } as Response)
    await brandingService.initialize('/')
    expect(brandingService.getAds()).toEqual([
      { type: 'video', src: 'promo.mp4' },
      { type: 'video', src: 'evil.mp4' },
    ])
  })

  it('rejects absolute URLs and schemes in ad src', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        branding: { name: 'RS Bahagia' },
        ads: [
          { src: 'http://evil.com/video.mp4' },
          { src: 'https://attacker.com/img.png' },
          { src: '//cdn.example.com/file.mp4' },
          { src: '/absolute/path.mp4' },
          { src: 'data:text/html,<script>alert(1)</script>' },
        ],
      }),
    } as Response)
    await brandingService.initialize('/')
    expect(brandingService.getAds()).toEqual([])
  })

  it('rejects items with .. or \\ in src', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        branding: { name: 'RS Bahagia' },
        ads: [{ src: 'video\\../etc/passwd.mp4' }, { src: '..\\..\\evil.gif' }],
      }),
    } as Response)
    await brandingService.initialize('/')
    expect(brandingService.getAds()).toEqual([])
  })

  it('rejects items with unsupported extensions', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        branding: { name: 'RS Bahagia' },
        ads: [{ src: 'document.pdf' }, { src: 'script.js' }, { src: 'unknown.xyz' }],
      }),
    } as Response)
    await brandingService.initialize('/')
    expect(brandingService.getAds()).toEqual([])
  })

  it('rejects invalid ad items', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        branding: { name: 'RS Bahagia' },
        ads: [null, undefined, 'string', { type: 'video' }, 123],
      }),
    } as Response)
    await brandingService.initialize('/')
    expect(brandingService.getAds()).toEqual([])
  })

  it('returns correct ads path', () => {
    expect(brandingService.getAdsPath()).toBe('ads/')
  })

  it('defaults displayLayout to landscape with tips when block is missing', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ branding: { name: 'RS Bahagia' } }),
    } as Response)
    await brandingService.initialize('/')
    expect(brandingService.getDisplayLayout()).toEqual({
      orientation: 'landscape',
      showWellnessTips: true,
    })
  })

  it('applies portrait orientation and hides tips by default', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ displayLayout: { orientation: 'portrait' } }),
    } as Response)
    await brandingService.initialize('/')
    expect(brandingService.getDisplayLayout()).toEqual({
      orientation: 'portrait',
      showWellnessTips: false,
    })
  })

  it('allows explicit showWellnessTips override', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        displayLayout: { orientation: 'portrait', showWellnessTips: true },
      }),
    } as Response)
    await brandingService.initialize('/')
    expect(brandingService.getDisplayLayout()).toEqual({
      orientation: 'portrait',
      showWellnessTips: true,
    })
  })

  it('falls back to landscape for invalid orientation', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ displayLayout: { orientation: 'diagonal' } }),
    } as Response)
    await brandingService.initialize('/')
    expect(brandingService.getDisplayLayout()).toEqual({
      orientation: 'landscape',
      showWellnessTips: true,
    })
  })

  it('resets displayLayout on fetch failure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ displayLayout: { orientation: 'portrait' } }),
    } as Response)
    await brandingService.initialize('/')
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network'))
    await brandingService.initialize('/')
    expect(brandingService.getDisplayLayout()).toEqual({
      orientation: 'landscape',
      showWellnessTips: true,
    })
  })
})