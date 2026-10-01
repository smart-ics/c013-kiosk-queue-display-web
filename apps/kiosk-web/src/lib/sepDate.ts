const BUSINESS_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export const SEP_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/

export class SepDateContractError extends Error {
  readonly field = 'sepDate'

  constructor(message: string) {
    super(message)
    this.name = 'SepDateContractError'
  }
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * Composes the `POST /sep` `sepDate` value per ARCHITECTURE TD-008: the date part
 * comes from the HIS business date, the time part from the kiosk host clock. The
 * clock is always supplied by the caller, so the composition is pure and
 * deterministic under test. A business date that is not `yyyy-MM-dd` is a contract
 * failure and is never silently repaired.
 */
export function composeSepDate(businessDate: string, clock: number): string {
  if (typeof businessDate !== 'string' || !BUSINESS_DATE_PATTERN.test(businessDate)) {
    throw new SepDateContractError('sepDate source business date must be yyyy-MM-dd')
  }
  if (typeof clock !== 'number' || !Number.isFinite(clock)) {
    throw new SepDateContractError('sepDate source clock must be a finite timestamp')
  }
  const at = new Date(clock)
  if (Number.isNaN(at.getTime())) {
    throw new SepDateContractError('sepDate source clock must be a valid timestamp')
  }
  const time = `${pad2(at.getHours())}:${pad2(at.getMinutes())}:${pad2(at.getSeconds())}`
  return `${businessDate} ${time}`
}
