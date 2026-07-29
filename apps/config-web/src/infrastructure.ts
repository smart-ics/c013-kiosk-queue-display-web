import {
  AdmissionQueueClient,
  createAdmissionQueueApi,
  createConfigurationApi,
  loginBilreg,
} from '@aq/api-client'
import { SessionAuthTokenProvider } from '@aq/auth'
import type { LoginRequest, LoginResponse } from '@aq/shared-types'

let sessionAuth: SessionAuthTokenProvider | null = null
let client: AdmissionQueueClient | null = null
let configurationApi: ReturnType<typeof createConfigurationApi> | null = null
let admissionQueueApi: ReturnType<typeof createAdmissionQueueApi> | null = null

export function getSessionAuth(): SessionAuthTokenProvider {
  if (!sessionAuth) sessionAuth = new SessionAuthTokenProvider()
  return sessionAuth
}

export function getApiBase(): string {
  const baseUrl = import.meta.env.VITE_BILREG_API_BASE?.trim()
  if (!baseUrl) throw new Error('VITE_BILREG_API_BASE is not configured')
  return baseUrl
}

export function getPublicOrigin(): string {
  const configured = import.meta.env.VITE_PUBLIC_ORIGIN?.trim()
  if (configured) return configured.replace(/\/+$/, '')
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

export function getConfigurationApi() {
  if (!configurationApi) {
    client = new AdmissionQueueClient({
      baseUrl: getApiBase(),
      auth: getSessionAuth(),
    })
    configurationApi = createConfigurationApi(client)
  }
  return configurationApi
}

export function getAdmissionQueueApi() {
  if (!admissionQueueApi) {
    client = new AdmissionQueueClient({
      baseUrl: getApiBase(),
      auth: getSessionAuth(),
    })
    admissionQueueApi = createAdmissionQueueApi(client)
  }
  return admissionQueueApi
}

export async function login(request: LoginRequest): Promise<LoginResponse> {
  const response = await loginBilreg(getApiBase(), request)
  getSessionAuth().setToken(response.tokenAuth)
  return response
}

export function logout(): void {
  getSessionAuth().clear()
}

export function buildCanonicalDisplayUrl(displayId: string): string {
  return `${getPublicOrigin()}/display/${encodeURIComponent(displayId)}`
}

export function buildPreviewDisplayUrl(displayId: string): string {
  return `${buildCanonicalDisplayUrl(displayId)}?preview=1`
}

export function buildCanonicalKioskUrl(stationId: string): string {
  return `${getPublicOrigin()}/kiosk/${encodeURIComponent(stationId)}`
}

export function buildPreviewKioskUrl(stationId: string): string {
  return buildCanonicalKioskUrl(stationId)
}

export function __resetConfigInfrastructureForTests(): void {
  sessionAuth = null
  client = null
  configurationApi = null
  admissionQueueApi = null
}
