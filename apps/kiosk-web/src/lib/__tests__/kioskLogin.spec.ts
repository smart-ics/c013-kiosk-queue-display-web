import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loginBilreg } from '@aq/api-client'
import {
  getKioskToken,
  kioskLogin,
  LOGIN_RETRIES,
  __resetKioskLoginForTests,
} from '../kioskLogin'

const response = {
  pegId: 'p1',
  userName: 'Kiosk',
  userLogin: 'kiosk@smart-ics.com',
  email: 'kiosk@smart-ics.com',
  expiredDate: '2026-08-06',
  tokenAuth: 'jwt-token',
  listRole: [{ role: 'kiosk' }],
}

describe('kioskLogin', () => {
  beforeEach(() => {
    __resetKioskLoginForTests()
  })

  it('stores the tokenAuth from a successful login', async () => {
    const login = vi.fn(async () => response) as typeof loginBilreg
    await kioskLogin({ baseUrl: 'http://localhost:5000/api', login })
    expect(getKioskToken()).toBe('jwt-token')
    expect(login).toHaveBeenCalledWith('http://localhost:5000/api', {
      email: 'kiosk@smart-ics.com',
      pass: '0rch1d',
      appId: 'Bilreg',
    })
  })

  it('retries after transient failures before succeeding', async () => {
    const login = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(response) as typeof loginBilreg
    const delay = vi.fn(async () => {})
    await kioskLogin({ baseUrl: 'http://localhost:5000/api', login, delay })
    expect(login).toHaveBeenCalledTimes(3)
    expect(getKioskToken()).toBe('jwt-token')
    expect(delay).toHaveBeenCalledTimes(2)
  })

  it('throws after exhausting all retries', async () => {
    const login = vi.fn(async () => {
      throw new Error('boom')
    }) as typeof loginBilreg
    const delay = vi.fn(async () => {})
    await expect(
      kioskLogin({ baseUrl: 'http://localhost:5000/api', login, delay }),
    ).rejects.toThrow('boom')
    expect(login).toHaveBeenCalledTimes(LOGIN_RETRIES)
    expect(getKioskToken).toThrow()
  })

  it('throws when baseUrl is not configured', async () => {
    const login = vi.fn(async () => response) as typeof loginBilreg
    await expect(
      kioskLogin({ baseUrl: '', login }),
    ).rejects.toThrow('bilregApiBase is not configured')
    expect(login).not.toHaveBeenCalled()
  })
})
