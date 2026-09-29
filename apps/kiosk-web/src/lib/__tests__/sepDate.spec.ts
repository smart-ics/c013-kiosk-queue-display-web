import { describe, expect, it } from 'vitest'
import { composeSepDate, SEP_DATE_TIME_PATTERN, SepDateContractError } from '../sepDate'

function localClock(
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
  seconds: number,
): number {
  return new Date(year, month, day, hours, minutes, seconds, 0).getTime()
}

describe('composeSepDate', () => {
  it('composes business date with the host clock time', () => {
    const value = composeSepDate('2026-09-28', localClock(2026, 8, 28, 14, 35, 12))
    expect(value).toBe('2026-09-28 14:35:12')
  })

  it('keeps the seconds component of the contract pattern', () => {
    const value = composeSepDate('2026-09-28', localClock(2026, 8, 28, 9, 8, 7))
    expect(SEP_DATE_TIME_PATTERN.test(value)).toBe(true)
    expect(value).toBe('2026-09-28 09:08:07')
  })

  it('emits 00:00:00 without normalising or flooring the value', () => {
    const value = composeSepDate('2026-01-01', localClock(2026, 0, 1, 0, 0, 0))
    expect(value).toBe('2026-01-01 00:00:00')
  })

  it('zero-pads single-digit month, day, hours, minutes and seconds', () => {
    const value = composeSepDate('2026-03-07', localClock(2026, 2, 7, 6, 5, 4))
    expect(value).toBe('2026-03-07 06:05:04')
  })

  it('composes a leap day business date', () => {
    const value = composeSepDate('2024-02-29', localClock(2026, 8, 28, 23, 59, 59))
    expect(value).toBe('2024-02-29 23:59:59')
  })

  it('keeps the business date when it differs from the clock date', () => {
    const value = composeSepDate('2025-12-31', localClock(2026, 8, 28, 10, 15, 30))
    expect(value).toBe('2025-12-31 10:15:30')
  })

  it('takes the time from the clock date when the business date is far ahead', () => {
    const value = composeSepDate('2027-06-30', localClock(2026, 0, 1, 1, 2, 3))
    expect(value).toBe('2027-06-30 01:02:03')
  })

  it('is deterministic for repeated calls with the same arguments', () => {
    const clock = localClock(2026, 8, 28, 18, 45, 1)
    expect(composeSepDate('2026-09-28', clock)).toBe(composeSepDate('2026-09-28', clock))
  })

  it.each([
    ['date-only with slashes', '2026/09/28'],
    ['single-digit month and day', '2026-9-8'],
    ['a full date-time', '2026-09-28 14:35:12'],
    ['an ISO T separator', '2026-09-28T14:35:12'],
    ['an empty string', ''],
    ['free text', 'today'],
  ])('rejects a malformed business date: %s', (_label, businessDate) => {
    const clock = localClock(2026, 8, 28, 14, 35, 12)
    expect(() => composeSepDate(businessDate, clock)).toThrow(SepDateContractError)
    expect(() => composeSepDate(businessDate, clock)).toThrow(/must be yyyy-MM-dd/)
  })

  it('does not repair a business date that carries a time component', () => {
    const clock = localClock(2026, 8, 28, 14, 35, 12)
    expect(() => composeSepDate('2026-09-28T00:00:00', clock)).toThrow(SepDateContractError)
  })

  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['a non-numeric value', '1756445712000' as unknown as number],
  ])('rejects an invalid clock timestamp: %s', (_label, clock) => {
    expect(() => composeSepDate('2026-09-28', clock)).toThrow(SepDateContractError)
  })

  it('identifies the offending contract field on the error', () => {
    const clock = localClock(2026, 8, 28, 14, 35, 12)
    try {
      composeSepDate('28-09-2026', clock)
      expect.unreachable('expected a contract failure')
    } catch (error) {
      expect(error).toBeInstanceOf(SepDateContractError)
      expect((error as SepDateContractError).field).toBe('sepDate')
    }
  })
})
