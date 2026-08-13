import { z } from 'zod'

export const brandingSchema = z.object({
  name: z.string().default('RS Sehat Waluyo'),
  subTag: z.string().default('Sistem Antrian Admission'),
})

export type Branding = z.infer<typeof brandingSchema>

export function parseBranding(raw: unknown): Branding {
  const block = raw && typeof raw === 'object' ? (raw as { branding?: unknown }).branding : undefined
  return brandingSchema.parse(block ?? {})
}

class BrandingService {
  private branding: Branding = brandingSchema.parse({})

  async initialize(baseUrl: string = '/'): Promise<Branding> {
    const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
    this.branding = brandingSchema.parse({})
    try {
      const res = await fetch(`${base}global_config.json?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) return this.branding
      const data = await res.json()
      this.branding = parseBranding(data)
    } catch {
      this.branding = brandingSchema.parse({})
    }
    return this.branding
  }

  getBranding(): Branding {
    return this.branding
  }
}

export const brandingService = new BrandingService()
