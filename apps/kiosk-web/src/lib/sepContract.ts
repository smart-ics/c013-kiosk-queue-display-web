import { ZodError } from 'zod'
import { SepDateContractError } from './sepDate'

/**
 * Client-side SEP request contract failures (ARCHITECTURE TD-009 and
 * ARCHITECTURE §9, Contract validation observability).
 *
 * A `POST /sep` payload whose `sepDate` does not match `yyyy-MM-dd HH:mm:ss` is
 * rejected by the shared client contract before any HTTP request is issued, and
 * by the composer that builds the value. Neither is a service call nor a Jetli
 * business rejection, so it must be loggable as a request-contract defect
 * without reading the service's free-text 400 message.
 *
 * The log deliberately carries only the offending field names: never the
 * participant identity, never credentials, and never the request body.
 */
export const SEP_CONTRACT_FAILURE_LOG_PREFIX = '[kiosk] SEP request contract failure'

function contractFailureFields(error: unknown): string[] {
  if (error instanceof SepDateContractError) {
    return [error.field]
  }
  if (error instanceof ZodError) {
    const fields = error.issues
      .map((issue) => issue.path[0])
      .filter((segment): segment is string => typeof segment === 'string')
    return [...new Set(fields)]
  }
  return []
}

/**
 * Logs a SEP request contract failure, naming the offending field(s) so a
 * request-contract defect is distinguishable in kiosk logs from a Jetli
 * business rejection or a transport error. Service error text is never logged
 * here.
 *
 * Returns `true` when the error is a recognised SEP request contract failure,
 * `false` when it is a service or transport error and must be logged elsewhere.
 */
export function reportSepContractFailure(error: unknown): boolean {
  const fields = contractFailureFields(error)
  if (fields.length === 0) return false
  // eslint-disable-next-line no-console
  console.warn(
    `${SEP_CONTRACT_FAILURE_LOG_PREFIX}: field=${fields.join(',')} rejected by the client contract before any POST /sep request was issued`,
  )
  return true
}
