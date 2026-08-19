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

class BrandingService {
  private branding: Branding = brandingSchema.parse({})
  private hospitalServices: string[] = []
  private videoPath: string = 'video/movie.mp4'

  async initialize(baseUrl: string = '/'): Promise<Branding> {
    const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
    this.branding = brandingSchema.parse({})
    this.hospitalServices = []
    this.videoPath = 'video/movie.mp4'
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
        if (typeof data.videoPath === 'string' && data.videoPath.trim()) {
          this.videoPath = data.videoPath.trim()
        }
      }
    } catch {
      this.branding = brandingSchema.parse({})
    }
    return this.branding
  }

  getBranding(): Branding {
    return this.branding
  }

  getHospitalServices(): string[] {
    return this.hospitalServices
  }

  getVideoPath(): string {
    return this.videoPath
  }
}

export const brandingService = new BrandingService()
