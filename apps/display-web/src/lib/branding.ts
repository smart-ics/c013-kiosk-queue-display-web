import { z } from 'zod'

export const brandingSchema = z.object({
  name: z.string().default('RS Sehat Sejahtera'),
  taglineId: z.string().default('Melayani dengan hati, sehat untuk negeri'),
  taglineEn: z.string().default('Serving with heart, healthy for the nation'),
  timeZoneLabel: z.string().default('WIB'),
})

export type Branding = z.infer<typeof brandingSchema>

export function parseBranding(raw: unknown): Branding {
  const block = raw && typeof raw === 'object' ? (raw as { branding?: unknown }).branding : undefined
  return brandingSchema.parse(block ?? {})
}

interface AdItem {
  type: 'video' | 'image'
  src: string
}

export interface DisplayLayout {
  orientation: 'landscape' | 'portrait'
  showWellnessTips: boolean
}

const DEFAULT_DISPLAY_LAYOUT: DisplayLayout = {
  orientation: 'landscape',
  showWellnessTips: true,
}

class BrandingService {
  private branding: Branding = brandingSchema.parse({})
  private hospitalServices: string[] = []
  private readonly adsPath = 'ads/'
  private ads: AdItem[] = []
  private displayLayout: DisplayLayout = { ...DEFAULT_DISPLAY_LAYOUT }

  async initialize(baseUrl: string = '/'): Promise<Branding> {
    const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
    this.branding = brandingSchema.parse({})
    this.hospitalServices = []
    this.ads = []
    this.displayLayout = { ...DEFAULT_DISPLAY_LAYOUT }
    try {
      const res = await fetch(`${base}global_config.json?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) return this.branding
      const data = await res.json()
      this.branding = parseBranding(data)
      if (data && typeof data === 'object') {
        if (Array.isArray(data.hospitalServices)) {
          this.hospitalServices = data.hospitalServices.map(String)
        }
        if (Array.isArray(data.ads)) {
          this.ads = (data.ads as unknown[])
            .map((item: unknown) => this.sanitizeAdItem(item))
            .filter((item): item is AdItem => item !== null)
        }
        this.displayLayout = this.parseDisplayLayout(data.displayLayout)
      }
    } catch {
      this.branding = brandingSchema.parse({})
    }
    return this.branding
  }

  private sanitizeAdItem(item: unknown): AdItem | null {
    if (!item || typeof item !== 'object') return null
    const raw = (item as Record<string, unknown>).src
    const rawType = (item as Record<string, unknown>).type
    if (typeof raw !== 'string') return null

    const value = raw.trim()
    if (
      !value ||
      /^[a-z][a-z0-9+.-]*:/i.test(value) ||
      value.startsWith('//') ||
      value.startsWith('/') ||
      value.includes('..') ||
      value.includes('\\')
    ) {
      return null
    }

    const basename = value.split('/').pop() ?? ''
    if (!basename) return null

    const ext = basename.split('.').pop()?.toLowerCase() ?? ''
    const videoExts = ['mp4', 'webm', 'ogg', 'mov']
    const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']

    let type: 'video' | 'image'
    if (rawType === 'video' || rawType === 'image') type = rawType
    else if (videoExts.includes(ext)) type = 'video'
    else if (imageExts.includes(ext)) type = 'image'
    else return null

    return { type, src: basename }
  }

  private parseDisplayLayout(raw: unknown): DisplayLayout {
    if (!raw || typeof raw !== 'object') return { ...DEFAULT_DISPLAY_LAYOUT }
    const block = raw as Record<string, unknown>
    const orientation =
      block.orientation === 'portrait' || block.orientation === 'landscape'
        ? block.orientation
        : DEFAULT_DISPLAY_LAYOUT.orientation
    const showWellnessTips =
      typeof block.showWellnessTips === 'boolean'
        ? block.showWellnessTips
        : orientation === 'landscape'
    return { orientation, showWellnessTips }
  }

  getBranding(): Branding {
    return this.branding
  }

  getHospitalServices(): string[] {
    return this.hospitalServices
  }

  getAdsPath(): string {
    return this.adsPath
  }

  getAds(): AdItem[] {
    return this.ads
  }

  getDisplayLayout(): DisplayLayout {
    return this.displayLayout
  }
}

export const brandingService = new BrandingService()
