import { loginBilreg } from '@aq/api-client'
import { configService } from '@aq/app-config'

const KIOSK_EMAIL = 'kiosk@smart-ics.com'
const KIOSK_PASSWORD = '0rch1d'
const KIOSK_APP_ID = 'Bilreg'
export const LOGIN_RETRIES = 5
export const LOGIN_RETRY_DELAY_MS = 3000

let kioskToken: string | null = null

export function getKioskToken(): string {
  if (!kioskToken) throw new Error('Kiosk login has not completed')
  return kioskToken
}

export function __resetKioskLoginForTests(): void {
  kioskToken = null
}

export type KioskLoginOptions = {
  baseUrl?: string
  login?: typeof loginBilreg
  delay?: (ms: number) => Promise<void>
}

export async function kioskLogin(options: KioskLoginOptions = {}): Promise<void> {
  const baseUrl = options.baseUrl ?? configService.getConfig().bilregApiBase
  if (!baseUrl) throw new Error('bilregApiBase is not configured in global_config.json')
  const login = options.login ?? loginBilreg
  const delay = options.delay ?? sleep
  let lastError: unknown
  for (let attempt = 0; attempt < LOGIN_RETRIES; attempt++) {
    try {
      const response = await login(baseUrl, {
        email: KIOSK_EMAIL,
        pass: KIOSK_PASSWORD,
        appId: KIOSK_APP_ID,
      })
      kioskToken = response.tokenAuth
      return
    } catch (error) {
      lastError = error
      if (attempt < LOGIN_RETRIES - 1) await delay(LOGIN_RETRY_DELAY_MS)
    }
  }
  throw lastError
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
