import { z } from 'zod'

export const appConfigSchema = z.object({
  bilregApiBase: z.string().min(1, 'bilregApiBase must not be empty'),
  jetliApiBase: z.string().optional(),
  mediaInfoDir: z.string().optional(),
})

export type AppConfig = z.infer<typeof appConfigSchema>

class ConfigService {
  private config: AppConfig | null = null

  async initialize(baseUrl: string = '/'): Promise<AppConfig> {
    // Determine the base path robustly, using Vite's import.meta.env.BASE_URL if provided
    const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
    
    // Add cache buster to prevent browsers from caching old configs
    const res = await fetch(`${base}global_config.json?t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Accept': 'application/json',
      }
    })
    
    if (!res.ok) {
      throw new Error(`Failed to load global_config.json: ${res.status} ${res.statusText}`)
    }
    
    const data = await res.json()
    const parsed = appConfigSchema.safeParse(data)
    
    if (!parsed.success) {
      throw new Error(`Invalid global_config.json: ${parsed.error.message}`)
    }
    
    this.config = parsed.data
    return this.config
  }

  getConfig(): AppConfig {
    if (!this.config) {
      throw new Error('ConfigService has not been initialized. Call initialize() first.')
    }
    return this.config
  }
}

export const configService = new ConfigService()
